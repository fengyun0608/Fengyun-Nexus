/**
 * 把 AI 整段回复拆成多条，QQ 里一段一段冒出来（接近师傅那边流式多段）。
 * 不追求真 SSE 到 QQ，先按空行/标点切。
 */

const SOFT_MAX = 280;
const HARD_MAX = 420;

/** 按空行切段，再把过长段在句号附近切开 */
export function splitAiSegments(text: string): string[] {
  const raw = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!raw) return [];

  const blocks = raw
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const block of blocks) {
    if (block.length <= HARD_MAX) {
      out.push(block);
      continue;
    }
    out.push(...cutLong(block));
  }

  // 单段太长也拆；太碎的短段合一下
  return mergeTiny(out);
}

function cutLong(s: string): string[] {
  const parts: string[] = [];
  let rest = s;
  while (rest.length > HARD_MAX) {
    const window = rest.slice(0, HARD_MAX);
    let cut = findBreak(window);
    if (cut < SOFT_MAX * 0.4) cut = HARD_MAX;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts.filter(Boolean);
}

function findBreak(s: string): number {
  const marks = ["\n", "。", "！", "？", "；", "…", ".", "!", "?", ";", "，", ","];
  for (const m of marks) {
    const i = s.lastIndexOf(m);
    if (i >= SOFT_MAX * 0.45) return i + m.length;
  }
  const sp = s.lastIndexOf(" ");
  if (sp >= SOFT_MAX * 0.45) return sp + 1;
  return s.length;
}

function mergeTiny(parts: string[]): string[] {
  if (parts.length <= 1) return parts;
  const out: string[] = [];
  let buf = "";
  for (const p of parts) {
    if (!buf) {
      buf = p;
      continue;
    }
    if (buf.length + p.length + 1 < SOFT_MAX * 0.7) {
      buf = `${buf}\n${p}`;
    } else {
      out.push(buf);
      buf = p;
    }
  }
  if (buf) out.push(buf);
  return out;
}
