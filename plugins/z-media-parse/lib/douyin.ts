import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { downloadToFile, followRedirect } from "./download.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0";

const DY_INFO =
  "https://www.douyin.com/aweme/v1/web/aweme/detail/?device_platform=webapp&aid=6383&channel=channel_pc_web&aweme_id={}&pc_client_type=1&version_code=190500&version_name=19.5.0&cookie_enabled=true&screen_width=1344&screen_height=756&browser_language=zh-CN&browser_platform=Win32&browser_name=Firefox&browser_version=118.0&browser_online=true&engine_name=Gecko&engine_version=109.0&os_name=Windows&os_version=10&cpu_core_num=16&device_memory=&platform=PC";

const DY_SHARE_VIDEO = "https://www.iesdouyin.com/share/video/{}/";
const DY_SHARE_NOTE = "https://www.iesdouyin.com/share/note/{}/";

export type DouyinResolved = {
  awemeId: string;
  desc: string;
  author: string;
  cover?: string;
  videoUrl?: string;
  images?: string[];
  durationSec: number;
  via: "api" | "ssr";
};

function loadAbogus(): ((params: string, ua: string) => string) | null {
  try {
    const require = createRequire(import.meta.url);
    const mod = require(join(dirname(fileURLToPath(import.meta.url)), "a-bogus.cjs")) as {
      generate_a_bogus?: (p: string, ua: string) => string;
    };
    return typeof mod.generate_a_bogus === "function" ? mod.generate_a_bogus : null;
  } catch {
    return null;
  }
}

const generateABogus = loadAbogus();

export function isDouyinText(text: string): boolean {
  return /(v|www|live)\.douyin\.com|iesdouyin\.com|webcast\.amemv\.com/i.test(text);
}

export function extractAwemeId(url: string): string | null {
  const patterns = [
    /\/video\/(\d+)/,
    /\/note\/(\d+)/,
    /\/share\/(?:video|note)\/(\d+)/,
    /modal_id=(\d+)/,
    /aweme_id=(\d+)/,
  ];
  for (const re of patterns) {
    const m = re.exec(url);
    if (m?.[1]) return m[1];
  }
  return null;
}

function firstUrl(obj: unknown): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  const list = o.url_list;
  if (Array.isArray(list) && list[0]) return String(list[0]);
  if (typeof o.uri === "string" && o.uri.startsWith("http")) return o.uri;
  return undefined;
}

function pickVideoUrl(item: Record<string, unknown>): string | undefined {
  const video = (item.video || {}) as Record<string, unknown>;
  const play = firstUrl(video.play_addr) || firstUrl(video.download_addr) || firstUrl(video.play_addr_h264);
  if (play) {
    // 网页 play 常带水印；优先 bit_rate 里较大的
    const bitRates = video.bit_rate;
    if (Array.isArray(bitRates) && bitRates.length) {
      const sorted = [...bitRates].sort((a, b) => {
        const ba = Number((a as { bit_rate?: number }).bit_rate || 0);
        const bb = Number((b as { bit_rate?: number }).bit_rate || 0);
        return bb - ba;
      });
      const best = firstUrl((sorted[0] as { play_addr?: unknown }).play_addr);
      if (best) return best.replace("playwm", "play");
    }
    return play.replace("playwm", "play");
  }
  const uri = (video.play_addr as { uri?: string } | undefined)?.uri;
  if (uri) {
    return `https://aweme.snssdk.com/aweme/v1/play/?video_id=${uri}&ratio=1080p&line=0`;
  }
  return undefined;
}

function pickImages(item: Record<string, unknown>): string[] {
  const images = item.images;
  if (!Array.isArray(images)) return [];
  const out: string[] = [];
  for (const im of images) {
    const u = firstUrl(im) || firstUrl((im as { url_list?: unknown }).url_list ? im : null);
    const list = (im as { url_list?: string[] })?.url_list;
    if (Array.isArray(list) && list[0]) out.push(String(list[0]));
    else if (u) out.push(u);
  }
  return out;
}

function fromAwemeDetail(item: Record<string, unknown>, via: "api" | "ssr"): DouyinResolved | null {
  const awemeId = String(item.aweme_id || "");
  if (!awemeId) return null;
  const author = ((item.author || {}) as { nickname?: string }).nickname || "抖音用户";
  const desc = String(item.desc || "").trim() || "无简介";
  const durationMs = Number(
    (item.video as { duration?: number } | undefined)?.duration || item.duration || 0,
  );
  const durationSec = durationMs > 10_000 ? Math.round(durationMs / 1000) : Math.round(durationMs);
  const cover =
    firstUrl((item.video as { cover?: unknown } | undefined)?.cover) ||
    firstUrl((item.video as { origin_cover?: unknown } | undefined)?.origin_cover) ||
    pickImages(item)[0];
  const images = pickImages(item);
  const videoUrl = pickVideoUrl(item);
  if (!videoUrl && !images.length) return null;
  return {
    awemeId,
    desc,
    author,
    cover,
    videoUrl,
    images: images.length ? images : undefined,
    durationSec: durationSec || 0,
    via,
  };
}

