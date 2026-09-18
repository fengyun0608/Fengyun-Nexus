/**
 * #状态 面板：系统信息 + 资源环（出图用 HTML）。
 * server 姿态不展示本机 IP；mobile / desktop / termux 可展示。
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
import { getHeapStatistics } from "node:v8";

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
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** server 部署不展示本机 IP，其它姿态可展示 */
export function shouldExposeLocalIp(envId: string): boolean {
  return String(envId || "").toLowerCase() !== "server";
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
  if (p >= 70) return "#d4923a";
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
  // heapTotal 只是当前已扩容的堆，常用到 80%+ 很正常，不当成堵塞
  const heapLimit = getHeapStatistics().heap_size_limit || mu.heapTotal || 1;
  const nodePct = Math.min(100, Math.round((mu.heapUsed / heapLimit) * 100));
  const cpuList = cpus();
  const model = (cpuList[0]?.model || "CPU").replace(/\s+/g, " ").trim();
  return {
    cpuPct: cpuPercent(),
    memPct,
    memUsed: formatBytes(used),
    memTotal: formatBytes(tot),
    nodePct,
    nodeUsed: formatBytes(mu.heapUsed),
    nodeTotal: formatBytes(heapLimit),
    osMain: `${type()} ${release()}`,
    osSecondary: platform(),
    host: hostname(),
    sysUptime: formatOsUptime(osUptime()),
    cpuModel: model.length > 36 ? `${model.slice(0, 34)}…` : model,
    cores: cpuList.length,
  };
}

function networkDisplay(s: StatusShotInput): { main: string; sub: string } {
  const showIp = shouldExposeLocalIp(s.envId);
  const ips = showIp ? localIpv4List() : [];
  const port = s.gatewayPort ? `:${s.gatewayPort}` : "";
  if (showIp && ips.length) {
    return {
      main: ips[0],
      sub: port ? `网关 ${port}` : "本机地址",
    };
  }
  if (s.gatewayPort) {
    return {
      main: `网关 ${port}`,
      sub: showIp ? "未检测到外网卡地址" : "服务器姿态 · 地址已隐藏",
    };
  }
  return {
    main: showIp ? "—" : "已隐藏",
    sub: showIp ? "无网络信息" : "服务器姿态",
  };
}

