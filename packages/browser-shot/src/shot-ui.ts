/**
 * 系统截图统一视觉：墨色底 + 琥珀标题 + 鼠尾草绿点缀。
 * 菜单 / 状态 / 重启成功共用，避免各画各的。
 */

export function escapeShotHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 出图壳层 CSS（配合 #panel 或 #shot） */
export function nexusShotCss(): string {
  return `
  :root {
    --bg0: #0f1410;
    --bg1: #1a1f18;
    --ink: #f2efe6;
    --muted: #a7b0a0;
    --line: rgba(232,165,75,.22);
    --amber: #e8a54b;
    --amber2: #c4842f;
    --sage: #8fad7a;
    --danger: #d4644a;
    --ok: #6f9b6a;
    --warn: #e0a045;
    --card: rgba(0,0,0,.38);
    --tile: rgba(255,255,255,.035);
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 36px 32px;
    font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    color: var(--ink);
    background:
      radial-gradient(820px 380px at 12% -8%, rgba(232,165,75,.16), transparent 55%),
      radial-gradient(640px 340px at 100% 0%, rgba(143,173,122,.12), transparent 50%),
      linear-gradient(155deg, var(--bg1) 0%, var(--bg0) 55%, #161c14 100%);
  }
  #panel, #shot {
    width: 780px;
    margin: 0 auto;
    display: grid;
    gap: 14px;
  }
  .card {
    position: relative;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: var(--card);
    padding: 20px 22px;
    box-shadow: 0 18px 48px rgba(0,0,0,.35);
    overflow: hidden;
  }
  .card::before {
    content: "";
    position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
    background: linear-gradient(180deg, var(--amber), var(--sage));
    opacity: .9;
  }
  .brand {
    font-size: 12px;
    letter-spacing: .2em;
    text-transform: uppercase;
    color: var(--sage);
    font-weight: 700;
    margin: 0 0 6px;
  }
  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
  }
  .head h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 750;
    color: var(--amber);
    letter-spacing: -.02em;
    line-height: 1.15;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    font-weight: 700;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid transparent;
    white-space: nowrap;
  }
  .badge::before {
    content: "";
    width: 8px; height: 8px; border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 0 3px rgba(255,255,255,.06);
  }
  .badge.on { color: var(--ok); background: rgba(111,155,106,.14); border-color: rgba(111,155,106,.28); }
  .badge.wait { color: var(--warn); background: rgba(224,160,69,.12); border-color: rgba(224,160,69,.28); }
  .badge.off { color: #9aa29a; background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.08); }
  .chips {
    display: flex; flex-wrap: wrap; gap: 7px;
    margin-top: 14px;
  }
  .chip {
    font-size: 12px;
    padding: 4px 11px;
    border-radius: 999px;
    color: var(--muted);
    background: var(--tile);
    border: 1px solid rgba(232,165,75,.12);
  }
  .sec {
    font-size: 11px;
    font-weight: 750;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: var(--muted);
    margin: 0 0 14px;
  }
  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .tile {
    padding: 14px 14px 12px;
    border-radius: 14px;
    background: var(--tile);
    border: 1px solid rgba(232,165,75,.1);
    min-height: 88px;
  }
  .tile-k {
    font-size: 11px;
    color: var(--muted);
    letter-spacing: .06em;
    margin-bottom: 8px;
    font-weight: 600;
  }
  .tile-v {
    font-size: 16px;
    font-weight: 700;
    line-height: 1.35;
    word-break: break-word;
  }
  .tile-s {
    margin-top: 6px;
    font-size: 12px;
    color: var(--muted);
    line-height: 1.4;
  }
  .meters { display: grid; gap: 14px; }
  .meter-row {
    display: grid;
    grid-template-columns: 72px 1fr;
    gap: 12px;
    align-items: center;
  }
  .meter-name {
    font-size: 14px;
    font-weight: 700;
    color: var(--ink);
  }
  .meter-main { min-width: 0; }
  .meter-top {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 7px;
    font-size: 12px;
    color: var(--muted);
  }
  .meter-top b { color: var(--ink); font-size: 14px; font-weight: 750; }
  .track {
    height: 10px;
    border-radius: 999px;
    background: rgba(255,255,255,.06);
    overflow: hidden;
    border: 1px solid rgba(255,255,255,.04);
  }
  .fill {
    height: 100%;
    border-radius: 999px;
    width: var(--w, 0%);
    background: linear-gradient(90deg, var(--c1), var(--c2));
  }
  .foot {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 18px;
    align-items: center;
    font-size: 12px;
    color: var(--muted);
  }
  .foot b { color: var(--ink); font-weight: 700; }
  .stamp { margin-left: auto; opacity: .75; }
  .list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 8px;
  }
  .list li {
    padding: 11px 13px;
    border-radius: 12px;
    border: 1px solid rgba(232,165,75,.12);
    background: var(--tile);
    font-size: 14px;
    line-height: 1.45;
  }
  .list .more { color: var(--muted); }
  .menu-list {
    list-style: none; margin: 0; padding: 0; display: grid; gap: 10px;
  }
  .menu-list li {
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid rgba(232,165,75,.15);
    background: rgba(255,255,255,.03);
    font-size: 16px; line-height: 1.45;
  }
  .menu-list li span { white-space: pre-wrap; }
`;
}

export function meterBarHtml(
  name: string,
  pct: number,
  detail: string,
): string {
  const p = Math.min(100, Math.max(0, Math.round(pct)));
  let c1 = "#6f9b6a";
  let c2 = "#8fad7a";
  if (p >= 90) {
    c1 = "#c45c4a";
    c2 = "#d4644a";
  } else if (p >= 70) {
    c1 = "#c4842f";
    c2 = "#e8a54b";
  }
  return `<div class="meter-row">
  <div class="meter-name">${escapeShotHtml(name)}</div>
  <div class="meter-main">
    <div class="meter-top"><span>${escapeShotHtml(detail)}</span><b>${p}%</b></div>
    <div class="track"><div class="fill" style="--w:${p}%;--c1:${c1};--c2:${c2}"></div></div>
  </div>
</div>`;
}

export function tileHtml(label: string, main: string, sub?: string): string {
  return `<div class="tile">
  <div class="tile-k">${escapeShotHtml(label)}</div>
  <div class="tile-v">${escapeShotHtml(main)}</div>
  ${sub ? `<div class="tile-s">${escapeShotHtml(sub)}</div>` : ""}
</div>`;
}
