/**
 * AI 回复拆成多条 QQ 消息（按行/按句一段一段发）。
 * 换行必拆；句号/问号在两边都够长时再拆，避免「喵？」单独一条。
 */

const HARD_MAX = 360;
const MAX_PARTS = 8;
const MIN_SIDE = 3;

export function splitAiSegments(text: string): string[] {
  const raw = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!raw) return [];

  const lines = raw
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const parts: string[] = [];
  for (const line of lines) {
    parts.push(...splitBreaths(line));
  }

  const flat = parts.map((p) => p.trim()).filter(Boolean);
  if (!flat.length) return [raw];

  const capped = capParts(flat, MAX_PARTS);
  const out: string[] = [];
  for (const p of capped) {
    if (p.length <= HARD_MAX) out.push(p);
    else out.push(...cutHard(p));
  }
  return out.length ? out : [raw];
}

/** 按「一口气」切开：。！？…～ */
function splitBreaths(s: string): string[] {
  const marks = new Set(["。", "！", "？", "!", "?", "…", "～"]);
  const cuts: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (!marks.has(ch)) continue;
    // 吃掉连续标点
    let end = i + 1;
    while (end < s.length && marks.has(s[end])) end += 1;
    const left = s.slice(0, end).trim();
    const right = s.slice(end).trim();
    if (!right) break;
    // 「喵？」太短不切；右边也太短不切
    if (left.length >= MIN_SIDE && right.length >= MIN_SIDE) {
      cuts.push(end);
    }
    i = end - 1;
  }
  if (!cuts.length) return [s];
  const out: string[] = [];
  let prev = 0;
  for (const c of cuts) {
    const piece = s.slice(prev, c).trim();
    if (piece) out.push(piece);
    prev = c;
  }
  const last = s.slice(prev).trim();
  if (last) out.push(last);
  return out.length ? out : [s];
}

function capParts(parts: string[], max: number): string[] {
  if (parts.length <= max) return parts;
  const out = parts.slice(0, max - 1);
  out.push(parts.slice(max - 1).join("\n"));
  return out;
}

function cutHard(s: string): string[] {
  const out: string[] = [];
  let rest = s;
  while (rest.length > HARD_MAX) {
    let cut = HARD_MAX;
    const window = rest.slice(0, HARD_MAX);
    for (const m of ["。", "！", "？", "\n", "；", "，", " "]) {
      const i = window.lastIndexOf(m);
      if (i > HARD_MAX * 0.4) {
        cut = i + m.length;
        break;
      }
    }
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out.filter(Boolean);
}