/** 纯文本回退 */
export function buildStatusLines(s: StatusShotInput): string[] {
  const os = collectOsMetrics();
  const net = networkDisplay(s);
  const lines: string[] = [];
  lines.push(`框架 Fengyun Nexus ${s.version}`);
  lines.push(`姿态 ${s.envLabel}（${s.envId}）`);
  lines.push(s.powerOff ? "电源 已关机" : `电源 运行中 · ${s.uptime}`);
  lines.push(`系统 ${os.osMain} · 主机 ${os.host}`);
  lines.push(`资源 CPU ${os.cpuPct}% · 内存 ${os.memPct}% · Node ${os.nodePct}%`);
  lines.push(`网络 ${net.main}${net.sub ? ` · ${net.sub}` : ""}`);
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

function panelChromeCss(): string {
  return `
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 32px 28px;
    font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    color: #243028;
    background:
      radial-gradient(900px 420px at 8% -10%, rgba(232,165,75,.22), transparent 55%),
      radial-gradient(720px 380px at 100% 0%, rgba(143,173,122,.2), transparent 50%),
      linear-gradient(165deg, #e8eee8 0%, #d3ddd6 48%, #c4d0c8 100%);
  }
  #panel {
    width: 780px; margin: 0 auto;
    display: grid; gap: 14px;
  }
  .box {
    position: relative;
    background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(252,250,246,.94));
    border-radius: 18px;
    padding: 18px 20px;
    box-shadow:
      0 1px 0 rgba(255,255,255,.7) inset,
      0 12px 32px rgba(36,48,40,.1);
    border: 1px solid rgba(90,110,90,.08);
  }
  .bot {
    display: flex; align-items: center; gap: 16px;
    overflow: hidden;
  }
  .bot::before {
    content: "";
    position: absolute; left: 0; top: 0; bottom: 0; width: 5px;
    background: linear-gradient(180deg, #e8a54b, #8fad7a);
    border-radius: 18px 0 0 18px;
  }
  .avatar {
    width: 72px; height: 72px; border-radius: 22px;
    background: linear-gradient(145deg, #e8a54b 0%, #c4842f 42%, #8fad7a 100%);
    display: grid; place-items: center;
    color: #fff; font-weight: 800; font-size: 26px;
    letter-spacing: -.02em;
    position: relative; flex-shrink: 0;
    box-shadow: 0 8px 18px rgba(196,132,47,.28);
  }
  .dot {
    position: absolute; right: -2px; bottom: -2px;
    width: 16px; height: 16px; border-radius: 50%;
    border: 3px solid #fff;
    box-shadow: 0 1px 4px rgba(0,0,0,.12);
  }
  .dot.on { background: #5f9658; }
  .dot.wait { background: #e0a045; }
  .dot.off { background: #9a9a9a; }
  .bot-copy { min-width: 0; flex: 1; }
  .brand {
    margin: 0 0 2px;
    font-size: 11px; font-weight: 700; letter-spacing: .14em;
    text-transform: uppercase; color: #8a7a5a;
  }
  .bot h1 {
    margin: 0 0 8px; font-size: 24px; font-weight: 750;
    letter-spacing: -.02em; color: #1f2822;
  }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .chip {
    font-size: 12px; padding: 4px 11px; border-radius: 999px;
    background: rgba(244,239,230,.9); color: #5a5040;
    border: 1px solid rgba(196,132,47,.12);
  }
  .badge {
    margin-left: auto;
    font-size: 12px; padding: 5px 12px; border-radius: 999px;
    font-weight: 700; white-space: nowrap;
  }
  .badge.on { background: #e5f2e3; color: #2f6a32; }
  .badge.wait { background: #f8ecd9; color: #8a5a20; }
  .badge.off { background: #ececec; color: #666; }
  .grid4 {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
    padding: 16px 16px 14px;
  }
  .cell {
    padding: 4px 6px 2px;
    border-left: 2px solid rgba(143,173,122,.35);
    padding-left: 12px;
  }
  .cell-label {
    font-size: 11px; color: #7a857a; margin-bottom: 6px;
    letter-spacing: .06em; font-weight: 600;
  }
  .cell-main {
    font-size: 15px; font-weight: 720; line-height: 1.35;
    color: #1f2822; word-break: break-all;
  }
  .cell-sub { font-size: 11px; color: #8a9088; margin-top: 4px; line-height: 1.4; }
  .sec-title {
    font-size: 12px; font-weight: 750; color: #5a635a;
    margin-bottom: 14px; letter-spacing: .08em;
  }
  .rings {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;
  }
  .ring-card {
    display: flex; align-items: center; gap: 14px;
    padding: 8px 10px; border-radius: 14px;
    background: rgba(245,248,245,.7);
  }
  .ring {
    --p: 0; --c: #6f9b6a;
    width: 92px; height: 92px; border-radius: 50%; flex-shrink: 0;
    background: conic-gradient(var(--c) calc(var(--p) * 1%), #e6ebe4 0);
    display: grid; place-items: center;
    filter: drop-shadow(0 4px 10px rgba(40,60,40,.08));
  }
  .ring::before {
    content: ""; width: 66px; height: 66px; border-radius: 50%;
    background: #fff; grid-area: 1 / 1;
    box-shadow: inset 0 0 0 1px rgba(0,0,0,.04);
  }
  .ring span {
    grid-area: 1 / 1; z-index: 1; font-weight: 800; font-size: 17px;
    color: #243028;
  }
  .ring-meta strong { display: block; font-size: 15px; margin-bottom: 4px; color: #1f2822; }
  .ring-meta p { margin: 0; font-size: 11px; color: #7a827a; line-height: 1.45; }
  .foot {
    display: flex; flex-wrap: wrap; gap: 10px 20px;
    font-size: 12px; color: #5a635a; align-items: center;
  }
  .foot b { color: #1f2822; font-weight: 700; }
  .stamp {
    margin-left: auto; font-size: 11px; color: #8a9088;
  }
`;
}

/** 状态面板 HTML（截 #panel） */
export function buildStatusPanelHtml(s: StatusShotInput): string {
  const os = collectOsMetrics();
  const net = networkDisplay(s);
  const online = !s.powerOff && (!s.onebot.enabled || s.onebot.connected);
  const statusLabel = s.powerOff ? "已关机" : online ? "运行中" : "待连接";
  const statusTone = s.powerOff ? "off" : online ? "on" : "wait";
  const stamp = new Date().toLocaleString("zh-CN", { hour12: false });

  const botChips = [`v${s.version}`, s.envLabel, s.uptime]
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

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>运行状态</title>
<style>${panelChromeCss()}
  .bot .badge { margin-left: 8px; }
  .head-row { display: flex; align-items: flex-start; gap: 10px; flex-wrap: wrap; }
</style>
</head>
<body>
  <div id="panel">
    <div class="box bot">
      <div class="avatar">N<span class="dot ${statusTone}"></span></div>
      <div class="bot-copy">
        <div class="brand">Fengyun Nexus</div>
        <div class="head-row">
          <h1>运行状态</h1>
          <span class="badge ${statusTone}">${escapeHtml(statusLabel)}</span>
        </div>
        <div class="chips">${botChips}</div>
      </div>
    </div>

    <div class="box grid4">
      ${cell("系统", os.osMain, os.osSecondary)}
      ${cell("主机", os.host, `已运行 ${os.sysUptime}`)}
      ${cell("网络", net.main, `${net.sub} · ${qqLine}`)}
      ${cell("AI / 插件", aiLine, `${s.pluginsEnabled}/${s.pluginsTotal} 已启用`)}
    </div>

    <div class="box">
      <div class="sec-title">资源使用</div>
      <div class="rings">
        ${ringHtml("CPU", os.cpuPct, `${os.cores} 核 · ${os.cpuModel}`)}
        ${ringHtml("内存", os.memPct, `${os.memUsed} / ${os.memTotal}`)}
        ${ringHtml("Node", os.nodePct, `堆 ${os.nodeUsed} / 上限 ${os.nodeTotal}`)}
      </div>
    </div>

    <div class="box foot">
      <span>AI 回复群 <b>${escapeHtml(fmtGroups(s.replyGroupIds, "不限"))}</b></span>
      <span class="stamp">${escapeHtml(stamp)}</span>
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
<style>${panelChromeCss()}
  .list {
    margin: 0; padding-left: 18px;
    font-size: 14px; line-height: 1.55;
  }
  .list .more { color: #7a827a; list-style: none; margin-left: -18px; }
  .bot h1 { margin-bottom: 8px; }
</style>
</head>
<body>
  <div id="panel">
    <div class="box bot">
      <div class="avatar">N<span class="dot on"></span></div>
      <div class="bot-copy">
        <div class="brand">Fengyun Nexus</div>
        <div class="head-row" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <h1>重启成功</h1>
          <span class="badge on">已加载新版本</span>
        </div>
        <div class="chips">${chips}</div>
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
