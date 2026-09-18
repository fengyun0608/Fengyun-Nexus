/**
 * #状态 / 重启成功出图：统一走 @fengyun/browser-shot 视觉壳。
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
import {
  escapeShotHtml,
  meterBarHtml,
  nexusShotCss,
  tileHtml,
} from "@fengyun/browser-shot";

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

/** 状态面板 HTML（截 #panel） */
export function buildStatusPanelHtml(s: StatusShotInput): string {
  const os = collectOsMetrics();
  const net = networkDisplay(s);
  const online = !s.powerOff && (!s.onebot.enabled || s.onebot.connected);
  const statusLabel = s.powerOff ? "已关机" : online ? "运行中" : "待连接";
  const statusTone = s.powerOff ? "off" : online ? "on" : "wait";
  const stamp = new Date().toLocaleString("zh-CN", { hour12: false });

  const chips = [`v${s.version}`, s.envLabel, s.uptime]
    .filter(Boolean)
    .map((t) => `<span class="chip">${escapeShotHtml(t)}</span>`)
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
<style>${nexusShotCss()}</style>
</head>
<body>
  <div id="panel">
    <div class="card">
      <div class="brand">Fengyun Nexus</div>
      <div class="head">
        <h1>运行状态</h1>
        <span class="badge ${statusTone}">${escapeShotHtml(statusLabel)}</span>
      </div>
      <div class="chips">${chips}</div>
    </div>

    <div class="card">
      <div class="sec">主机概况</div>
      <div class="grid2">
        ${tileHtml("系统", os.osMain, os.osSecondary)}
        ${tileHtml("主机", os.host, `已运行 ${os.sysUptime}`)}
        ${tileHtml("网络", net.main, `${net.sub} · ${qqLine}`)}
        ${tileHtml("AI / 插件", aiLine, `${s.pluginsEnabled}/${s.pluginsTotal} 已启用`)}
      </div>
    </div>

    <div class="card">
      <div class="sec">资源占用</div>
      <div class="meters">
        ${meterBarHtml("CPU", os.cpuPct, `${os.cores} 核 · ${os.cpuModel}`)}
        ${meterBarHtml("内存", os.memPct, `${os.memUsed} / ${os.memTotal}`)}
        ${meterBarHtml("Node", os.nodePct, `堆 ${os.nodeUsed} / 上限 ${os.nodeTotal}`)}
      </div>
    </div>

    <div class="card foot">
      <span>AI 回复群 <b>${escapeShotHtml(fmtGroups(s.replyGroupIds, "不限"))}</b></span>
      <span class="stamp">${escapeShotHtml(stamp)}</span>
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
    .map((t) => `<span class="chip">${escapeShotHtml(t)}</span>`)
    .join("");

  const summaryHtml = summary.length
    ? `<div class="card">
      <div class="sec">刚才更新了这些</div>
      <ul class="list">${summary
        .slice(0, 16)
        .map((s) => `<li>${escapeShotHtml(s)}</li>`)
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
          return `<li>${escapeShotHtml(p.name)}${escapeShotHtml(ver)}</li>`;
        })
        .join("")
    : `<li>无</li>`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>重启成功</title>
<style>${nexusShotCss()}</style>
</head>
<body>
  <div id="panel">
    <div class="card">
      <div class="brand">Fengyun Nexus</div>
      <div class="head">
        <h1>重启成功</h1>
        <span class="badge on">已加载新版本</span>
      </div>
      <div class="chips">${chips}</div>
    </div>
    ${summaryHtml}
    <div class="card">
      <div class="sec">本次加载插件</div>
      <ul class="list">${pluginHtml}</ul>
      <p class="foot" style="margin-top:14px">共 <b>${plugins.length}</b> 个</p>
    </div>
  </div>
</body>
</html>`;
}
