import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { downloadToFile, followRedirect } from "./download.js";
import { findRepoRoot, mediaDataDir } from "./paths.js";

const UA_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const UA_MOBILE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";

const DY_INFO =
  "https://www.douyin.com/aweme/v1/web/aweme/detail/?device_platform=webapp&aid=6383&channel=channel_pc_web&aweme_id={}&pc_client_type=1&version_code=190500&version_name=19.5.0&cookie_enabled=true&screen_width=1344&screen_height=756&browser_language=zh-CN&browser_platform=Win32&browser_name=Chrome&browser_version=124.0.0.0&browser_online=true&engine_name=Blink&engine_version=124.0.0.0&os_name=Windows&os_version=10&cpu_core_num=16&device_memory=&platform=PC";

const DY_SHARE_VIDEO = "https://www.iesdouyin.com/share/video/{}/";
const DY_SHARE_NOTE = "https://www.iesdouyin.com/share/note/{}/";
const DY_WEB_VIDEO = "https://www.douyin.com/video/{}";
const DY_WEB_NOTE = "https://www.douyin.com/note/{}";

export type DouyinResolved = {
  awemeId: string;
  desc: string;
  author: string;
  cover?: string;
  videoUrl?: string;
  images?: string[];
  musicUrl?: string;
  durationSec: number;
  via: "api" | "ssr" | "browser";
};

type PwCookie = { name: string; value: string; domain?: string; path?: string };
type PwResponse = { url: () => string; status: () => number; text: () => Promise<string> };
type PwPage = {
  goto: (url: string, opts?: Record<string, unknown>) => Promise<unknown>;
  url: () => string;
  content: () => Promise<string>;
  waitForTimeout: (ms: number) => Promise<void>;
  on: (ev: "response", fn: (res: PwResponse) => void) => void;
};
type PwContext = {
  newPage: () => Promise<PwPage>;
  addCookies: (cookies: PwCookie[]) => Promise<void>;
  close: () => Promise<void>;
};
type PlaywrightMod = {
  chromium: {
    launch: (opts?: Record<string, unknown>) => Promise<{
      newContext: (opts?: Record<string, unknown>) => Promise<PwContext>;
      close: () => Promise<void>;
    }>;
  };
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
  return /(?:https?:\/\/)?(?:v|www|m|live)\.douyin\.com|(?:www\.)?iesdouyin\.com|webcast\.amemv\.com/i.test(
    text,
  );
}

export function extractAwemeId(url: string): string | null {
  const patterns = [
    /\/video\/(\d{15,})/,
    /\/note\/(\d{15,})/,
    /\/share\/(?:video|note)\/(\d{15,})/,
    /modal_id=(\d{15,})/,
    /aweme_id=(\d{15,})/,
  ];
  for (const re of patterns) {
    const m = re.exec(url);
    if (m?.[1]) return m[1];
  }
  return null;
}

function isBareDouyinHome(url: string): boolean {
  try {
    const u = new URL(url);
    if (!/(^|\.)douyin\.com$/i.test(u.hostname)) return false;
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return path === "/" || path === "/jingxuan" || path === "/recommend";
  } catch {
    return false;
  }
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
    const list = (im as { url_list?: string[] })?.url_list;
    if (Array.isArray(list) && list[0]) out.push(String(list[0]));
    else {
      const u = firstUrl(im);
      if (u) out.push(u);
    }
  }
  return out;
}

