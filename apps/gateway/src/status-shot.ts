/**
 * #状态 面板：系统信息 + 资源环（出图用 HTML）。
 * 重启成功报告仍用行列表。
 */
import {
  cpus,
  freemem,
  hostname,
  loadavg,
  networkInterfaces,
  platform,
  release,
  totalmem,
  type,
  uptime as osUptime,
} from "node:os";
import { memoryUsage } from "node:process";

export type StatusShotInput = {
  version: string;
  commit?: string;
  envId: string;
  envLabel: string;
  powerOff: boolean;
  uptime: string;
  gatewayPort?: number;
  onebot: {
    enabled: boolean;
    connected: boolean;
    selfId: string;
    clients: number;
  };
  ai: {
    hasKey: boolean;
    activeName?: string;
    model?: string;
  };
  pluginsEnabled: number;
  pluginsTotal: number;
  replyGroupIds: string[];
  notifyGroupIds: string[];
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function localIpv4List(): string[] {
  const out: string[] = [];
  const nets = networkInterfaces();
  for (const list of Object.values(nets)) {
    if (!list) continue;
    for (const n of list) {
      if (n.family !== "IPv4" || n.internal) continue;
      out.push(n.address);
    }
  }
  return out;
}

function fmtGroups(ids: string[], empty: string): string {
  if (!ids.length) return empty;
  if (ids.length <= 3) return ids.join("、");
  return `${ids.slice(0, 3).join("、")} 等 ${ids.length} 个`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function formatOsUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d) return `${d}天${h}时`;
  if (h) return `${h}时${m}分`;
  return `${m}分`;
}

function cpuPercent(): number {
  const list = cpus();
  if (!list.length) return 0;
  let idle = 0;
  let total = 0;
  for (const c of list) {
    const t = Object.values(c.times).reduce((a, b) => a + b, 0);
    idle += c.times.idle;
    total += t;
  }
  if (!total) return 0;
  const avg = Math.round((1 - idle / total) * 100);
  const la = loadavg()[0];
  if (Number.isFinite(la) && la > 0) {
    return Math.min(100, Math.max(avg, Math.round((la / list.length) * 100)));
  }
  return Math.min(100, Math.max(0, avg));
}

function ringColor(p: number): string {
  if (p >= 90) return "#c45c4a";
  if (p >= 70) return "#e8a54b";
  return "#6f9b6a";
}

export type OsMetrics = {
  cpuPct: number;
  memPct: number;
  memUsed: string;
  memTotal: string;
  nodePct: number;
  nodeUsed: string;
  nodeTotal: string;
  osMain: string;
  osSecondary: string;
  host: string;
  sysUptime: string;
  cpuModel: string;
  cores: number;
};

export function collectOsMetrics(): OsMetrics {
  const tot = totalmem();
  const free = freemem();
  const used = tot - free;
  const memPct = tot ? Math.round((used / tot) * 100) : 0;
  const mu = memoryUsage();
  const heapTot = mu.heapTotal || 1;
  const nodePct = Math.round((mu.heapUsed / heapTot) * 100);
  const cpuList = cpus();
  const model = (cpuList[0]?.model || "CPU").replace(/\s+/g, " ").trim();
  return {
    cpuPct: cpuPercent(),
    memPct,
    memUsed: formatBytes(used),
    memTotal: formatBytes(tot),
    nodePct,
    nodeUsed: formatBytes(mu.heapUsed),
    nodeTotal: formatBytes(heapTot),
    osMain: `${type()} ${release()}`,
    osSecondary: platform(),
    host: hostname(),
    sysUptime: formatOsUptime(osUptime()),
    cpuModel: model.length > 36 ? `${model.slice(0, 34)}…` : model,
    cores: cpuList.length,
  };
}

