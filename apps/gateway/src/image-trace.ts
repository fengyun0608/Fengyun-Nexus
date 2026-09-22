/**
 * 企业级图片出处线索：先分类（真人照 / 梗图 / 截图 / 其它），
 * 再按类别走不同反查策略。不碰内网；真人照默认不做人脸搜索。
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, extname } from "node:path";
import { publicHttpUrl, webSearch, type WebHit } from "./web-lookup.js";

/** 本地图片转 data URL，供 OpenAI 兼容视觉接口 */
export function localImageToDataUrl(filePath: string, maxBytes = 2_500_000): string | null {
  try {
    if (!existsSync(filePath)) return null;
    const st = statSync(filePath);
    if (!st.isFile() || st.size < 32 || st.size > maxBytes) return null;
    const ext = extname(filePath).toLowerCase();
    const mime =
      ext === ".png"
        ? "image/png"
        : ext === ".gif"
          ? "image/gif"
          : ext === ".webp"
            ? "image/webp"
            : "image/jpeg";
    return `data:${mime};base64,${readFileSync(filePath).toString("base64")}`;
  } catch {
    return null;
  }
}

export type ImageKind = "person_photo" | "meme" | "screenshot" | "art" | "other" | "unknown";

export type ImageTraceResult = {
  ok: boolean;
  path?: string;
  kindHint?: ImageKind;
  sha256?: string;
  bytes?: number;
  /** 给模型看的中文流程说明 */
  playbook: string[];
  searchQuery?: string;
  items: WebHit[];
  sauceNao?: Array<{ title: string; url: string; similarity?: string; source?: string }>;
  message: string;
  privacyNote?: string;
};