function fromAwemeDetail(
  item: Record<string, unknown>,
  via: DouyinResolved["via"],
): DouyinResolved | null {
  const awemeId = String(item.aweme_id || "");
  if (!awemeId) return null;
  const author = ((item.author || {}) as { nickname?: string }).nickname || "抖音用户";
  const desc = String(item.desc || "").trim() || "无简介";
  const rawDuration = Number(
    (item.video as { duration?: number } | undefined)?.duration || item.duration || 0,
  );
  // 抖音 video.duration 一般是毫秒；9 秒会写成 9000，旧逻辑用 >10000 才除 1000，会把短视频当成几十分钟
  const durationSec =
    rawDuration >= 1000 ? Math.round(rawDuration / 1000) : Math.round(rawDuration);
  const cover =
    firstUrl((item.video as { cover?: unknown } | undefined)?.cover) ||
    firstUrl((item.video as { origin_cover?: unknown } | undefined)?.origin_cover) ||
    pickImages(item)[0];
  const images = pickImages(item);
  const videoUrl = pickVideoUrl(item);
  const music = (item.music || {}) as { play_url?: unknown };
  const musicUrl = firstUrl(music.play_url);
  if (!videoUrl && !images.length) return null;
  return {
    awemeId,
    desc,
    author,
    cover,
    videoUrl,
    images: images.length ? images : undefined,
    musicUrl,
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
  if (!value || depth > 14) return null;
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
  if (Array.isArray(o.item_list) && o.item_list[0]) {
    const hit = findAwemeInTree(o.item_list[0], depth + 1);
    if (hit) return hit;
  }
  if (o.videoInfoRes) {
    const hit = findAwemeInTree(o.videoInfoRes, depth + 1);
    if (hit) return hit;
  }
  for (const v of Object.values(o)) {
    const hit = findAwemeInTree(v, depth + 1);
    if (hit) return hit;
  }
  return null;
}

function parseHtmlAweme(html: string, via: DouyinResolved["via"]): DouyinResolved | null {
  const renderScript = html.match(/<script[^>]*id=["']RENDER_DATA["'][^>]*>([^<]+)<\/script>/i);
  const candidates: string[] = [];
  if (renderScript?.[1]) candidates.push(renderScript[1]);
  const balanced =
    extractBalancedJson(html, "window._ROUTER_DATA") ||
    extractBalancedJson(html, "_ROUTER_DATA") ||
    extractBalancedJson(html, "RENDER_DATA");
  if (balanced) candidates.push(balanced);

  for (const raw of candidates) {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      try {
        data = JSON.parse(decodeURIComponent(raw));
      } catch {
        continue;
      }
    }
    const aweme = findAwemeInTree(data);
    if (!aweme) continue;
    const resolved = fromAwemeDetail(aweme, via);
    if (resolved) return resolved;
  }
  return null;
}

async function loadPlaywright(): Promise<PlaywrightMod | null> {
  const root = findRepoRoot();
  for (const pkgJson of [
    join(root, "packages/browser-shot/package.json"),
    join(root, "package.json"),
    join(root, "plugins/z-draw/package.json"),
  ]) {
    if (!existsSync(pkgJson)) continue;
    try {
      const req = createRequire(pkgJson);
      const mod = req("playwright") as PlaywrightMod;
      if (mod?.chromium) return mod;
    } catch {
      /* next */
    }
  }
  try {
    const mod = (await import("playwright")) as unknown as PlaywrightMod;
    if (mod?.chromium) return mod;
  } catch {
    /* ignore */
  }
  return null;
}

function cookieHeaderToPw(cookie: string): PwCookie[] {
  return cookie
    .split(";")
    .map((part) => {
      const i = part.indexOf("=");
      if (i <= 0) return null;
      return {
        name: part.slice(0, i).trim(),
        value: part.slice(i + 1).trim(),
        domain: ".douyin.com",
        path: "/",
      } as PwCookie;
    })
    .filter((c): c is PwCookie => Boolean(c?.name));
}

async function withDouyinBrowser<T>(
  cookie: string,
  fn: (page: PwPage) => Promise<T>,
): Promise<T | null> {
  const pw = await loadPlaywright();
  if (!pw?.chromium) return null;
  const statePath = join(mediaDataDir(), "douyin-state.json");
  let browser: Awaited<ReturnType<PlaywrightMod["chromium"]["launch"]>> | null = null;
  try {
    browser = await pw.chromium.launch({
      headless: true,
      args: ["--disable-dev-shm-usage"],
    });
    const ctxOpts: Record<string, unknown> = {
      viewport: { width: 1280, height: 800 },
      locale: "zh-CN",
      userAgent: UA_CHROME,
    };
    if (existsSync(statePath)) ctxOpts.storageState = statePath;
    const context = await browser.newContext(ctxOpts);
    if (!existsSync(statePath) && cookie.trim()) {
      try {
        await context.addCookies(cookieHeaderToPw(cookie));
      } catch {
        /* ignore */
      }
    }
    const page = await context.newPage();
    try {
      return await fn(page);
    } finally {
      try {
        await context.close();
      } catch {
        /* ignore */
      }
    }
  } catch {
    return null;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
  }
}

/** 短链被风控成首页时，用本机 Chromium + 登录态再跟一次 */
async function expandShortInBrowser(shortUrl: string, cookie: string): Promise<string> {
  return (
    (await withDouyinBrowser(cookie, async (page) => {
      await page.goto(shortUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForTimeout(3500);
      const final = page.url();
      if (extractAwemeId(final)) return final;
      const html = await page.content();
      const fromHtml = extractAwemeId(html) || html.match(/modal_id=(\d{15,})/)?.[1];
      if (fromHtml && !isBareDouyinHome(final)) {
        return `https://www.douyin.com/video/${fromHtml}`;
      }
      // 只有最终 URL 才可信；首页推荐流里的 id 一律不用
      return final;
    })) || shortUrl
  );
}

async function resolveByBrowser(awemeId: string, cookie: string): Promise<DouyinResolved | null> {
  return withDouyinBrowser(cookie, async (page) => {
    let detailResolve: ((t: string) => void) | null = null;
    let detailPromise = new Promise<string>((resolve) => {
      detailResolve = resolve;
    });
    const armDetail = () => {
      detailPromise = new Promise<string>((resolve) => {
        detailResolve = resolve;
      });
    };

    page.on("response", (res) => {
      const u = res.url();
      if (!/\/aweme\/v1\/web\/aweme\/detail\//.test(u)) return;
      if (res.status() !== 200) return;
      void res.text().then((t) => {
        if (t.includes("aweme_detail") && detailResolve) {
          const done = detailResolve;
          detailResolve = null;
          done(t);
        }
      });
    });

    for (const tpl of [DY_WEB_VIDEO, DY_WEB_NOTE]) {
      armDetail();
      await page.goto(tpl.replace("{}", awemeId), {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      const detailJson = await Promise.race([
        detailPromise,
        page.waitForTimeout(6000).then(() => ""),
      ]);
      if (detailJson) {
        try {
          const data = JSON.parse(detailJson) as { aweme_detail?: Record<string, unknown> };
          if (data.aweme_detail) {
            const hit = fromAwemeDetail(data.aweme_detail, "browser");
            if (hit) return hit;
          }
        } catch {
          /* continue */
        }
      }
      const html = await page.content();
      const fromHtml = parseHtmlAweme(html, "browser");
      if (fromHtml) return fromHtml;
    }
    return null;
  });
}

async function resolveBySsr(awemeId: string, cookie: string): Promise<DouyinResolved | null> {
  const candidates = [
    DY_SHARE_VIDEO.replace("{}", awemeId),
    DY_SHARE_NOTE.replace("{}", awemeId),
    DY_WEB_VIDEO.replace("{}", awemeId),
    DY_WEB_NOTE.replace("{}", awemeId),
  ];
  for (const page of candidates) {
    try {
      const res = await fetch(page, {
        headers: {
          "User-Agent": page.includes("iesdouyin") ? UA_MOBILE : UA_CHROME,
          Referer: "https://www.douyin.com/",
          ...(cookie ? { Cookie: cookie } : {}),
        },
        signal: AbortSignal.timeout(20_000),
      });
      const html = await res.text();
      const resolved = parseHtmlAweme(html, "ssr");
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
  const ab = generateABogus ? generateABogus(search, UA_CHROME) : "";
  const url = ab ? `${base}&a_bogus=${encodeURIComponent(ab)}` : base;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA_CHROME,
      Referer: `https://www.douyin.com/video/${awemeId}`,
      Origin: "https://www.douyin.com",
      Cookie: cookie,
      Accept: "application/json, text/plain, */*",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (/Argus|Uifid|Blocked/i.test(text) || res.status === 403) {
      throw new Error("ARGUS_BLOCKED");
    }
    return null;
  }
  const data = (await res.json()) as { aweme_detail?: Record<string, unknown> };
  if (!data?.aweme_detail) return null;
  return fromAwemeDetail(data.aweme_detail, "api");
}

async function followShortLink(url: string, cookie: string): Promise<string> {
  // 先手动跟跳，避免丢 Location
  let cur = url;
  for (let i = 0; i < 6; i++) {
    const res = await fetch(cur, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": UA_MOBILE,
        ...(cookie ? { Cookie: cookie, Referer: "https://www.douyin.com/" } : {}),
      },
      signal: AbortSignal.timeout(15_000),
    });
    const loc = res.headers.get("location");
    if (loc && [301, 302, 303, 307, 308].includes(res.status)) {
      cur = new URL(loc, cur).href;
      if (extractAwemeId(cur)) return cur;
      continue;
    }
    break;
  }
  try {
    cur = await followRedirect(url);
  } catch {
    /* keep cur */
  }
  if (extractAwemeId(cur)) return cur;
  if (isBareDouyinHome(cur) || !extractAwemeId(cur)) {
    const viaBrowser = await expandShortInBrowser(url, cookie);
    if (extractAwemeId(viaBrowser)) return viaBrowser;
    return viaBrowser || cur;
  }
  return cur;
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

  const cookie = String(opts.cookie || "");

  if (/v\.douyin\.com/i.test(url)) {
    try {
      url = await followShortLink(url, cookie);
    } catch (e) {
      return { ok: false, message: `短链跳转失败：${e instanceof Error ? e.message : String(e)}` };
    }
  }

  const awemeId = extractAwemeId(url);
  if (!awemeId) {
    if (isBareDouyinHome(url)) {
      return {
        ok: false,
        message: "短链已失效或被风控（跳到了抖音首页）。请重新打开抖音 App 复制最新分享链接",
      };
    }
    return { ok: false, message: "无法提取抖音作品 ID" };
  }

  const notes: string[] = [];
  let argusHit = false;

  // 有 Cookie 时优先接口；失败再 SSR；最后浏览器通道（可过 Argus）
  const steps: Array<{ name: string; run: () => Promise<DouyinResolved | null> }> = [];
  if (cookie.trim()) {
    steps.push({ name: "api", run: () => resolveByApi(awemeId, cookie) });
  }
  steps.push({ name: "ssr", run: () => resolveBySsr(awemeId, cookie) });
  if (cookie.trim()) {
    steps.push({ name: "browser", run: () => resolveByBrowser(awemeId, cookie) });
  } else if (opts.preferSsr === false) {
    /* no browser without cookie */
  }

  for (const step of steps) {
    try {
      const hit = await step.run();
      if (hit) return { ok: true, data: hit };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "ARGUS_BLOCKED") {
        argusHit = true;
        notes.push("接口风控");
      } else {
        notes.push(msg.slice(0, 80));
      }
    }
  }

  if (!cookie.trim()) {
    return {
      ok: false,
      message: `解析失败${notes.length ? `（${notes.join("；")}）` : ""}。请先发 #抖音登录 扫码写入 Cookie`,
    };
  }
  if (argusHit) {
    return {
      ok: false,
      message:
        "解析失败：接口被风控且浏览器通道未取到作品。可再试一次 #抖音登录，或换一条新复制的分享链接",
    };
  }
  return {
    ok: false,
    message: `解析失败${notes.length ? `：${notes.join("；")}` : "，作品可能已删除或无权限"}`,
  };
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
