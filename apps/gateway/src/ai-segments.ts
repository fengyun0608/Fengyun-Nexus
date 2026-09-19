/**
 * AI 回复：思考走合并转发；正文按空行分段，最多两条，避免刷屏。
 * 不按句号拆。单段特别长再切。
 */

const HARD_MAX = 900;
const MAX_PARTS = 2;

/** 单独发出毫无意义的符号（模型偶发、或截断残留） */
const JUNK_ONLY = /^[\s丨|｜\-—_~～·.•…。、，,!！?？\u200b\u200c\u200d\ufeff]+$/u;

export function isJunkAiText(text: string): boolean {
  return JUNK_ONLY.test(String(text || "").trim());
}

/** 模型偶发写进正文的「怎么回」提纲，不是给人看的话。 */
function isMetaPlanning(para: string): boolean {
  const t = String(para || "").trim();
  if (!t || t.length > 160) return false;
  if (/^思考[：:]/.test(t)) return true;
  return /^(用.+?(语气|口吻)|不需要调用工具|不要调用工具|只用人话|简短自然|一两句即可|无需工具|不调用工具)/.test(
    t,
  );
}

/** 大段内心独白 / 翻文档过程：应进合并转发，不要当普通气泡。 */
function looksLikeThinking(para: string): boolean {
  const t = String(para || "").trim();
  if (!t) return false;
  if (isMetaPlanning(t)) return true;
  if (
    /我先看|让我|接下来|文档找到了|已经掌握|先列出|我来看|我去看|看一下|读一下|检查一下|再看|继续看|先读|工具结果|技能里|framework-helper|agent-code/.test(
      t,
    )
  ) {
    return true;
  }
  if (t.length < 36) return false;
  return /系统设定|系统说|根据系统|所以我要|身份上要|可以融合|不需要调用工具|当前通道的人设|问[「"]你是谁|用户想查看|我想确认/.test(
    t,
  );
}

/** 真正给人看的收尾回话（不是翻文件过程）。 */
function looksLikeFinalSpeak(para: string): boolean {
  const t = String(para || "").trim();
  if (!t) return false;
  if (/^(让我|我先|接下来|文档找到|已经掌握|先列出)/.test(t)) return false;
  if (/^(喵|主人|好的|好啦|好了|简单说|文档在|插件写法|可以这样写)/.test(t)) return true;
  if (/docs\/[^\s]+|plugins\/templates|nexus\.plugin\.json/.test(t) && !/让我|我先看|再看/.test(t)) {
    return true;
  }
  return false;
}

export function stripMetaPlanning(text: string): string {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s && !isJunkAiText(s) && !isMetaPlanning(s))
    .join("\n\n")
    .trim();
}

/**
 * 拆开「思考：」与给人看的正文。
 * 思考交给合并转发；正文再按空行拆成多条气泡。
 */
export function splitThinkingAndSpeak(text: string): {
  thinkingNodes: string[];
  speak: string;
} {
  let raw = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!raw) return { thinkingNodes: [], speak: "" };

  const tagThink: string[] = [];
  raw = raw
    .replace(/<think>([\s\S]*?)<\/think>/gi, (_, inner: string) => {
      const t = String(inner || "").trim();
      if (t) tagThink.push(t);
      return "\n\n";
    })
    .replace(/<thinking>([\s\S]*?)<\/thinking>/gi, (_, inner: string) => {
      const t = String(inner || "").trim();
      if (t) tagThink.push(t);
      return "\n\n";
    })
    .replace(/<\/?think(?:ing)?>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  let thinking = tagThink.join("\n\n").trim();
  let body = raw;

  // 「思考：」只是标记，后面整段按空行分类；不要只截第一段，否则多段过程会漏进普通气泡
  if (/^思考[：:]/.test(body)) {
    body = body.replace(/^思考[：:]\s*/, "").trim();
  }

  const speakParas = String(body || "")
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s && !isJunkAiText(s));
  const kept: string[] = [];
  for (const p of speakParas) {
    if (looksLikeThinking(p) || isMetaPlanning(p)) {
      thinking = [thinking, p].filter(Boolean).join("\n\n").trim();
      continue;
    }
    if (looksLikeFinalSpeak(p)) {
      kept.push(p);
      continue;
    }
    // 还没出现过收尾回话时，默认当过程，进多段转发
    if (!kept.length) {
      thinking = [thinking, p].filter(Boolean).join("\n\n").trim();
      continue;
    }
    kept.push(p);
  }
  if (
    kept.length &&
    kept.every((p) => looksLikeThinking(p) || /让我|我先|接下来|看一下|读一下/.test(p))
  ) {
    thinking = [thinking, ...kept].filter(Boolean).join("\n\n").trim();
    kept.length = 0;
  }
  const speak = kept.join("\n\n").trim();
  const thinkingNodes = packForwardNodes(thinking);
  return { thinkingNodes, speak };
}

