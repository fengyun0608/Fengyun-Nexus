import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const DIR = "data/ob11-shot";
const MAX_AGE_MS = 60 * 60_000;

let rootDir = "";
let servePort = 0;

export function setOb11MediaRoot(root: string): void {
  rootDir = root;
}

export function setOb11MediaPort(port: number): void {
  servePort = Math.floor(Number(port) || 0);
}

export function ob11ShotDir(): string {
  return join(rootDir || process.cwd(), DIR);
}

/** 拷到本机媒体目录，返回 NapCat 能拉的 http 地址；没有端口时退回空串。 */
export function publishLocalImage(filePath: string): string {
  if (!rootDir || !servePort) return "";
  const dir = ob11ShotDir();
  mkdirSync(dir, { recursive: true });
  sweepOld(dir);
  const ext = (filePath.match(/\.(png|jpe?g|gif|webp|bmp)$/i)?.[0] || ".png").toLowerCase();
  const name = `${Date.now()}-${randomBytes(6).toString("hex")}${ext}`;
  const dest = join(dir, name);
  copyFileSync(filePath, dest);
  return `http://127.0.0.1:${servePort}/v1/ob11-media/${name}`;
}

export function resolveOb11Media(name: string): string | null {
  const base = String(name || "").trim();
  if (!/^[\w.-]+\.(png|jpe?g|gif|webp|bmp)$/i.test(base)) return null;
  const file = join(ob11ShotDir(), base);
  if (!existsSync(file)) return null;
  return file;
}

function sweepOld(dir: string): void {
  const now = Date.now();
  try {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      try {
        if (now - statSync(p).mtimeMs > MAX_AGE_MS) unlinkSync(p);
      } catch {
        /* 单个文件跳过 */
      }
    }
  } catch {
    /* 目录不可读就跳过 */
  }
}
