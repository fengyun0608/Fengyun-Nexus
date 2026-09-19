/**
 * AI 回复尽量一条发出，避免刷屏。
 * 不按句号、不按空行拆。只有特别长时才切成很少的几段。
 */

const SOFT = 4000;

export function splitAiSegments(text: string): string[] {
  const raw = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!raw) return [];
  if (raw.length <= SOFT) return [raw];

  const paras = raw
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (paras.length <= 1) return [raw];

  const out: string[] = [];
  let buf = "";
  for (const p of paras) {
    const next = buf ? `${buf}\n\n${p}` : p;
    if (buf && next.length > SOFT) {
      out.push(buf);
      buf = p;
    } else {
      buf = next;
    }
  }
  if (buf) out.push(buf);
  return out.length ? out : [raw];
}
