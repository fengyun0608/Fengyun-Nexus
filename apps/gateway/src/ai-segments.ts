/**
 * AI 回复按空行分段，但问答最多两条，避免刷屏。
 * 不按句号拆。单段特别长再切。
 */

const HARD_MAX = 900;
const MAX_PARTS = 2;

/** 单独发出毫无意义的符号（模型偶发、或截断残留） */
const JUNK_ONLY = /^[\s丨|｜\-—_~～·.•…。、，,!！?？\u200b\u200c\u200d\ufeff]+$/u;

export function isJunkAiText(text: string): boolean {
  return JUNK_ONLY.test(String(text || "").trim());
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
