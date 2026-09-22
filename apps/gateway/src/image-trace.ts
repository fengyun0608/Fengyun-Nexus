/**
 * 企业级图片出处线索：有视觉则识图分类；无视觉则走相似度/以图搜图。
 * 不碰内网；真人照默认不做人脸公开反搜。
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

/** 模型名是否像带视觉（千问 VL / GPT-4o 等） */
export function modelSupportsVision(model?: string): boolean {
  const m = String(model || "").toLowerCase();
  if (!m) return false;
  if (/no[-_]?vision|text[-_]?only/.test(m)) return false;
  return /vl\b|vision|omni|gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-5|\bo1\b|\bo3\b|\bo4\b|gemini|claude-3|claude-4|llava|qwen2\.5-vl|qwen3-vl|qwen-vl|internvl|minicpm-v|phi-4-multimodal|step-1v|glm-4v|skywork-vl|doubao.*vision|seed-?1\.5|seed-?1\.6/.test(
    m,
  );
}

/** 从可用模型列表里挑一个适合入站看图的视觉模型（偏小/快） */
export function pickPreferredVisionModel(models: string[]): string | undefined {
  const vis = [...new Set(models.map((m) => String(m || "").trim()).filter(Boolean))].filter((m) =>
    modelSupportsVision(m),
  );
  if (!vis.length) return undefined;
  const score = (name: string) => {
    const x = name.toLowerCase();
    let s = 0;
    if (/qwen.*vl|vl.*qwen/.test(x)) s += 60;
    if (/gpt-4o/.test(x)) s += 50;
    if (/gemini.*flash|gemini-2/.test(x)) s += 45;
    if (/claude-3[.-]?5-sonnet|claude-4/.test(x)) s += 40;
    if (/flash|mini|plus|lite|small|turbo/.test(x)) s += 25;
    if (/instruct|chat/.test(x)) s += 5;
    if (/72b|max|large|pro|opus|405b/.test(x)) s -= 8;
    return s;
  };
  return [...vis].sort((a, b) => score(b) - score(a) || a.localeCompare(b))[0];
}

export type ImageKind = "person_photo" | "meme" | "screenshot" | "art" | "other" | "unknown";

