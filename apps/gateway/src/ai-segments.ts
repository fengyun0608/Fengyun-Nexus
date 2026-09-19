/**
 * AI 回复：思考走合并转发；正文按空行/分类拆成多条短气泡。
 */

const HARD_MAX = 420;
const MAX_PARTS = 5;

/** 单独发出毫无意义的符号（模型偶发、或截断残留） */
const JUNK_ONLY = /^[\s丨|｜\-—_~～·.•…。、，,!！?？\u200b\u200c\u200d\ufeff]+$/u;

export function isJunkAiText(text: string): boolean {
  return JUNK_ONLY.test(String(text || "").trim());
}

/**
 * 只按标签拆：<think> / <thinking> 进合并转发，标签外才是回话。
 * 不靠句子猜测。
 */
export function splitThinkingAndSpeak(text: string): {
  thinkingNodes: string[];
  speak: string;
} {
  let raw = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!raw) return { thinkingNodes: [], speak: "" };

  const chunks: string[] = [];
  const pull = (re: RegExp) => {
    raw = raw.replace(re, (_, inner: string) => {
      const t = String(inner || "").trim();
      if (t) chunks.push(t);
      return "\n\n";
    });
  };
  pull(/<think>([\s\S]*?)<\/think>/gi);
  pull(/<thinking>([\s\S]*?)<\/thinking>/gi);
  raw = raw
    .replace(/<\/?think(?:ing)?>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const speak = raw
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s && !isJunkAiText(s))
    .join("\n\n")
    .trim();
  return { thinkingNodes: packForwardNodes(chunks.join("\n\n")), speak };
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

  let paras = raw
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s && !isJunkAiText(s));

  // 一大整块时，按「xx类」等小标题再拆，方便多段短气泡
  if (paras.length === 1) {
    paras = explodeBySections(paras[0]!);
  } else {
    paras = paras.flatMap((p) => (p.length > HARD_MAX || /^.+类/m.test(p) ? explodeBySections(p) : [p]));
  }

  const parts: string[] = [];
  for (const p of paras) {
    if (!p || isJunkAiText(p)) continue;
    if (p.length <= HARD_MAX) parts.push(p);
    else parts.push(...cutHard(p));
  }

  return capParts(parts, MAX_PARTS);
}

/** 按分类小标题拆开一整段列表回复。 */
function explodeBySections(block: string): string[] {
  const lines = String(block || "").split(/\n/);
  if (lines.length < 2) return [block.trim()].filter(Boolean);

  const isHead = (line: string) => {
    const t = line.trim();
    if (!t || t.length > 80) return false;
    if (/^.+类[：:]/.test(t)) return true;
    if (/^.+类[：:]?\s*$/.test(t)) return true;
    if (/^[【\[]?.{1,12}[】\]]?[：:]\s*$/.test(t)) return true;
    if (/^[一二三四五六七八九十\d]+[、.．]/.test(t)) return true;
    if (/^\*\*[^*]{1,20}\*\*/.test(t)) return true;
    return false;
  };

  const chunks: string[] = [];
  let buf: string[] = [];
  for (const line of lines) {
    if (isHead(line) && buf.some((x) => x.trim())) {
      chunks.push(buf.join("\n").trim());
      buf = [line];
    } else {
      buf.push(line);
    }
  }
  if (buf.some((x) => x.trim())) chunks.push(buf.join("\n").trim());

  if (chunks.length >= 2) {
    const last = chunks[chunks.length - 1]!;
    const q = last.match(/^([\s\S]+?)\n((?:需要|要不要|要我|请问).+[吗麼么][？?]?.*)$/);
    if (q) {
      chunks[chunks.length - 1] = q[1]!.trim();
      chunks.push(q[2]!.trim());
    }
    return chunks.filter(Boolean);
  }

  // 仍是一块：开场句单独一条，后面再切
  const m = block.match(/^([\s\S]{8,80}?[。！？~～])\s*\n([\s\S]+)$/);
  if (m) return [m[1]!.trim(), ...explodeBySections(m[2]!.trim())].filter(Boolean);

  return [block.trim()].filter(Boolean);
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