function packForwardNodes(thinking: string): string[] {
  const t = String(thinking || "").trim();
  if (!t) return [];
  const paras = t
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  const nodes: string[] = [];
  for (const p of paras.length ? paras : [t]) {
    if (p.length <= 500) nodes.push(p);
    else {
      for (let i = 0; i < p.length; i += 500) {
        nodes.push(p.slice(i, i + 500).trim());
      }
    }
  }
  return nodes.filter(Boolean).slice(0, 20);
}

export type LeakedToolCall = { name: string; args: Record<string, unknown> };

/**
 * 有的模型不走正式 function call，把 DSML / XML 工具调用写进正文。
 * 抽出来补执行，原文不要发给用户。
 */
export function extractLeakedToolCalls(text: string): LeakedToolCall[] {
  const raw = String(text || "");
  if (!/DSML|tool_calls|invoke\s+name\s*=|function_calls/i.test(raw)) return [];
  const out: LeakedToolCall[] = [];
  const seen = new Set<string>();
  const push = (name: string, args: Record<string, unknown>) => {
    const n = name.trim().replace(/\./g, "_");
    if (!/^nexus_[a-z0-9_]+$/i.test(n)) return;
    const key = `${n}:${JSON.stringify(args)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ name: n, args });
  };

  const invokeRe =
    /name\s*=\s*["'](nexus_[a-zA-Z0-9_.]+)["']([^]*?)(?:<\/[^>\n]*invoke>|<\/invoke>|(?=<[^>\n]*tool_calls)|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = invokeRe.exec(raw))) {
    const body = m[2] || "";
    const args: Record<string, unknown> = {};
    const paramRe = /name\s*=\s*["']([A-Za-z0-9_]+)["'][^>]*>([^<]*)/g;
    let p: RegExpExecArray | null;
    while ((p = paramRe.exec(body))) {
      const key = p[1]!;
      if (key === "name") continue;
      args[key] = (p[2] || "").trim();
    }
    push(m[1]!, args);
  }

  const jsonRe =
    /"name"\s*:\s*"(nexus_[a-zA-Z0-9_.]+)"\s*,\s*"arguments"\s*:\s*(\{[\s\S]*?\})/g;
  while ((m = jsonRe.exec(raw))) {
    try {
      push(m[1]!, JSON.parse(m[2]!) as Record<string, unknown>);
    } catch {
      push(m[1]!, {});
    }
  }
  return out;
}

/** 删掉泄出的工具调用原文，只留人话。 */
export function stripLeakedToolMarkup(text: string): string {
  let s = String(text || "");
  s = s.replace(
    /<[^>\n]{0,80}(?:DSML|tool_calls|tool_call|function_calls|invoke|parameter)[^>]*>[\s\S]*?<\/[^>\n]{0,80}(?:DSML|tool_calls|tool_call|function_calls|invoke|parameter)[^>]*>/gi,
    "",
  );
  s = s
    .split(/\r?\n/)
    .filter((line) => !/DSML|tool_calls|invoke\s+name\s*=|function_calls/i.test(line))
    .join("\n");
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

export function splitAiSegments(text: string): string[] {
  const raw = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!raw) return [];
  if (isJunkAiText(raw)) return [];

  const paras = raw
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s && !isJunkAiText(s));

  if (!paras.length) return [];

  const parts: string[] = [];
  for (const p of paras) {
    if (p.length <= HARD_MAX) parts.push(p);
    else parts.push(...cutHard(p));
  }

  return capParts(parts, MAX_PARTS);
}

function cutHard(s: string): string[] {
  const out: string[] = [];
  let rest = s;
  while (rest.length > HARD_MAX) {
    const window = rest.slice(0, HARD_MAX);
    const breakAt = Math.max(
      window.lastIndexOf("\n"),
      window.lastIndexOf("。"),
      window.lastIndexOf("！"),
      window.lastIndexOf("？"),
      window.lastIndexOf("；"),
      window.lastIndexOf("…"),
      window.lastIndexOf(". "),
    );
    const at = breakAt >= HARD_MAX * 0.4 ? breakAt + 1 : HARD_MAX;
    out.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) out.push(rest);
  return out.filter(Boolean);
}

/** 段数太多时合并相邻短段，保留冒泡感 */
function capParts(parts: string[], max: number): string[] {
  if (parts.length <= max) return parts;
  const merged: string[] = [];
  const bucket = Math.ceil(parts.length / max);
  for (let i = 0; i < parts.length; i += bucket) {
    merged.push(parts.slice(i, i + bucket).join("\n\n"));
  }
  return merged;
}
