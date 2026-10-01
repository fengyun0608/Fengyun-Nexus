import { downloadToFile, followRedirect } from "./download.js";
import { listKuaishouApis, type MediaParseCfg } from "./config.js";

export type KuaishouResolved = {
  photoId: string;
  title: string;
  author: string;
  cover?: string;
  videoUrl?: string;
  images?: string[];
  via: string;
};

export function isKuaishouText(text: string): boolean {
  return /(?:https?:\/\/)?(?:v\.|www\.)?kuaishou\.com|chenzhongtech\.com/i.test(text);
}

function extractPhotoId(url: string): string | null {
  const patterns = [
    /\/fw\/photo\/([^/?#]+)/,
    /\/fw\/long-video\/([^/?#]+)/,
    /\/short-video\/([^/?#]+)/,
    /\/video\/([^/?#]+)/,
  ];
  for (const re of patterns) {
    const m = re.exec(url);
    if (m?.[1]) return m[1];
  }
  return null;
}

export async function normalizeKuaishouUrl(rawText: string): Promise<{
  ok: true;
  url: string;
  photoId: string;
} | { ok: false; message: string }> {
  const m = String(rawText).match(
    /https?:\/\/(?:[a-z0-9.-]+\.)?(?:kuaishou|chenzhongtech)\.com\/[^\s<>"']+/i,
  );
  let url = m?.[0]?.replace(/[),.;!?，。！？]+$/, "") || "";
  if (!url) return { ok: false, message: "未找到快手链接" };

  if (/v\.kuaishou\.com/i.test(url)) {
    try {
      url = await followRedirect(url);
    } catch (e) {
      return { ok: false, message: `短链跳转失败：${e instanceof Error ? e.message : String(e)}` };
    }
  }

  const photoId = extractPhotoId(url);
  if (!photoId) return { ok: false, message: "无法提取快手作品 ID" };
  return { ok: true, url: `https://www.kuaishou.com/short-video/${photoId}`, photoId };
}

function pickFromUnknown(data: unknown): {
  video?: string;
  images?: string[];
  title?: string;
  author?: string;
  cover?: string;
} {
  if (!data || typeof data !== "object") return {};
  const root = data as Record<string, unknown>;
  const bag =
    (root.data as Record<string, unknown> | undefined) ||
    (root.result as Record<string, unknown> | undefined) ||
    root;

  const videoCandidates = [
    bag.video,
    bag.url,
    bag.videoUrl,
    bag.video_url,
    bag.playUrl,
    bag.play_url,
    (bag.video as { url?: string } | undefined)?.url,
  ];
  let video: string | undefined;
  for (const c of videoCandidates) {
    if (typeof c === "string" && /^https?:\/\//i.test(c)) {
      video = c;
      break;
    }
  }

  const images: string[] = [];
  const imgBag = bag.images || bag.pics || bag.imglist || bag.image_list;
  if (Array.isArray(imgBag)) {
    for (const it of imgBag) {
      if (typeof it === "string" && /^https?:\/\//i.test(it)) images.push(it);
      else if (it && typeof it === "object") {
        const u = (it as { url?: string }).url;
        if (typeof u === "string" && /^https?:\/\//i.test(u)) images.push(u);
      }
    }
  }

  const title = String(bag.title || bag.desc || bag.caption || bag.text || "").trim();
  const author = String(bag.author || bag.nickname || bag.user_name || bag.name || "").trim();
  const cover = String(bag.cover || bag.coverUrl || bag.cover_url || bag.pic || "").trim();

  return {
    video,
    images: images.length ? images : undefined,
    title: title || undefined,
    author: author || undefined,
    cover: /^https?:\/\//i.test(cover) ? cover : undefined,
  };
}

async function tryOneApi(
  template: string,
  contentUrl: string,
): Promise<{ ok: true; data: ReturnType<typeof pickFromUnknown>; via: string } | { ok: false; message: string }> {
  const link = template.replace("{}", encodeURIComponent(contentUrl));
  try {
    const res = await fetch(link, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
      },
      signal: AbortSignal.timeout(25_000),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      // 有的接口直接返回 URL
      if (/^https?:\/\/\S+$/i.test(text.trim())) {
        return { ok: true, data: { video: text.trim() }, via: link.split("?")[0] };
      }
      return { ok: false, message: `非 JSON（HTTP ${res.status}）` };
    }
    const picked = pickFromUnknown(json);
    if (!picked.video && !(picked.images && picked.images.length)) {
      return { ok: false, message: "接口无视频/图片" };
    }
    return { ok: true, data: picked, via: link.split("?")[0] };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function resolveKuaishou(
  rawText: string,
  cfg: MediaParseCfg,
): Promise<{ ok: true; data: KuaishouResolved } | { ok: false; message: string }> {
  const norm = await normalizeKuaishouUrl(rawText);
  if (!norm.ok) return norm;

  const apis = listKuaishouApis(cfg);
  if (!apis.length) return { ok: false, message: "未配置快手第三方解析接口" };

  const errors: string[] = [];
  for (const api of apis) {
    const hit = await tryOneApi(api, norm.url);
    if (!hit.ok) {
      errors.push(`${api.split("?")[0]} → ${hit.message}`);
      continue;
    }
    return {
      ok: true,
      data: {
        photoId: norm.photoId,
        title: hit.data.title || "快手作品",
        author: hit.data.author || "快手用户",
        cover: hit.data.cover,
        videoUrl: hit.data.video,
        images: hit.data.images,
        via: hit.via,
      },
    };
  }

  return {
    ok: false,
    message: `快手第三方全部失败：${errors.slice(0, 3).join("；") || "无可用接口"}`,
  };
}

export async function downloadKuaishouVideo(
  resolved: KuaishouResolved,
): Promise<{ ok: true; path: string; size: number } | { ok: false; message: string }> {
  if (!resolved.videoUrl) return { ok: false, message: "没有视频地址" };
  return downloadToFile(resolved.videoUrl, {
    fileName: `kuaishou-${resolved.photoId}.mp4`,
    headers: { Referer: "https://www.kuaishou.com/" },
  });
}
