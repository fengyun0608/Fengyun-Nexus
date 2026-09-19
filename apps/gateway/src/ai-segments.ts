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
  if (!t || t.length > 120) return false;
  if (/^思考[：:]/.test(t)) return true;
  return /^(用.+?(语气|口吻)|不需要调用工具|不要调用工具|只用人话|简短自然|一两句即可|无需工具|不调用工具)/.test(
    t,
  );
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

  if (/^思考[：:]/.test(body)) {
    const rest = body.replace(/^思考[：:]\s*/, "");
    const sep = rest.search(/\n\n+/);
    if (sep >= 0) {
      const head = rest.slice(0, sep).trim();
      body = rest.slice(sep).replace(/^\n+/, "").trim();
      thinking = [thinking, head].filter(Boolean).join("\n\n").trim();
    } else {
      // 没有空行时不当成整段思考，避免把回话吞掉
      body = rest;
    }
  }

  const speak = stripMetaPlanning(body);
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