/** 纯文本回退 */
export function buildStatusLines(s: StatusShotInput): string[] {
  const os = collectOsMetrics();
  const ips = localIpv4List();
  const lines: string[] = [];
  lines.push(`框架 Fengyun Nexus ${s.version}`);
  if (s.commit) lines.push(`提交 ${s.commit}`);
  lines.push(`姿态 ${s.envLabel}（${s.envId}）`);
  lines.push(s.powerOff ? "电源 已关机" : `电源 运行中 · ${s.uptime}`);
  lines.push(`系统 ${os.osMain} · 主机 ${os.host}`);
  lines.push(`资源 CPU ${os.cpuPct}% · 内存 ${os.memPct}% · Node ${os.nodePct}%`);
  if (s.gatewayPort) {
    lines.push(
      ips.length
        ? `网络 ${ips[0]} · 网关 :${s.gatewayPort}`
        : `网络 网关 :${s.gatewayPort}`,
    );
  }
  if (s.onebot.enabled) {
    lines.push(
      s.onebot.connected
        ? `OneBot 已连接 · QQ ${s.onebot.selfId || "—"}`
        : `OneBot 未连接`,
    );
  } else {
    lines.push("OneBot 未启用");
  }
  lines.push(
    s.ai.hasKey
      ? `AI ${s.ai.activeName || "已配置"}${s.ai.model ? ` · ${s.ai.model}` : ""}`
      : "AI 未配置密钥",
  );
  lines.push(`插件 ${s.pluginsEnabled}/${s.pluginsTotal}`);
  lines.push(`AI 回复群 ${fmtGroups(s.replyGroupIds, "不限")}`);
  lines.push(`通知群 ${fmtGroups(s.notifyGroupIds, "无")}`);
  return lines;
}

function ringHtml(title: string, pct: number, detail: string): string {
  const p = Math.min(100, Math.max(0, pct));
  const c = ringColor(p);
  return `<div class="ring-card">
  <div class="ring" style="--p:${p};--c:${c}"><span>${p}%</span></div>
  <div class="ring-meta">
    <strong>${escapeHtml(title)}</strong>
    <p>${escapeHtml(detail)}</p>
  </div>
</div>`;
}

function cell(label: string, main: string, sub?: string): string {
  return `<div class="cell">
  <div class="cell-label">${escapeHtml(label)}</div>
  <div class="cell-main">${escapeHtml(main)}</div>
  ${sub ? `<div class="cell-sub">${escapeHtml(sub)}</div>` : ""}
</div>`;
}

