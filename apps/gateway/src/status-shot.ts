/**
 * #状态 / 重启成功出图：统一走 @fengyun/browser-shot 视觉壳。
 * server 姿态不展示本机 IP；mobile / desktop / termux 可展示。
 */
import {
  arch,
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
import { memoryUsage, pid, resourceUsage, uptime as procUptime, version as nodeVersion } from "node:process";
import { getHeapStatistics } from "node:v8";
import {
  escapeShotHtml,
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
  channels: Array<{ id: string; label: string }>;
  plugins: Array<{ name: string; version?: string; enabled: boolean }>;
  db: { driver: string; messages: number; plugins: number; kv: number; path?: string };
  bots: Array<{ selfId: string; label: string; connected: boolean; apiBase: string }>;
  accounts?: Array<{
    selfId: string;
    label: string;
    nickname: string;
    connected: boolean;
    friends: number | null;
    groups: number | null;
    msgIn: number;
    msgOut: number;
    session: string;
    totalOnline: string;
    avatar: string;
  }>;
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

function replyGroupCount(ids: string[]): string {
  if (!ids.length) return "不限";
  return `${ids.length} 个`;
}

function formatUsec(us: number): string {
  if (!Number.isFinite(us) || us < 0) return "—";
  const sec = us / 1e6;
  if (sec < 1) return `${Math.round(us / 1000)} 毫秒`;
  if (sec < 60) return `${sec.toFixed(1)} 秒`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m < 60) return `${m} 分 ${s} 秒`;
  const h = Math.floor(m / 60);
  return `${h} 时 ${m % 60} 分`;
}

function formatProcUptime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h) return `${h}时${m}分${s}秒`;
  if (m) return `${m}分${s}秒`;
  return `${s}秒`;
}

function formatMaxRss(raw: number): string {
  if (!Number.isFinite(raw) || raw <= 0) return "—";
  const asBytesFromKb = raw * 1024;
  if (asBytesFromKb > totalmem() * 4) return formatBytes(raw);
  return formatBytes(asBytesFromKb);
}

function sampleRange(key: "cpu" | "mem" | "node"): string {
  if (!resourceSamples.length) return "还没有采样";
  const vals = resourceSamples.map((p) => p[key]);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  return `${min}% – ${max}% · ${resourceSamples.length} 点`;
}

function nicNames(): string {
  const names = Object.keys(networkInterfaces()).filter(Boolean);
  if (!names.length) return "0 块";
  const shown = names.slice(0, 3).join("、");
  const more = names.length > 3 ? ` 等 ${names.length} 块` : ` · ${names.length} 块`;
  return `${shown}${more}`;
}

