import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** 仓库根（含 apps/gateway 或 pnpm-workspace） */
export function findRepoRoot(): string {
  let d = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    if (
      existsSync(join(d, "pnpm-workspace.yaml")) ||
      existsSync(join(d, "apps", "gateway")) ||
      existsSync(join(d, "packages", "plugin-sdk"))
    ) {
      return d;
    }
    const parent = dirname(d);
    if (parent === d) break;
    d = parent;
  }
  return process.cwd();
}

export function mediaDataDir(root = findRepoRoot()): string {
  const dir = join(root, "data", "media-parse");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function downloadDir(root = findRepoRoot()): string {
  const dir = join(mediaDataDir(root), "download");
  mkdirSync(dir, { recursive: true });
  return dir;
}