/** 状态面板 HTML（截 #panel） */
export function buildStatusPanelHtml(s: StatusShotInput): string {
  const os = collectOsMetrics();
  const ips = localIpv4List();
  const online = !s.powerOff && (!s.onebot.enabled || s.onebot.connected);
  const statusLabel = s.powerOff ? "已关机" : online ? "运行中" : "待连接";
  const statusTone = s.powerOff ? "off" : online ? "on" : "wait";

  const botChips = [
    `v${s.version}`,
    s.commit ? `#${s.commit}` : "",
    s.envLabel,
    s.uptime,
  ]
    .filter(Boolean)
    .map((t) => `<span class="chip">${escapeHtml(t)}</span>`)
    .join("");

  const qqLine = s.onebot.enabled
    ? s.onebot.connected
      ? `QQ ${s.onebot.selfId || "—"} · ${s.onebot.clients} 路`
      : "OneBot 未连接"
    : "OneBot 未启用";

  const aiLine = s.ai.hasKey
    ? `${s.ai.activeName || "AI"}${s.ai.model ? ` · ${s.ai.model}` : ""}`
    : "未配置密钥";

  const netLine = ips.length
    ? `${ips[0]}${s.gatewayPort ? ` · :${s.gatewayPort}` : ""}`
    : s.gatewayPort
      ? `网关 :${s.gatewayPort}`
      : "—";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>运行状态</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 28px;
    font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    background: linear-gradient(160deg, #dfe6df 0%, #c5d0c8 45%, #b8c4bc 100%);
    color: #2c322c;
  }
  #panel {
    width: 760px; margin: 0 auto;
    display: grid; gap: 12px;
  }
  .box {
    background: rgba(255,255,255,.92);
    border-radius: 16px;
    padding: 16px 18px;
    box-shadow: 0 10px 28px rgba(40,50,40,.12);
  }
  .bot {
    display: flex; align-items: center; gap: 14px;
  }
  .avatar {
    width: 64px; height: 64px; border-radius: 50%;
    background: linear-gradient(145deg, #e8a54b, #8fad7a);
    display: grid; place-items: center;
    color: #fff; font-weight: 800; font-size: 22px;
    position: relative; flex-shrink: 0;
  }
  .dot {
    position: absolute; right: 2px; bottom: 2px;
    width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid #fff;
  }
  .dot.on { background: #6f9b6a; }
  .dot.wait { background: #e8a54b; }
  .dot.off { background: #9a9a9a; }
  .bot h1 {
    margin: 0 0 6px; font-size: 22px; font-weight: 700;
  }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    font-size: 12px; padding: 3px 10px; border-radius: 999px;
    background: #f4efe6; color: #5a5040;
  }
  .badge {
    display: inline-block; margin-top: 8px;
    font-size: 12px; padding: 2px 10px; border-radius: 999px;
    font-weight: 600;
  }
  .badge.on { background: #e5f2e3; color: #3d6b3a; }
  .badge.wait { background: #f8ecd9; color: #8a5a20; }
  .badge.off { background: #ececec; color: #666; }
  .grid4 {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
  }
  .cell-label { font-size: 12px; color: #7a827a; margin-bottom: 4px; }
  .cell-main { font-size: 15px; font-weight: 700; line-height: 1.35; }
  .cell-sub { font-size: 11px; color: #8a9088; margin-top: 2px; }
  .sec-title {
    font-size: 13px; font-weight: 700; color: #5a635a;
    margin-bottom: 12px; letter-spacing: .04em;
  }
  .rings {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
  }
  .ring-card { display: flex; align-items: center; gap: 12px; }
  .ring {
    --p: 0; --c: #6f9b6a;
    width: 88px; height: 88px; border-radius: 50%; flex-shrink: 0;
    background: conic-gradient(var(--c) calc(var(--p) * 1%), #e8ebe6 0);
    display: grid; place-items: center;
  }
  .ring::before {
    content: ""; width: 64px; height: 64px; border-radius: 50%;
    background: #fff; grid-area: 1 / 1;
    box-shadow: inset 0 0 0 1px rgba(0,0,0,.04);
  }
  .ring span {
    grid-area: 1 / 1; z-index: 1; font-weight: 800; font-size: 16px;
  }
  .ring-meta strong { display: block; font-size: 14px; margin-bottom: 4px; }
  .ring-meta p { margin: 0; font-size: 11px; color: #7a827a; line-height: 1.4; }
  .foot {
    display: flex; flex-wrap: wrap; gap: 8px 16px;
    font-size: 12px; color: #5a635a;
  }
  .foot b { color: #2c322c; }
</style>
</head>
<body>
  <div id="panel">
    <div class="box bot">
      <div class="avatar">N<span class="dot ${statusTone}"></span></div>
      <div>
        <h1>Fengyun Nexus</h1>
        <div class="chips">${botChips}</div>
        <span class="badge ${statusTone}">${escapeHtml(statusLabel)}</span>
      </div>
    </div>

    <div class="box grid4">
      ${cell("系统", os.osMain, os.osSecondary)}
      ${cell("主机", os.host, `系统已运行 ${os.sysUptime}`)}
      ${cell("网络", netLine, qqLine)}
      ${cell("AI / 插件", aiLine, `${s.pluginsEnabled}/${s.pluginsTotal} 已启用`)}
    </div>

    <div class="box">
      <div class="sec-title">资源使用</div>
      <div class="rings">
        ${ringHtml("CPU", os.cpuPct, `${os.cores} 核 · ${os.cpuModel}`)}
        ${ringHtml("内存", os.memPct, `${os.memUsed} / ${os.memTotal}`)}
        ${ringHtml("Node", os.nodePct, `堆 ${os.nodeUsed} / ${os.nodeTotal}`)}
      </div>
    </div>

    <div class="box foot">
      <span>AI 回复群 <b>${escapeHtml(fmtGroups(s.replyGroupIds, "不限"))}</b></span>
      <span>通知群 <b>${escapeHtml(fmtGroups(s.notifyGroupIds, "无"))}</b></span>
    </div>
  </div>
</body>
</html>`;
}

/** 重启成功 · 插件加载报告行（再渲成图） */
export function buildRestartOkLines(
  plugins: Array<{ id: string; name: string; version?: string }>,
  opts?: {
    previousUptime?: string;
    version?: string;
    commit?: string;
    updateSummary?: string[];
  },
): string[] {
  const lines: string[] = ["重启成功"];
  if (opts?.version) lines.push(`框架 ${opts.version}`);
  if (opts?.commit) lines.push(`提交 ${opts.commit}`);
  if (opts?.previousUptime) lines.push(`上次运行 ${opts.previousUptime}`);
  const summary = (opts?.updateSummary || []).map((s) => String(s).trim()).filter(Boolean);
  if (summary.length) {
    lines.push("刚才更新了这些");
    for (const s of summary.slice(0, 16)) {
      lines.push(`· ${s}`);
    }
    if (summary.length > 16) lines.push(`· …另有 ${summary.length - 16} 条`);
  }
  lines.push("本次加载插件");
  if (!plugins.length) {
    lines.push("· 无");
  } else {
    for (const p of plugins) {
      const ver = p.version ? ` @${p.version}` : "";
      lines.push(`· ${p.name}${ver}`);
    }
  }
  lines.push(`共 ${plugins.length} 个`);
  return lines;
}

/** 重启成功面板 HTML（与 #状态 同视觉，截 #panel） */
export function buildRestartOkPanelHtml(
  plugins: Array<{ id: string; name: string; version?: string }>,
  opts?: {
    previousUptime?: string;
    version?: string;
    commit?: string;
    updateSummary?: string[];
  },
): string {
  const summary = (opts?.updateSummary || []).map((s) => String(s).trim()).filter(Boolean);
  const chips = [
    opts?.version ? `v${opts.version}` : "",
    opts?.commit ? `#${opts.commit}` : "",
    opts?.previousUptime ? `上次 ${opts.previousUptime}` : "",
  ]
    .filter(Boolean)
    .map((t) => `<span class="chip">${escapeHtml(t)}</span>`)
    .join("");

  const summaryHtml = summary.length
    ? `<div class="box">
      <div class="sec-title">刚才更新了这些</div>
      <ul class="list">${summary
        .slice(0, 16)
        .map((s) => `<li>${escapeHtml(s)}</li>`)
        .join("")}${
        summary.length > 16
          ? `<li class="more">…另有 ${summary.length - 16} 条</li>`
          : ""
      }</ul>
    </div>`
    : "";

  const pluginHtml = plugins.length
    ? plugins
        .map((p) => {
          const ver = p.version ? ` @${p.version}` : "";
          return `<li>${escapeHtml(p.name)}${escapeHtml(ver)}</li>`;
        })
        .join("")
    : `<li>无</li>`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>重启成功</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 28px;
    font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    background: linear-gradient(160deg, #dfe6df 0%, #c5d0c8 45%, #b8c4bc 100%);
    color: #2c322c;
  }
  #panel {
    width: 760px; margin: 0 auto;
    display: grid; gap: 12px;
  }
  .box {
    background: rgba(255,255,255,.92);
    border-radius: 16px;
    padding: 16px 18px;
    box-shadow: 0 10px 28px rgba(40,50,40,.12);
  }
  .bot {
    display: flex; align-items: center; gap: 14px;
  }
  .avatar {
    width: 64px; height: 64px; border-radius: 50%;
    background: linear-gradient(145deg, #e8a54b, #8fad7a);
    display: grid; place-items: center;
    color: #fff; font-weight: 800; font-size: 22px;
    position: relative; flex-shrink: 0;
  }
  .dot {
    position: absolute; right: 2px; bottom: 2px;
    width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid #fff; background: #6f9b6a;
  }
  .bot h1 {
    margin: 0 0 6px; font-size: 22px; font-weight: 700;
  }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    font-size: 12px; padding: 3px 10px; border-radius: 999px;
    background: #f4efe6; color: #5a5040;
  }
  .badge {
    display: inline-block; margin-top: 8px;
    font-size: 12px; padding: 2px 10px; border-radius: 999px;
    font-weight: 600; background: #e5f2e3; color: #3d6b3a;
  }
  .sec-title {
    font-size: 13px; font-weight: 700; color: #5a635a;
    margin-bottom: 12px; letter-spacing: .04em;
  }
  .list {
    margin: 0; padding-left: 18px;
    font-size: 14px; line-height: 1.55;
  }
  .list .more { color: #7a827a; list-style: none; margin-left: -18px; }
  .foot {
    font-size: 12px; color: #5a635a;
  }
  .foot b { color: #2c322c; }
</style>
</head>
<body>
  <div id="panel">
    <div class="box bot">
      <div class="avatar">N<span class="dot"></span></div>
      <div>
        <h1>重启成功</h1>
        <div class="chips">${chips}</div>
        <span class="badge">已加载新版本</span>
      </div>
    </div>
    ${summaryHtml}
    <div class="box">
      <div class="sec-title">本次加载插件</div>
      <ul class="list">${pluginHtml}</ul>
      <p class="foot" style="margin:12px 0 0">共 <b>${plugins.length}</b> 个</p>
    </div>
  </div>
</body>
</html>`;
}