function factRows(s: StatusShotInput, os: OsMetrics): Array<[string, string]> {
  const mu = memoryUsage();
  const heap = getHeapStatistics();
  let ru: ReturnType<typeof resourceUsage> | null = null;
  try {
    ru = resourceUsage();
  } catch {
    ru = null;
  }
  const acc = s.accounts || [];
  const groups = acc.map((a) => a.groups).filter((n): n is number => typeof n === "number");
  const friends = acc.map((a) => a.friends).filter((n): n is number => typeof n === "number");
  const groupSum = groups.length ? String(groups.reduce((a, b) => a + b, 0)) : "—";
  const friendSum = friends.length ? String(friends.reduce((a, b) => a + b, 0)) : "—";
  const disabled = (s.plugins || []).filter((p) => !p.enabled).length;
  const la = loadavg();
  const cpu0 = cpus()[0];
  const speed = cpu0?.speed ? `${cpu0.speed} MHz` : "—";
  const model = (cpu0?.model || os.cpuModel || "CPU").replace(/\s+/g, " ").trim();
  const started = new Date(Date.now() - procUptime() * 1000).toLocaleString("zh-CN", { hour12: false });
  const freePct = totalmem() ? Math.round((freemem() / totalmem()) * 100) : 0;
  return [
    ["进程已运行", formatProcUptime(procUptime())],
    ["系统已运行", os.sysUptime],
    ["进程启动", started],
    ["Node", nodeVersion],
    ["进程号", String(pid)],
    ["架构", `${arch()} · ${platform()}`],
    ["处理器", model.length > 42 ? `${model.slice(0, 40)}…` : model],
    ["逻辑核 / 主频", `${os.cores} 核 · ${speed}`],
    ["负载 1 分钟", Number.isFinite(la[0]) ? la[0].toFixed(2) : "—"],
    ["负载 5 分钟", Number.isFinite(la[1]) ? la[1].toFixed(2) : "—"],
    ["负载 15 分钟", Number.isFinite(la[2]) ? la[2].toFixed(2) : "—"],
    ["用户态 CPU", ru ? formatUsec(ru.userCPUTime) : "—"],
    ["系统态 CPU", ru ? formatUsec(ru.systemCPUTime) : "—"],
    ["主动切换", ru ? String(ru.voluntaryContextSwitches) : "—"],
    ["被动切换", ru ? String(ru.involuntaryContextSwitches) : "—"],
    ["文件读", ru ? String(ru.fsRead) : "—"],
    ["文件写", ru ? String(ru.fsWrite) : "—"],
    ["常驻内存", formatBytes(mu.rss)],
    ["最大驻留", ru ? formatMaxRss(ru.maxRSS) : "—"],
    ["堆已用", formatBytes(mu.heapUsed)],
    ["堆已扩", formatBytes(mu.heapTotal)],
    ["堆上限", formatBytes(heap.heap_size_limit || 0)],
    ["堆外内存", formatBytes(mu.external)],
    ["缓冲内存", formatBytes(mu.arrayBuffers)],
    ["本轮分配", formatBytes(heap.malloced_memory || 0)],
    ["分配峰值", formatBytes(heap.peak_malloced_memory || 0)],
    ["物理内存", os.memTotal],
    ["空闲内存", `${formatBytes(freemem())} · ${freePct}%`],
    ["网卡", nicNames()],
    ["采样", `${resourceSamples.length} / 24`],
    ["CPU 区间", sampleRange("cpu")],
    ["内存区间", sampleRange("mem")],
    ["Node 区间", sampleRange("node")],
    ["消息入库", String(s.db.messages)],
    ["插件记录", String(s.db.plugins)],
    ["键值条数", String(s.db.kv)],
    ["库驱动", s.db.driver],
    ["插件启用", `${s.pluginsEnabled} / ${s.pluginsTotal}`],
    ["插件停用", String(disabled)],
    ["通道", String(s.channels.length)],
    ["OneBot 连接", s.onebot.enabled ? `${s.onebot.clients} 路` : "未启用"],
    ["群聊合计", groupSum],
    ["好友合计", friendSum],
    ["收到合计", String(acc.reduce((n, a) => n + a.msgIn, 0))],
    ["发出合计", String(acc.reduce((n, a) => n + a.msgOut, 0))],
    ["AI 回复群", replyGroupCount(s.replyGroupIds)],
    ["姿态", `${s.envLabel}`],
    ["框架", `v${s.version}`],
    ["原生上下文", String(heap.number_of_native_contexts ?? "—")],
    ["分离上下文", String(heap.number_of_detached_contexts ?? "—")],
  ];
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

type ResourceSample = { cpu: number; mem: number; node: number };
const resourceSamples: ResourceSample[] = [];
let prevCpuTick: { idle: number; total: number } | null = null;

function cpuSinceLastTick(): number {
  const list = cpus();
  let idle = 0;
  let total = 0;
  for (const c of list) {
    const t = Object.values(c.times).reduce((a, b) => a + b, 0);
    idle += c.times.idle;
    total += t;
  }
  const prev = prevCpuTick;
  prevCpuTick = { idle, total };
  if (!prev || total <= prev.total) return cpuPercent();
  const dt = total - prev.total;
  const di = idle - prev.idle;
  return Math.min(100, Math.max(0, Math.round((1 - di / dt) * 100)));
}

function pushResourceSample(): void {
  const os = collectOsMetrics();
  resourceSamples.push({
    cpu: cpuSinceLastTick(),
    mem: os.memPct,
    node: os.nodePct,
  });
  if (resourceSamples.length > 24) resourceSamples.shift();
}

pushResourceSample();
const resourceTimer = setInterval(pushResourceSample, 12_000);
resourceTimer.unref?.();

function risingCurveSvg(values: number[], stroke: string, fillId: string): string {
  const w = 260;
  const h = 72;
  const src = values.length >= 2 ? values : [values[0] ?? 0, values[0] ?? 0];
  const xy = src.map((v, i) => {
    const x = src.length === 1 ? 0 : (i / (src.length - 1)) * w;
    const y = h - 4 - (Math.min(100, Math.max(0, v)) / 100) * (h - 8);
    return [x, y] as const;
  });
  let line = `M ${xy[0][0].toFixed(1)} ${xy[0][1].toFixed(1)}`;
  for (let i = 1; i < xy.length; i++) {
    const [x, y] = xy[i];
    const [px, py] = xy[i - 1];
    const mx = (px + x) / 2;
    line += ` C ${mx.toFixed(1)} ${py.toFixed(1)}, ${mx.toFixed(1)} ${y.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="${fillId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${stroke}" stop-opacity="0.38"/>
        <stop offset="100%" stop-color="${stroke}" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    <path d="${area}" fill="url(#${fillId})"/>
    <path d="${line}" fill="none" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

function curveCard(name: string, values: number[], now: number, detail: string, stroke: string, fillId: string): string {
  return `<div class="curve">
    <div class="curve-top"><span>${escapeShotHtml(name)}</span><b>${Math.round(now)}%</b></div>
    ${risingCurveSvg(values, stroke, fillId)}
    <div class="curve-sub">${escapeShotHtml(detail)}</div>
  </div>`;
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
  lines.push(
    `通道 ${
      s.channels
        .map((c) =>
          c.id === "onebot11" ? `${c.label}${s.onebot.connected ? "已连接" : "未连接"}` : c.label,
        )
        .join("、") || "无"
    }`,
  );
  lines.push(`数据库 ${s.db.driver} · 消息 ${s.db.messages}`);
  lines.push(`机器人 ${s.bots.map((b) => `${b.label || "未备注"}${b.connected ? "已连接" : "未连接"}`).join("、") || "无"}`);
  for (const a of s.accounts || []) {
    const name = a.nickname || a.label || "未命名";
    const qq = a.selfId || "—";
    const groups = a.groups == null ? "—" : String(a.groups);
    const friends = a.friends == null ? "—" : String(a.friends);
    lines.push(
      `${name} QQ ${qq} · 群 ${groups} · 好友 ${friends} · 收到 ${a.msgIn} · 发出 ${a.msgOut} · 在线 ${a.session} · 累计 ${a.totalOnline}`,
    );
  }
  lines.push(`AI 回复群 ${replyGroupCount(s.replyGroupIds)}`);
  return lines;
}

/** 状态面板 HTML（截 #panel） */
export function buildStatusPanelHtml(s: StatusShotInput): string {
  const os = collectOsMetrics();
  pushResourceSample();
  const last = resourceSamples[resourceSamples.length - 1] || {
    cpu: os.cpuPct,
    mem: os.memPct,
    node: os.nodePct,
  };
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

  const pluginRows = (s.plugins || [])
    .map((p) => {
      const ver = p.version ? ` @${p.version}` : "";
      const st = p.enabled ? "启用" : "停用";
      return `<li><b>${escapeShotHtml(p.name)}</b><span>${escapeShotHtml(st + ver)}</span></li>`;
    })
    .join("");
  const channelRows = (s.channels || [])
    .map((c) => {
      const st = c.id === "onebot11" ? (s.onebot.connected ? "已连接" : "未连接") : c.id;
      return `<li><b>${escapeShotHtml(c.label)}</b><span>${escapeShotHtml(st)}</span></li>`;
    })
    .join("");
  const botRows = (s.bots || [])
    .map(
      (b) =>
        `<li><b>${escapeShotHtml(b.label || b.selfId || "号")}</b><span>${b.connected ? "已连接" : "未连接"}</span></li>`,
    )
    .join("");

  const acc = s.accounts || [];
  const onlineN = acc.filter((a) => a.connected).length;
  const msgIn = acc.reduce((n, a) => n + a.msgIn, 0);
  const msgOut = acc.reduce((n, a) => n + a.msgOut, 0);
  const la = loadavg()
    .map((n) => (Number.isFinite(n) ? n.toFixed(2) : "0"))
    .join(" / ");
  const rss = formatBytes(memoryUsage().rss);
  const freeMem = formatBytes(freemem());

  const accountCards = (s.accounts || [])
    .map((a) => {
      const name = a.nickname || a.label || "未命名";
      const face = a.avatar
        ? `<img class="ava" src="${a.avatar}" alt="" />`
        : `<div class="ava ph">${escapeShotHtml((a.selfId || name).slice(-2))}</div>`;
      const groups = a.groups == null ? "—" : String(a.groups);
      const friends = a.friends == null ? "—" : String(a.friends);
      return `<article class="acc${a.connected ? "" : " off"}">
        ${face}
        <div class="acc-body">
          <div class="acc-top"><b>${escapeShotHtml(name)}</b><span class="pill ${a.connected ? "on" : "off"}">${a.connected ? "在线" : "离线"}</span></div>
          <div class="qq">QQ ${escapeShotHtml(a.selfId || "—")}${a.label && a.label !== name ? ` · ${escapeShotHtml(a.label)}` : ""}</div>
          <div class="nums">群聊 ${escapeShotHtml(groups)} · 好友 ${escapeShotHtml(friends)}</div>
          <div class="tree">消息
            <div>├ 收到 ${a.msgIn}</div>
            <div>└ 发出 ${a.msgOut}</div>
          </div>
          <div class="times">在线时间 ${escapeShotHtml(a.session)}<br/>累计在线 ${escapeShotHtml(a.totalOnline)}</div>
        </div>
      </article>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>运行状态</title>
<style>${nexusShotCss()}
#panel { width: 920px; }
.dense { display:grid; gap:6px; }
.dense li { display:flex; justify-content:space-between; gap:12px; padding:8px 12px; }
.dense span { color: var(--muted); font-size: 12px; text-align: right; }
.grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
.accs { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.acc { display:flex; gap:10px; align-items:flex-start; padding:10px; border:1px solid var(--line); border-radius:14px; background:#fff; }
.acc.off { opacity:.78; }
.ava { width:56px; height:56px; border-radius:50%; object-fit:cover; flex:none; background:#e7f6ef; }
.ava.ph { display:flex; align-items:center; justify-content:center; font-weight:750; color:#247a5e; font-size:14px; }
.acc-top { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.acc-top b { font-size:15px; }
.pill { font-size:11px; padding:2px 8px; border-radius:999px; }
.pill.on { background:#e5f6ee; color:#1f7a56; }
.pill.off { background:#f3f4f3; color:#6b7280; }
.qq, .nums, .times { color:var(--muted); font-size:12px; margin-top:2px; }
.tree { margin-top:6px; font-size:12px; line-height:1.45; color:var(--ink); }
.curves { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
.curve { padding:8px 10px 6px; border:1px solid var(--line); border-radius:14px; background:#fff; }
.curve-top { display:flex; justify-content:space-between; align-items:baseline; }
.curve-top span { color:var(--muted); font-size:12px; }
.curve-top b { font-size:22px; color:#1f7a56; }
.curve svg { width:100%; height:78px; display:block; margin-top:4px; }
.curve-sub { color:var(--muted); font-size:11px; line-height:1.35; min-height:2.6em; }
.facts { display:grid; grid-template-columns:1fr 1fr; }
.facts div { display:flex; justify-content:space-between; gap:10px; padding:7px 12px; border-bottom:1px solid var(--line); font-size:12px; }
.facts div:nth-child(4n+1), .facts div:nth-child(4n+2) { background:#f6fbf8; }
.facts b { font-weight:650; }
.facts span { color:var(--muted); text-align:right; }
</style>
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
      <div class="sec">全部账号</div>
      <div class="accs">${accountCards || "<p class='foot'>还没有账号</p>"}</div>
    </div>

    <div class="card">
      <div class="sec">主机与运行</div>
      <div class="grid3">
        ${tileHtml("系统", os.osMain, os.osSecondary)}
        ${tileHtml("主机", os.host, `已运行 ${os.sysUptime}`)}
        ${tileHtml("网络", net.main, `${net.sub}`)}
        ${tileHtml("电源", statusLabel, s.uptime)}
        ${tileHtml("数据库", s.db.driver, `消息 ${s.db.messages} · 插件记录 ${s.db.plugins} · 键值 ${s.db.kv}`)}
        ${tileHtml("AI", aiLine, `插件 ${s.pluginsEnabled}/${s.pluginsTotal}`)}
        ${tileHtml("负载", la, "1 分 / 5 分 / 15 分")}
        ${tileHtml("内存余量", freeMem, `已用 ${os.memUsed}`)}
        ${tileHtml("进程", `PID ${pid}`, `RSS ${rss} · Node ${nodeVersion}`)}
        ${tileHtml("在线账号", `${onlineN}/${acc.length || s.bots.length || 0}`, `收到 ${msgIn} · 发出 ${msgOut}`)}
        ${tileHtml("架构", `${arch()} · ${os.cores} 核`, os.cpuModel)}
        ${tileHtml("AI 回复群", replyGroupCount(s.replyGroupIds), "仅数量")}
      </div>
    </div>

    <div class="card">
      <div class="sec">资源曲线</div>
      <div class="curves">
        ${curveCard("CPU", resourceSamples.map((p) => p.cpu), last.cpu, `${os.cores} 核 · ${os.cpuModel} · ${sampleRange("cpu")}`, "#2f9b78", "fyCpu")}
        ${curveCard("内存", resourceSamples.map((p) => p.mem), last.mem, `${os.memUsed} / ${os.memTotal} · ${sampleRange("mem")}`, "#3a9aaa", "fyMem")}
        ${curveCard("Node", resourceSamples.map((p) => p.node), last.node, `堆 ${os.nodeUsed} / 上限 ${os.nodeTotal} · ${sampleRange("node")}`, "#5b7fd6", "fyNode")}
      </div>
    </div>

    <div class="card">
      <div class="sec">运行明细</div>
      <div class="facts">${factRows(s, os)
        .map(
          ([k, v]) =>
            `<div><b>${escapeShotHtml(k)}</b><span>${escapeShotHtml(v)}</span></div>`,
        )
        .join("")}</div>
    </div>

    <div class="card">
      <div class="sec">通道 ${s.channels.length}</div>
      <ul class="list dense">${channelRows || "<li>无</li>"}</ul>
    </div>
    <div class="card">
      <div class="sec">插件 ${s.plugins.length}</div>
      <ul class="list dense">${pluginRows || "<li>无</li>"}</ul>
    </div>
    <div class="card">
      <div class="sec">机器人</div>
      <ul class="list dense">${botRows || "<li>无</li>"}</ul>
      <p class="foot" style="margin-top:10px">OneBot ${escapeShotHtml(qqLine)}</p>
    </div>

    <div class="card foot">
      <span>AI 回复群 <b>${escapeShotHtml(replyGroupCount(s.replyGroupIds))}</b></span>
      <span>在线 <b>${onlineN}</b> / 账号 <b>${acc.length || s.bots.length || 0}</b></span>
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