function clip(s: string, n: number): string {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function fileSha256(path: string): string {
  const h = createHash("sha256");
  h.update(readFileSync(path));
  return h.digest("hex");
}

/** 粗分：仅靠文件名/描述启发式；精细分类交给视觉模型 */
export function hintImageKind(opts: {
  path?: string;
  description?: string;
  ocrText?: string;
}): ImageKind {
  const blob = `${opts.description || ""} ${opts.ocrText || ""} ${basename(opts.path || "")}`.toLowerCase();
  if (/梗|meme|表情包|配文|字幕|熊猫头|蘑菇头|抽象/.test(blob)) return "meme";
  if (/截图|screenshot|屏幕|聊天记录|微信|qq群/.test(blob)) return "screenshot";
  if (/自拍|真人|人脸|证件|合影|本人|照片/.test(blob)) return "person_photo";
  if (/插画|二次元|动漫|绘画|立绘|pixiv/.test(blob)) return "art";
  return "unknown";
}

async function sauceNaoSearch(
  path: string,
  apiKey: string,
): Promise<ImageTraceResult["sauceNao"]> {
  try {
    const buf = readFileSync(path);
    if (buf.length > 6_000_000) return [];
    const form = new FormData();
    form.set("api_key", apiKey);
    form.set("output_type", "2");
    form.set("numres", "6");
    form.set(
      "file",
      new Blob([new Uint8Array(buf)], { type: "application/octet-stream" }),
      `query${extname(path) || ".jpg"}`,
    );
    const res = await fetch("https://saucenao.com/search.php", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{
        header?: { similarity?: string; index_name?: string };
        data?: { title?: string; source?: string; ext_urls?: string[]; member_name?: string };
      }>;
    };
    const out: NonNullable<ImageTraceResult["sauceNao"]> = [];
    for (const row of data.results || []) {
      const title = clip(
        row.data?.title || row.data?.member_name || row.header?.index_name || "匹配",
        120,
      );
      const url = String(row.data?.ext_urls?.[0] || row.data?.source || "").trim();
      if (!title && !url) continue;
      out.push({
        title: title || "匹配",
        url,
        similarity: row.header?.similarity,
        source: row.header?.index_name,
      });
      if (out.length >= 6) break;
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * @param path 本机图片
 * @param opts.kind 视觉已分好的类；不传则启发式
 * @param opts.description / ocrText 视觉或 OCR 抽出的字，用于搜网
 * @param opts.publicImageUrl 若已有公网可访问地址，可附在搜词里
 * @param opts.allowPersonReverse 主人明确要求时才对真人照做公开反查
 */
export async function traceImageOrigin(
  path: string,
  opts?: {
    kind?: ImageKind;
    description?: string;
    ocrText?: string;
    publicImageUrl?: string;
    allowPersonReverse?: boolean;
  },
): Promise<ImageTraceResult> {
  const file = String(path || "").trim();
  if (!file || !existsSync(file)) {
    return { ok: false, items: [], playbook: [], message: "图片文件不存在" };
  }
  let st;
  try {
    st = statSync(file);
  } catch {
    return { ok: false, items: [], playbook: [], message: "无法读取图片" };
  }
  if (!st.isFile() || st.size < 32) {
    return { ok: false, items: [], playbook: [], message: "不是有效图片" };
  }
  if (st.size > 8_000_000) {
    return { ok: false, items: [], playbook: [], message: "图片过大，请压缩后再查" };
  }

  const kind =
    opts?.kind && opts.kind !== "unknown"
      ? opts.kind
      : hintImageKind({
          path: file,
          description: opts?.description,
          ocrText: opts?.ocrText,
        });
  const sha256 = fileSha256(file);
  const playbook: string[] = [];
  const ocr = clip(opts?.ocrText || "", 160);
  const desc = clip(opts?.description || "", 160);

  if (kind === "person_photo") {
    playbook.push(
      "分类：真人/自拍类照片。",
      "默认不做公开以图搜图（隐私）。只描述画面、是否像本人、是否证件照风格。",
      "若主人明确要求溯源，再开 allowPersonReverse 或自行搜公开新闻图。",
    );
    if (!opts?.allowPersonReverse) {
      return {
        ok: true,
        path: file,
        kindHint: kind,
        sha256,
        bytes: st.size,
        playbook,
        items: [],
        message: "已判定为真人照：未做公开反查（隐私保护）",
        privacyNote: "真人照默认不上传到反搜引擎。需要溯源请主人明确说「反查这张人像」。",
      };
    }
    playbook.push("主人已允许对真人照做公开线索检索。");
  } else if (kind === "meme") {
    playbook.push(
      "分类：梗图/表情包。",
      "流程：①读图面文案/角色特征 → ②用文案+特征搜网页 → ③有 SauceNAO 密钥则再以图搜源站。",
    );
  } else if (kind === "screenshot") {
    playbook.push(
      "分类：界面截图。",
      "流程：OCR 关键按钮/标题 → 搜产品名或错误原文；一般不是「梗」出处。",
    );
  } else if (kind === "art") {
    playbook.push(
      "分类：插画/二次元。",
      "流程：优先 SauceNAO / 画师署名 / 角色名搜；勿误当成真人。",
    );
  } else {
    playbook.push(
      "分类未定。先用视觉分清：person_photo / meme / screenshot / art / other，再按类反查。",
    );
  }

  const queryParts = [
    kind === "meme" ? "梗图 出处" : kind === "art" ? "插画 来源" : "图片",
    ocr,
    desc,
  ].filter(Boolean);
  const searchQuery = clip(queryParts.join(" "), 120);
  let items: WebHit[] = [];
  if (searchQuery.length >= 4) {
    const hit = await webSearch(searchQuery);
    items = hit.items || [];
    playbook.push(hit.ok ? `网页线索：${hit.message}` : `网页搜索：${hit.message}`);
  } else {
    playbook.push("缺少 OCR/描述，无法有效搜网页；请先让视觉读出画面文字或特征。");
  }

  const pub = opts?.publicImageUrl && publicHttpUrl(opts.publicImageUrl)
    ? String(opts.publicImageUrl)
    : "";
  if (pub) {
    playbook.push(`可人工打开以图搜图：https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:${encodeURIComponent(pub)}`);
  }

  let sauceNao: ImageTraceResult["sauceNao"];
  const sauceKey = String(process.env.SAUCENAO_API_KEY || "").trim();
  if (sauceKey && (kind === "meme" || kind === "art" || kind === "other" || kind === "unknown" || opts?.allowPersonReverse)) {
    sauceNao = await sauceNaoSearch(file, sauceKey);
    playbook.push(
      sauceNao?.length
        ? `SauceNAO 命中 ${sauceNao.length} 条`
        : "SauceNAO 无结果或请求失败",
    );
  } else if (!sauceKey) {
    playbook.push("未配置 SAUCENAO_API_KEY，跳过专业以图搜源；可配环境变量增强。");
  }

  return {
    ok: true,
    path: file,
    kindHint: kind,
    sha256,
    bytes: st.size,
    playbook,
    searchQuery: searchQuery || undefined,
    items,
    sauceNao,
    message: items.length || sauceNao?.length
      ? "已收集出处线索，请用人话汇总给用户"
      : "已走完流程，但公开线索很少；把视觉描述说清楚再问一次",
    privacyNote: kind === "person_photo" ? "真人照线索需谨慎传播。" : undefined,
  };
}
