import { createWriteStream, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { downloadDir } from "./paths.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function followRedirect(url: string): Promise<string> {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20_000),
  });
  return res.url || url;
}

export async function downloadToFile(
  url: string,
  opts?: { fileName?: string; headers?: Record<string, string>; maxBytes?: number },
): Promise<{ ok: true; path: string; size: number } | { ok: false; message: string }> {
  const dir = downloadDir();
  const name = opts?.fileName || `media-${Date.now()}.mp4`;
  const dest = join(dir, name.replace(/[^\w.\-]+/g, "_"));
  const maxBytes = opts?.maxBytes ?? 80 * 1024 * 1024;
  try {
    if (existsSync(dest)) unlinkSync(dest);
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Referer: "https://www.douyin.com/",
        ...(opts?.headers || {}),
      },
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok || !res.body) {
      return { ok: false, message: `下载失败 HTTP ${res.status}` };
    }
    const len = Number(res.headers.get("content-length") || 0);
    if (len > maxBytes) return { ok: false, message: `文件过大（约 ${(len / 1024 / 1024).toFixed(1)}MB）` };
    const nodeStream = Readable.fromWeb(res.body as import("node:stream/web").ReadableStream);
    await pipeline(nodeStream, createWriteStream(dest));
    const { statSync } = await import("node:fs");
    const size = statSync(dest).size;
    if (size <= 0) {
      try {
        unlinkSync(dest);
      } catch {
        /* ignore */
      }
      return { ok: false, message: "下载为空文件" };
    }
    if (size > maxBytes) {
      try {
        unlinkSync(dest);
      } catch {
        /* ignore */
      }
      return { ok: false, message: `文件过大（约 ${(size / 1024 / 1024).toFixed(1)}MB）` };
    }
    return { ok: true, path: dest, size };
  } catch (e) {
    try {
      if (existsSync(dest)) unlinkSync(dest);
    } catch {
      /* ignore */
    }
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export function extractFirstUrl(text: string): string | null {
  const m = String(text || "").match(/https?:\/\/[^\s<>"']+/i);
  if (!m) return null;
  return m[0].replace(/[),.;!?，。！？]+$/, "");
}