function extractBalancedJson(source: string, marker: string): string | null {
  const idx = source.indexOf(marker);
  if (idx < 0) return null;
  const start = source.indexOf("{", idx);
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

function findAwemeInTree(value: unknown, depth = 0): Record<string, unknown> | null {
  if (!value || depth > 12) return null;
  if (Array.isArray(value)) {
    for (const v of value) {
      const hit = findAwemeInTree(v, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  if (o.aweme_id && (o.video || o.images)) return o;
  for (const v of Object.values(o)) {
    const hit = findAwemeInTree(v, depth + 1);
    if (hit) return hit;
  }
  return null;
}

async function resolveBySsr(awemeId: string): Promise<DouyinResolved | null> {
  const candidates = [DY_SHARE_VIDEO.replace("{}", awemeId), DY_SHARE_NOTE.replace("{}", awemeId)];
  for (const page of candidates) {
    try {
      const res = await fetch(page, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
          Referer: "https://www.douyin.com/",
        },
        signal: AbortSignal.timeout(20_000),
      });
      const html = await res.text();
      const jsonText =
        extractBalancedJson(html, "window._ROUTER_DATA") ||
        extractBalancedJson(html, "RENDER_DATA") ||
        extractBalancedJson(html, "_ROUTER_DATA");
      if (!jsonText) continue;
      let data: unknown;
      try {
        data = JSON.parse(jsonText);
      } catch {
        try {
          data = JSON.parse(decodeURIComponent(jsonText));
        } catch {
          continue;
        }
      }
      const aweme = findAwemeInTree(data);
      if (!aweme) continue;
      const resolved = fromAwemeDetail(aweme, "ssr");
      if (resolved) return resolved;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function resolveByApi(awemeId: string, cookie: string): Promise<DouyinResolved | null> {
  if (!cookie.trim()) return null;
  const base = DY_INFO.replace("{}", awemeId);
  const search = new URL(base).searchParams.toString();
  const ab = generateABogus ? generateABogus(search, UA) : "";
  const url = ab ? `${base}&a_bogus=${encodeURIComponent(ab)}` : base;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Referer: "https://www.douyin.com/",
      Origin: "https://www.douyin.com",
      Cookie: cookie,
      Accept: "application/json, text/plain, */*",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { aweme_detail?: Record<string, unknown> };
  if (!data?.aweme_detail) return null;
  return fromAwemeDetail(data.aweme_detail, "api");
}

export async function resolveDouyin(
  rawText: string,
  opts: { cookie?: string; preferSsr?: boolean },
): Promise<{ ok: true; data: DouyinResolved } | { ok: false; message: string }> {
  const urlMatch = String(rawText).match(
    /https?:\/\/(?:v|www|live)\.douyin\.com\/[^\s<>"']+|https?:\/\/(?:www\.)?iesdouyin\.com\/[^\s<>"']+/i,
  );
  let url = urlMatch?.[0]?.replace(/[),.;!?，。！？]+$/, "") || "";
  if (!url) {
    const idOnly = extractAwemeId(rawText);
    if (idOnly) url = DY_SHARE_VIDEO.replace("{}", idOnly);
  }
  if (!url) return { ok: false, message: "未找到抖音链接" };

  if (/v\.douyin\.com/i.test(url)) {
    try {
      url = await followRedirect(url);
    } catch (e) {
      return { ok: false, message: `短链跳转失败：${e instanceof Error ? e.message : String(e)}` };
    }
  }

  const awemeId = extractAwemeId(url);
  if (!awemeId) return { ok: false, message: "无法提取抖音作品 ID" };

  const preferSsr = opts.preferSsr !== false;
  const cookie = String(opts.cookie || "");

  const tryOrder: Array<() => Promise<DouyinResolved | null>> = preferSsr
    ? [() => resolveBySsr(awemeId), () => resolveByApi(awemeId, cookie)]
    : [() => resolveByApi(awemeId, cookie), () => resolveBySsr(awemeId)];

  let lastErr = "";
  for (const fn of tryOrder) {
    try {
      const hit = await fn();
      if (hit) return { ok: true, data: hit };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }

  if (!cookie.trim()) {
    return {
      ok: false,
      message: `解析失败${lastErr ? `（${lastErr}）` : ""}。可在控制台填 Cookie，或发 #抖音登录 扫码自动写入`,
    };
  }
  return { ok: false, message: `解析失败${lastErr ? `：${lastErr}` : "，请检查 Cookie 是否过期"}` };
}

export async function downloadDouyinVideo(
  resolved: DouyinResolved,
): Promise<{ ok: true; path: string; size: number } | { ok: false; message: string }> {
  if (!resolved.videoUrl) return { ok: false, message: "没有视频地址（可能是图集）" };
  return downloadToFile(resolved.videoUrl, {
    fileName: `douyin-${resolved.awemeId}.mp4`,
    headers: { Referer: "https://www.douyin.com/" },
  });
}