export type ImageTraceResult = {
  ok: boolean;
  path?: string;
  kindHint?: ImageKind;
  sha256?: string;
  bytes?: number;
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

async function iqdbSearch(
  path: string,
): Promise<ImageTraceResult["sauceNao"]> {
  try {
    const buf = readFileSync(path);
    if (buf.length > 4_000_000) return [];
    const form = new FormData();
    form.set(
      "file",
      new Blob([new Uint8Array(buf)], { type: "application/octet-stream" }),
      `query${extname(path) || ".jpg"}`,
    );
    const res = await fetch("https://iqdb.org/", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30_000),
      headers: { "user-agent": "FengyunNexus/1.0" },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const out: NonNullable<ImageTraceResult["sauceNao"]> = [];
    // iqdb 结果表：相似度 + 链接
    for (const m of html.matchAll(
      /<td[^>]*>\s*(\d{2,3})\s*%\s*similarity[\s\S]*?<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
    )) {
      const similarity = m[1];
      const url = m[2] || "";
      const title = clip(String(m[3] || "").replace(/<[^>]+>/g, " "), 100) || "iqdb 匹配";
      if (Number(similarity) < 50) continue;
      out.push({ title, url, similarity, source: "iqdb" });
      if (out.length >= 6) break;
    }
    if (!out.length) {
      for (const m of html.matchAll(/href="(https?:\/\/(?:danbooru|yande|gelbooru|sankaku|anime-pictures)[^"]+)"/gi)) {
        const url = m[1] || "";
        if (!url || out.some((x) => x.url === url)) continue;
        out.push({ title: "iqdb 候选", url, source: "iqdb" });
        if (out.length >= 4) break;
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function sauceNaoSearch(
  path: string,
  apiKey?: string,
): Promise<ImageTraceResult["sauceNao"]> {
  try {
    const buf = readFileSync(path);
    if (buf.length > 6_000_000) return [];
    const form = new FormData();
    if (apiKey) form.set("api_key", apiKey);
    form.set("output_type", "2");
    form.set("numres", "8");
    form.set("minsim", "50");
    form.set(
      "file",
      new Blob([new Uint8Array(buf)], { type: "application/octet-stream" }),
      `query${extname(path) || ".jpg"}`,
    );
    const res = await fetch("https://saucenao.com/search.php", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(35_000),
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
      const sim = Number(row.header?.similarity || 0);
      if (sim > 0 && sim < 50) continue;
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
      if (out.length >= 8) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** 把反查结果压成给无视觉模型看的中文线索 */
export function formatTraceForLlm(r: ImageTraceResult): string {
  const lines: string[] = [];
  lines.push(`线索摘要：${r.message}`);
  if (r.kindHint && r.kindHint !== "unknown") lines.push(`粗分类：${r.kindHint}`);
  if (r.sha256) lines.push(`文件指纹 sha256前12：${r.sha256.slice(0, 12)}`);
  for (const p of (r.playbook || []).slice(0, 6)) lines.push(`· ${p}`);
  if (r.sauceNao?.length) {
    lines.push("相似度匹配（以图搜源）：");
    for (const s of r.sauceNao.slice(0, 5)) {
      lines.push(
        `  - 相似度${s.similarity || "?"} ${s.title}${s.url ? ` → ${s.url}` : ""}${s.source ? `（${s.source}）` : ""}`,
      );
    }
  }
  if (r.items?.length) {
    lines.push("相关网页：");
    for (const it of r.items.slice(0, 4)) {
      lines.push(`  - ${it.title}${it.url ? ` → ${it.url}` : ""}`);
    }
  }
  if (r.privacyNote) lines.push(`注意：${r.privacyNote}`);
  return lines.join("\n");
}

/**
 * @param opts.blindSimilarity 无视觉：不依赖 OCR，直接相似度/以图搜图
 */
export async function traceImageOrigin(
  path: string,
  opts?: {
    kind?: ImageKind;
    description?: string;
    ocrText?: string;
    publicImageUrl?: string;
    allowPersonReverse?: boolean;
    blindSimilarity?: boolean;
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

  const blind = Boolean(opts?.blindSimilarity);
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

  if (blind) {
    playbook.push(
      "模式：当前模型无视觉，已走「相似度 / 以图搜图」代查。",
      "优先按图匹配；再用命中标题搜网页。",
    );
  }

  if (kind === "person_photo" && !blind) {
    playbook.push("分类：真人/自拍。默认不做公开反搜。");
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
        privacyNote: "真人照默认不上传反搜引擎。主人明确说「反查这张人像」才开。",
      };
    }
    playbook.push("主人已允许对真人照做公开线索检索。");
  } else if (kind === "meme") playbook.push("分类：梗图/表情包。");
  else if (kind === "screenshot") playbook.push("分类：界面截图。");
  else if (kind === "art") playbook.push("分类：插画/二次元。");
  else if (!blind) playbook.push("分类未定。");

  let sauceNao: ImageTraceResult["sauceNao"];
  const sauceKey = String(process.env.SAUCENAO_API_KEY || "").trim();
  const skipPerson =
    kind === "person_photo" && !opts?.allowPersonReverse && !blind;
  if (!skipPerson) {
    sauceNao = await sauceNaoSearch(file, sauceKey || undefined);
    if (!(sauceNao && sauceNao.length) || blind) {
      const iq = await iqdbSearch(file);
      if (iq?.length) {
        const seen = new Set((sauceNao || []).map((x) => x.url || x.title));
        sauceNao = [...(sauceNao || [])];
        for (const row of iq) {
          const key = row.url || row.title;
          if (seen.has(key)) continue;
          seen.add(key);
          sauceNao.push(row);
        }
        playbook.push(`iqdb 补充 ${iq.length} 条`);
      }
    }
    playbook.push(
      sauceNao?.length
        ? `相似度引擎合计 ${sauceNao.length} 条${sauceKey ? "" : "（SauceNAO 未配密钥时额度有限）"}`
        : sauceKey
          ? "SauceNAO / iqdb 暂无可用结果"
          : "相似度暂无结果；可配 SAUCENAO_API_KEY，或换带视觉的模型",
    );
  }

  const titleHints = (sauceNao || [])
    .map((s) => s.title)
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
  const queryParts = [
    kind === "meme" ? "梗图 出处" : kind === "art" ? "插画 来源" : blind ? "图片 出处 梗" : "图片",
    ocr,
    desc,
    titleHints,
  ].filter(Boolean);
  const searchQuery = clip(queryParts.join(" "), 120);
  let items: WebHit[] = [];
  if (searchQuery.length >= 4) {
    const hit = await webSearch(searchQuery);
    items = hit.items || [];
    playbook.push(hit.ok ? `网页线索：${hit.message}` : `网页搜索：${hit.message}`);
  } else if (!blind) {
    playbook.push("缺少 OCR/描述，网页搜索较弱。");
  }

  const pub =
    opts?.publicImageUrl && publicHttpUrl(opts.publicImageUrl)
      ? String(opts.publicImageUrl)
      : "";
  if (pub) {
    playbook.push(
      `Bing 以图搜图：https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:${encodeURIComponent(pub)}`,
    );
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
    message:
      items.length || sauceNao?.length
        ? blind
          ? "无视觉模式下已用相似度搜到线索，请据此用人话回答"
          : "已收集出处线索，请用人话汇总给用户"
        : blind
          ? "无视觉已搜过，相似度线索很少；可换视觉模型或配 SAUCENAO_API_KEY"
          : "线索很少；把视觉描述说清楚再问一次",
    privacyNote:
      kind === "person_photo"
        ? "真人照线索需谨慎传播。"
        : blind
          ? "无视觉无法可靠区分真人照；若像私人自拍请勿公开传播反搜结果。"
          : undefined,
  };
}
