import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { dirname, join, resolve, sep, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import cors from "cors";
import express from "express";
import {
  ChannelRegistry,
  WebChannel,
  WebhookChannel,
  extractOb11Records,
} from "@fengyun/nexus-channel";
import { MessageRouter, SessionManager } from "@fengyun/nexus-core";
import { NexusDatabase } from "@fengyun/nexus-db";
import { LlmRouter } from "@fengyun/nexus-llm";
import { McpHost } from "@fengyun/nexus-mcp-host";
import { loadPluginsFromDir } from "@fengyun/nexus-plugin-loader";
import { PluginHost } from "@fengyun/nexus-plugin-sdk";
import {
  newId,
  nowIso,
  type AdminConfig,
  type EnvProfile,
  type NexusEnvId,
  type NexusMessage,
  type RegistryConfig,
} from "@fengyun/nexus-shared";
import { WorkflowRunner } from "@fengyun/nexus-workflow";
import { bootGroup, bootLine, installProcessGuard, printBootBanner, printBootSuccess, quietNodeSqliteWarning } from "./boot-banner.js";
import { warnBootGaps } from "./boot-check.js";
import { resolveOb11Media, setOb11MediaHost, setOb11MediaRoot } from "./ob11-media.js";
import { checkPluginUpdates, applyPluginUpdates, ensurePluginSdkLinks } from "./registry-check.js";
import { installEcosystemPack, installUploadedZip, listExtraInstalls, loadEcosystemCatalog, removeInstalledPack } from "./ecosystem-catalog.js";
import { listOpenReviews, listOwnRepos, loginGitAccount, submitEcosystemPr } from "./ecosystem-submit.js";
import {
  getChannelSettings,
  isChannelMaster,
  isGroupReplyAllowed,
  loadChannelsConfig,
  saveChannelsConfig,
  type ChannelSettings,
  type ChannelsConfigFile,
} from "./channel-settings.js";
import { loadDbConfig, resolveDbOpenOpts, saveDbConfig } from "./db-config.js";
import { formatErrorForClient, translateError } from "./errors-zh.js";
import { isAdminHash, parseHashCommand, resolveAdminHash } from "./hash-commands.js";
import {
  createInstallTask,
  autoQueueMissing,
  getTask,
  initEnvTasks,
  listRuntimes,
  listTasks,
  removeTask,
  setNapCatWireProvider,
  setNapCatAfterInstall,
  setTaskStatus,
  taskCounts,
  type EnvRuntimeId,
  type EnvTaskStatus,
} from "./env-tasks.js";
import {
  buildReverseWsUrl,
  getNapCatStatus,
  tryLaunchNapCat,
  wireNapCatConfigs,
  wireNapCatForAccount,
  readNapCatMarker,
} from "./napcat-setup.js";
import { applyRemoteUpdate, checkRemoteUpdate, readLocalVersion } from "./update-check.js";
import { applyFullUpdate } from "./full-update.js";
import { ensureGatewayPortOpen } from "./open-port.js";
import { buildRestartOkLines, buildRestartOkPanelHtml, buildStatusLines, buildStatusPanelHtml, probePublicReach, type StatusShotInput } from "./status-shot.js";
import { addOnlineTotal, collectStatusAccounts, ONLINE_KV, readOnlineTotals } from "./status-accounts.js";
import { execFileSync } from "node:child_process";
import { loadBotConfig, saveBotConfig, stripWakePrefix, shouldTriggerAi, stripAtMentions, stripWakeForChat, type BotConfig } from "./bot-config.js";
import {
  DEFAULT_WALLPAPER_URL,
  isAllowedWallpaperUrl,
  loadConsoleAppearance,
  saveConsoleAppearance,
  type ConsoleAppearance,
} from "./console-appearance.js";
import {
  listPluginDirs,
  listPluginFiles,
  readPluginFile,
  scaffoldPluginGuide,
  writePluginFile,
  createLocalPlugin,
} from "./plugin-files.js";
import {
  createLocalWorkflow,
  listLocalWorkflows,
  scaffoldWorkflowGuide,
  toWorkflowDef,
} from "./workflow-files.js";
import { makePluginCtx, setPluginRuntime, setPluginChannelBag, setPluginOneBot } from "./plugin-ctx.js";
import { loadAgentSkills, skillsPromptBlock } from "./agent-skills.js";
import { buildAgentToolDefs, runAgentTool } from "./agent-tools.js";
import { listOpenDesktopApps, hostInfo, hostUptime } from "./desktop-inspect.js";
import { webRead, webSearch } from "./web-lookup.js";
import { speechFileToText } from "./tts-stt.js";
import { agentWorkspaceRoot, workspaceList } from "./agent-workspace.js";
import {
  uiaClick,
  uiaClickText,
  uiaFocus,
  uiaKeys,
  uiaSee,
  uiaSetText,
  uiaTree,
  uiaWindows,
} from "./uia-bridge.js";
import {
  webAttach,
  webClick,
  webClose,
  webKeys,
  webOpen,
  webScreenshot,
  webSnapshot,
  webType,
} from "./web-control.js";
import {
  extractLeakedToolCalls,
  isJunkAiText,
  splitAiSegments,
  splitThinkingAndSpeak,
  stripLeakedToolMarkup,
} from "./ai-segments.js";
import { startTerminalRepl } from "./terminal-repl.js";
import {
  buildRestartingMessage,
  clearRestartNotify,
  formatUptime,
  originGroupId,
  originMessageType,
  peekRestartNotify,
  saveRestartNotify,
} from "./restart-notify.js";
import { scheduleSystemRestart } from "./restart-exec.js";
import { remountPluginChannels } from "./channel-adapters.js";
import { renderDocView, findRepoRoot } from "./docs-serve.js";
import { reloadPlugins, watchPluginsHotReload } from "./plugin-hot-reload.js";
import {
  applyStoredPluginConfigs,
  loadPluginConfigMap,
  savePluginConfig,
  watchPluginConfigFile,
} from "./plugin-config-store.js";
import { getChannelPluginAssign, saveChannelPluginAssign } from "./channel-plugin-assign.js";
import { getLogEntries, log, queryLogEntries, setLogFile } from "./log.js";
import { renderHtmlShot } from "./menu-shot.js";
import {
  activeProvider,
  loadProvidersFile,
  publicProviders,
  saveProvidersFile,
  type LlmProvider,
} from "./llm-store.js";
import { OneBot11Bridge, type OneBotConfig } from "./onebot11-bridge.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = findRepoRoot(resolve(__dirname, "../../.."));
setLogFile(join(ROOT, "data", "logs", "gateway.log"));
const ADMIN_LOCAL = join(ROOT, "configs/admin.local.json");
const RUNTIME_LOCAL = join(ROOT, "configs/runtime.local.json");
const ONEBOT_LOCAL = join(ROOT, "configs/onebot.local.json");
const WEB_DIST = join(ROOT, "apps/web/dist");
const PUBLIC_FALLBACK = join(__dirname, "../public");
const PLUGINS_DIR = join(ROOT, "plugins");

function loadOneBotConfig(): OneBotConfig {
  const base = loadJson<OneBotConfig>("configs/onebot.default.json");
  const withBots: OneBotConfig = {
    ...base,
    bots: Array.isArray(base.bots) ? base.bots : [],
  };
  if (!existsSync(ONEBOT_LOCAL)) return withBots;
  try {
    const local = JSON.parse(readFileSync(ONEBOT_LOCAL, "utf8")) as Partial<OneBotConfig>;
    return {
      ...withBots,
      ...local,
      bots: Array.isArray(local.bots) ? local.bots : withBots.bots,
    };
  } catch {
    return withBots;
  }
}

function persistOneBotConfig(cfg: OneBotConfig): void {
  writeFileSync(ONEBOT_LOCAL, `${JSON.stringify(cfg, null, 2)}\n`, "utf8");
}

function applyProviderToLlm(llm: LlmRouter, p: LlmProvider | undefined): void {
  llm.configure({
    apiKey: p?.apiKey || process.env.NEXUS_LLM_API_KEY,
    baseUrl: p?.baseUrl || process.env.NEXUS_LLM_BASE_URL,
    model: p?.model || process.env.NEXUS_LLM_MODEL,
  });
}

function loadDotEnv(): void {
  for (const name of [".env", ".env.local"]) {
    const p = join(ROOT, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i <= 0) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

function isTermuxHost(): boolean {
  return Boolean(
    process.env.TERMUX_VERSION ||
      process.env.PREFIX?.includes("com.termux") ||
      process.env.NEXUS_FORCE_TERMUX === "1",
  );
}

function loadRuntimeEnvHint(): string | undefined {
  if (!existsSync(RUNTIME_LOCAL)) return undefined;
  try {
    const j = JSON.parse(readFileSync(RUNTIME_LOCAL, "utf8")) as { env?: string };
    return j.env;
  } catch {
    return undefined;
  }
}

function loadJson<T>(rel: string): T {
  const p = join(ROOT, rel);
  return JSON.parse(readFileSync(p, "utf8")) as T;
}

function headlessLinux(): boolean {
  return process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY;
}

function resolveEnvId(): NexusEnvId {
  const raw = (
    process.env.NEXUS_ENV ||
    loadRuntimeEnvHint() ||
    (isTermuxHost() ? "termux" : headlessLinux() ? "server" : "desktop")
  ).toLowerCase();
  if (raw === "mobile" || raw === "desktop" || raw === "server" || raw === "termux") return raw;
  return "desktop";
}

function isPublicIpv4(ip: string): boolean {
  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip)) return false;
  if (ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("169.254.")) {
    return false;
  }
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return false;
  return true;
}

async function lookupPublicIpv4(): Promise<string> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 2500);
  const targets = [
    "http://169.254.169.254/latest/meta-data/public-ipv4",
    "http://100.100.100.200/latest/meta-data/eipv4",
    "https://api.ipify.org",
  ];
  try {
    for (const u of targets) {
      try {
        const res = await fetch(u, { signal: ctl.signal });
        const text = (await res.text()).trim();
        if (isPublicIpv4(text)) return text;
      } catch {
        /* 换下一个 */
      }
    }
  } finally {
    clearTimeout(timer);
  }
  return "";
}

function connectHosts(bindHost: string, publicIp = ""): string[] {
  const hosts: string[] = [];
  const h = String(bindHost || "").trim();
  const open = h === "0.0.0.0" || h === "::" || h === "[::]";
  if (!open) {
    hosts.push(!h || h === "localhost" ? "127.0.0.1" : h);
    return hosts;
  }
  hosts.push("127.0.0.1");
  for (const list of Object.values(networkInterfaces())) {
    for (const n of list || []) {
      const fam = String(n.family);
      if (n.internal || (fam !== "IPv4" && fam !== "4")) continue;
      if (!hosts.includes(n.address)) hosts.push(n.address);
    }
  }
  if (publicIp && !hosts.includes(publicIp)) hosts.push(publicIp);
  return hosts;
}

function consoleUrls(port: number, host: string): string[] {
  const urls: string[] = [];
  const open = host === "0.0.0.0" || host === "::" || host === "[::]";
  if (!open) {
    if (host && host !== "127.0.0.1" && host !== "localhost") urls.push(`http://${host}:${port}/`);
    urls.push(`http://127.0.0.1:${port}/`);
    return urls;
  }
  for (const list of Object.values(networkInterfaces())) {
    for (const n of list || []) {
      const fam = String(n.family);
      if (n.internal || (fam !== "IPv4" && fam !== "4")) continue;
      urls.push(`http://${n.address}:${port}/`);
    }
  }
  urls.push(`http://127.0.0.1:${port}/`);
  return urls;
}

function loadEnvProfile(id: NexusEnvId): EnvProfile {
  return loadJson<EnvProfile>(`configs/env.${id}.json`);
}

function loadAdmin(): AdminConfig {
  if (existsSync(ADMIN_LOCAL)) {
    const local = JSON.parse(readFileSync(ADMIN_LOCAL, "utf8")) as Partial<AdminConfig>;
    const base = loadJson<AdminConfig>("configs/admin.default.json");
    return {
      ...base,
      ...local,
      setupCompleted: Boolean(local.setupCompleted ?? base.setupCompleted),
      sessionHours: Number(local.sessionHours ?? base.sessionHours ?? 12),
    };
  }
  return loadJson<AdminConfig>("configs/admin.default.json");
}

function persistAdmin(cfg: AdminConfig): void {
  const out = {
    username: cfg.username,
    passwordEnv: cfg.passwordEnv,
    defaultPassword: cfg.defaultPassword,
    sessionHours: cfg.sessionHours,
    setupCompleted: cfg.setupCompleted,
  };
  writeFileSync(ADMIN_LOCAL, `${JSON.stringify(out, null, 2)}\n`, "utf8");
}

function loadRegistry(): RegistryConfig {
  const shipped = loadJson<RegistryConfig>("configs/registry.json");
  const local = join(ROOT, "configs/registry.local.json");
  if (!existsSync(local)) return shipped;
  try {
    const loc = JSON.parse(readFileSync(local, "utf8")) as Partial<RegistryConfig>;
    // 可合并其它登记项；系统插件专仓地址以发行配置为准，禁止被 local / 控制台改掉
    return {
      ...shipped,
      ...loc,
      pluginsRepo: shipped.pluginsRepo,
      ecosystemRepo: shipped.ecosystemRepo,
      categories: loc.categories ?? shipped.categories,
      update: loc.update ?? shipped.update,
      baseUrl: typeof loc.baseUrl === "string" ? loc.baseUrl : shipped.baseUrl,
      tokenEnv: typeof loc.tokenEnv === "string" ? loc.tokenEnv : shipped.tokenEnv,
    };
  } catch {
    return shipped;
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** English letters only, length 4–8. */
function validateUsername(username: string): string | null {
  if (!/^[A-Za-z]{4,8}$/.test(username)) {
    return "用户名须为 4–8 位英文字母";
  }
  if (username.toLowerCase() === "console") {
    return "请勿使用保留用户名 console";
  }
  return null;
}

/** Password: ≥4 chars; complexity (upper + lower + digit + special). */
function validatePassword(password: string): string | null {
  if (password.length < 4) return "密码至少 4 位";
  const checks = [
    { ok: /[a-z]/.test(password), tip: "小写字母" },
    { ok: /[A-Z]/.test(password), tip: "大写字母" },
    { ok: /[0-9]/.test(password), tip: "数字" },
    { ok: /[^A-Za-z0-9]/.test(password), tip: "特殊字符" },
  ];
  const missing = checks.filter((c) => !c.ok).map((c) => c.tip);
  if (missing.length) {
    return `密码复杂度不足，还缺：${missing.join("、")}`;
  }
  if (password === "console") return "请勿使用初始密码";
  return null;
}

/** 每次问 AI 都先带上。通道人设写在后面，不把这句盖掉。 */
function frameworkSystemPrompt(opts?: {
  capability?: boolean;
  userId?: string;
  senderName?: string;
}): string {
  const who = [opts?.senderName, opts?.userId].filter(Boolean).join(" / ");
  const lines = [
    "你在 Fengyun Nexus 里运作，你就是 Fengyun Nexus。",
    "有人问你是谁、是什么模型、谁做的，只说 Fengyun Nexus，不要报中文产品名或出品方。",
    "不要说自己是别的模型，也不要说自己是别的产品。",
    "这个通道如果另外写了人设，就在 Fengyun Nexus 这个身份上按那个人设说话。",
  ];
  if (opts?.capability) {
    lines.push(
      who ? `当前说话的人是主人（${who}），已开启能力调用。` : "当前说话的人是主人，已开启能力调用。",
      "你有 agent 能力：会调工具，也会写脚本。先用现成能力，不要一上来就新建 plugins/。",
      "顺序：1）nexus_list_caps / nexus_call_cap 调已有 # 指令；2）已有工具直接调；3）读技能；4）仍缺再写一次性脚本（沙箱或 shell）；5）只有主人明确说「写一个常驻插件」才新建 plugins/。",
      "框架已有、禁止再写插件重复造：#重启 #更新 #状态 #菜单 #帮助 #禁言 #解禁 #全体禁言 #踢 #群管。重启用 nexus_call_cap 发 #重启，或让主人发 #重启。不要写 z-restart 之类。",
      "禁言：有 QQ 就 #禁言 @对方 分钟；只有昵称就用 OneBot get_group_member_list 查 QQ，再 set_group_ban 或 call_cap。不要为禁言新建插件。",
      "可以查看并调用已加载的群内插件能力，也可以安装生态收录、排队安装 Go / Python / 浏览器 / NapCat，以及启用、停用、重载插件。",
      "主人要听某首歌：优先 nexus_music_play。没有或失败就按 agent-code 自己写/跑操控脚本，不要让用户自己搜。",
      "只打开软件、不听歌时，调用 nexus_launch_app，只传软件名。",
      "问电脑开了多久、开机时间，调用 nexus_host_uptime。那是整台电脑的开机时长，不是框架自己跑了多久。不要说没有这个工具，也不要编数字。",
      "问内存、处理器、磁盘、系统版本或系统信息，调用 nexus_host_info。不要说还要去装这个能力。",
      "问报错、掉线、日志文件：调用 nexus_shell 用系统命令查 data/logs/gateway.log。Windows 例：Get-Content -Tail 80 data\\logs\\gateway.log | Select-String ERROR,WARN。这是本机系统命令，不是框架 # 指令。整台服务器都可以查、可以操作。不要说没有工具，也不要只翻沙箱。",
      "有人要搜网页、查资料、看某个网址，调用 nexus_web_search 或 nexus_web_read。不要说没有搜索。",
      "要发图、发文件、发语音到 QQ：用 nexus_qq_send_image / nexus_qq_send_file / nexus_qq_send_voice。",
      "主人说戳我、戳一下：有 nexus_qq_poke 就调；没有就自己查 OneBot 地址（nexus_onebot_get），用 shell 调 send_poke / group_poke。不要只文字假装戳，也不要为此新建插件。",
      "有人说截图、截屏、截个图、电脑画面发群里：调用 nexus_screen。那是本机真实屏幕，不是状态卡片。不要用 nexus_shot 充数。没有显示器就照工具结果说明截不了。",
      "nexus_shot 只渲菜单或 HTML 图，不能拿来代替电脑截图。",
      "写代码：短脚本放沙箱。不要把网关源码整份读完。说「已创建」前必须确认文件真在。禁止为一次小事新建常驻插件。",
      "改通道人设/回复群或 OneBot 开关路径：用 nexus_channel_patch / nexus_onebot_patch。不要改密码。",
      "有人要操控已开软件窗口、点按钮、填输入框、模拟按键：先读技能 uia-mcp。控件树是空的网页壳，用 nexus_web_attach 挂页面，或 nexus_window_see 认出字在哪再 nexus_click_text。普通窗口用 nexus_uia_windows → nexus_uia_tree → click/set_text/keys。不够就自己写脚本。",
      "有人要打开网页并点选、填字、按键：用 nexus_web_open → nexus_web_snapshot → click/type/keys。snapshot 里有字和坐标。不要只用 web_read 只读摘要。",
      "平常问答用一两段说完，不要空行拆成很多条。发图/文件/语音另发出站，不算文字刷屏。能直接调工具就别连查五六个再动手。",
      "对用户说人话。思考必须写在 <think> 与 </think> 之间；标签外面必须有结果，只有思考不算做完。回话要短，按空行分成多段。不要甩工具名、JSON、DSML。",
      "工具必须走正式 function call。禁止把 tool_calls、DSML、invoke、XML 写进回复正文。",
      "先列出能力再调用，不要编造没有安装的名字。需要查状态、插件、工作流或 MCP 时用工具，不要编造。",
      "现成工具/指令能用就用；没有再写短脚本。别空口说不会，也别为已有能力再写一套插件。",
    );
  } else if (opts?.userId) {
    lines.push(
      `当前说话的人不是主人（${who || opts.userId}）。禁止调用任何能力、工具、安装和操控。`,
      "只做普通对话。需要说明来源时，直接说这条消息是谁发的。",
    );
  }
  return lines.join("\n");
}

function archiveRaw(msg: NexusMessage, capabilityMode: boolean): string {
  const pack = {
    rawMessage: msg.meta?.rawMessage || msg.content,
    senderName: msg.meta?.senderName || "",
    userId: msg.userId,
    capabilityMode,
    source: msg.meta?.source || "",
  };
  const s = JSON.stringify(pack);
  return s.length > 12000 ? `${s.slice(0, 12000)}…` : s;
}

async function bootstrap(): Promise<void> {
  const startedAt = Date.now();
  quietNodeSqliteWarning();
  installProcessGuard();
  printBootBanner();
  loadDotEnv();

  const envId = resolveEnvId();
  const profile = loadEnvProfile(envId);
  let adminCfg = loadAdmin();
  adminCfg.sessionHours = adminCfg.sessionHours || 12;
  const registry = loadRegistry();
  await bootGroup("环境");
  await bootLine("开始确认运行环境");
  await bootLine(`环境已就绪：${profile.label || profile.id}`);

  function currentPassword(): string {
    return process.env[adminCfg.passwordEnv] || adminCfg.defaultPassword;
  }

  await bootGroup("数据库");
  await bootLine("开始打开数据库");
  let dbCfg = loadDbConfig(ROOT);
  const dbOpen = resolveDbOpenOpts(ROOT, dbCfg);
  let db = new NexusDatabase({ driver: dbOpen.driver, filePath: dbOpen.filePath });
  await db.open();
  await bootLine(`数据库已打开：${dbOpen.driver}`);
  const sessions = new SessionManager();
  sessions.bindStore(join(ROOT, "data", "sessions.json"));
  const loadedSessions = sessions.list().length;
  if (loadedSessions) log.info(`会话已从磁盘读回 ${loadedSessions} 个`);
  const router = new MessageRouter();

  await bootGroup("通道");
  await bootLine("开始挂载消息通道");
  const channels = new ChannelRegistry();
  channels.register(new WebChannel());
  channels.register(new WebhookChannel());
  const onebotCfg = loadOneBotConfig();
  const onebot = new OneBot11Bridge(onebotCfg);
  setOb11MediaRoot(ROOT);
  onebot.setOfflineHandler((sid, ms) => {
    const prev = readOnlineTotals(db.getKv(ONLINE_KV));
    db.setKv(ONLINE_KV, JSON.stringify(addOnlineTotal(prev, sid, ms)));
  });
  const gatewayPortEarly = () => Number(process.env.PORT ?? profile.gateway.port);
  onebot.setGatewayPort(gatewayPortEarly());
  {
    const gw = gatewayPortEarly();
    const cleaned = (onebot.getConfig().bots || []).map((b) => {
      let fromApi = 0;
      try {
        const u = new URL(String(b.apiBase || ""));
        fromApi = Number(u.port || 0);
      } catch {
        fromApi = 0;
      }
      const listenPort =
        Math.floor(Number(b.listenPort) || 0) || (fromApi > 0 && fromApi !== gw ? fromApi : 0);
      const apiBase = fromApi === listenPort || fromApi === gw ? "" : onebot.napcatApi(b.apiBase);
      return { ...b, listenPort, apiBase };
    });
    const prev = onebot.getConfig().bots || [];
    if (JSON.stringify(cleaned) !== JSON.stringify(prev)) {
      const next = { ...onebot.getConfig(), bots: cleaned };
      persistOneBotConfig(next);
      onebot.updateConfig(next);
      log.info("已按填写的端口打开反向入口，QQ 号等连上后再写入");
    } else {
      onebot.syncListenPorts();
    }
  }
  channels.register(onebot.channel);
  await bootLine(
    `通道已挂载：${channels
      .list()
      .map((c) => c.label || c.id)
      .join("、")}`,
  );

  setNapCatWireProvider(() => {
    const cfg = onebot.getConfig();
    return {
      reverseWsUrl: buildReverseWsUrl({
        port: gatewayPortEarly(),
        path: cfg.reverseWsPath || "/onebot/v11/ws",
        token: "",
      }),
      token: "",
    };
  });
  setNapCatAfterInstall(() => {
    const cfg = onebot.getConfig();
    const next = { ...cfg, enabled: true };
    persistOneBotConfig(next);
    onebot.updateConfig(next);
  });
  onebot.setSelfIdHandler((sid, listenPort) => {
    const cfg = onebot.getConfig();
    const bots = (cfg.bots || []).map((b) => ({ ...b }));
    if (bots.some((b) => String(b.selfId) === sid)) return;
    const byPort = listenPort ? bots.findIndex((b) => Number(b.listenPort) === listenPort) : -1;
    const empty = bots.findIndex((b) => !String(b.selfId || "").trim());
    const idx = byPort >= 0 ? byPort : empty;
    if (idx < 0) {
      log.info(`QQ ${sid} 已连上。先添加备注，QQ 号会写到那一张卡上`);
      return;
    }
    const label = bots[idx]?.label || "未备注";
    const port = Math.floor(Number(bots[idx]?.listenPort) || listenPort || gatewayPortEarly());
    const token = onebot.tokenFor(port);
    const url = buildReverseWsUrl({
      port,
      path: cfg.reverseWsPath || "/onebot/v11/ws",
      token,
    });
    const file = wireNapCatForAccount(ROOT, sid, url, token);
    if (file) log.ok(`已把 ${label} 的反向地址写成 ${url}`);
    bots[idx] = { ...bots[idx], selfId: sid };
    const next = { ...cfg, enabled: true, bots };
    persistOneBotConfig(next);
    onebot.updateConfig(next);
    log.ok(`已写入 ${label} 的 QQ ${sid}`);
  });

  await bootGroup("AI");
  await bootLine("开始接通模型");
  let llmStore = loadProvidersFile(ROOT);
  const llm = new LlmRouter();
  applyProviderToLlm(llm, activeProvider(llmStore));
  const ap = activeProvider(llmStore);
  await bootLine(
    ap?.apiKey || process.env.NEXUS_LLM_API_KEY
      ? `AI 已接通：${ap?.name ?? ap?.id} · ${ap?.model || "default"}`
      : "AI 未配置密钥",
  );

  const plugins = new PluginHost();
  plugins.onError = (id, message) => {
    log.warn(`插件 ${id} 出错，已跳过：${String(message).slice(0, 180)}`);
  };
  await bootGroup("插件");
  await bootLine("开始加载插件");
  try {
    const linked = ensurePluginSdkLinks(ROOT);
    if (linked.length) await bootLine(`插件 SDK 已接上：${linked.join("、")}`);
  } catch {
    /* ignore */
  }
  try {
    const repoUrl = String(registry.pluginsRepo?.url || "").trim();
    if (repoUrl) {
      const probe = checkPluginUpdates(ROOT, {
        pluginsRepoUrl: repoUrl,
        pluginsRepoBranch: registry.pluginsRepo?.branch || "main",
      });
      const missing = probe.items.filter((i) => i.status === "remote-only").map((i) => i.dir);
      if (missing.length) {
        const pulled = applyPluginUpdates(ROOT, {
          pluginsRepoUrl: repoUrl,
          pluginsRepoBranch: registry.pluginsRepo?.branch || "main",
          dirs: missing,
        });
        if (pulled.applied.length) {
          await bootLine(`已补装系统插件：${pulled.applied.join("、")}`);
          ensurePluginSdkLinks(ROOT, pulled.applied);
        }
      }
    }
  } catch (e) {
    log.warn(`系统插件自动安装跳过：${e instanceof Error ? e.message : String(e)}`);
  }
  const prevPlugins = db.listPlugins();
  const scan = await loadPluginsFromDir(PLUGINS_DIR, (tip) => {
    if (tip.level === "warn") log.warn(tip.message);
    else if (tip.level === "error") log.error(tip.message);
  });
  for (const p of scan.host.values()) {
    plugins.register(p);
    const prev = prevPlugins.find((x) => x.id === p.manifest.id);
    const enabled = prev ? prev.enabled !== false : true;
    plugins.setEnabled(p.manifest.id, enabled);
    db.upsertPlugin({
      id: p.manifest.id,
      name: p.manifest.name,
      version: p.manifest.version,
      enabled,
      loadedAt: nowIso(),
    });
    if (enabled) await bootLine(`已加载：${p.manifest.name || p.manifest.id}`);
  }

  const quietBoot = {
    ok: (_m: string) => undefined,
    warn: (m: string) => log.warn(m),
    error: (m: string) => log.error(m),
    info: (_m: string) => undefined,
  };
  await remountPluginChannels(PLUGINS_DIR, channels, quietBoot);

  const pluginHotDeps = {
    pluginsDir: PLUGINS_DIR,
    host: plugins,
    listEnabled: () => db.listPlugins().map((p) => ({ id: p.id, enabled: p.enabled !== false })),
    upsertPlugin: (row: {
      id: string;
      name: string;
      version: string;
      enabled: boolean;
      loadedAt: string;
    }) => db.upsertPlugin(row),
    log: {
      ok: (m: string) => log.ok(m),
      warn: (m: string) => log.warn(m),
      error: (m: string) => log.error(m),
      info: (m: string) => log.info(m),
    },
    root: ROOT,
    remountChannels: async () => {
      await remountPluginChannels(
        PLUGINS_DIR,
        channels,
        {
          ok: (m) => log.ok(m),
          warn: (m) => log.warn(m),
          error: (m) => log.error(m),
          info: (m) => log.info(m),
        },
        { cacheBust: true },
      );
    },
  };
  // 热更新只重载插件，不重启网关进程
  const hotOff = process.env.NEXUS_PLUGIN_HOT === "0";
  watchPluginsHotReload(pluginHotDeps, { enabled: !hotOff });

  let channelCfg: ChannelsConfigFile = loadChannelsConfig(ROOT);
  let botCfg: BotConfig = loadBotConfig(ROOT);
  let consoleAppearance: ConsoleAppearance = loadConsoleAppearance(ROOT);
  setPluginOneBot(onebot);
  setPluginChannelBag({
    getCfg: () => channelCfg,
    setCfg: (cfg) => {
      channelCfg = cfg;
    },
    save: () => saveChannelsConfig(ROOT, channelCfg),
  });
  const appliedCfg = await applyStoredPluginConfigs(ROOT, plugins.values());
  if (appliedCfg) await bootLine(`插件配置已读入：${appliedCfg} 份`);
  if (!hotOff) await bootLine("插件热更新已打开");
  watchPluginConfigFile(ROOT, () => {
    void applyStoredPluginConfigs(ROOT, plugins.values()).then((n) => {
      if (n) log.info(`配置 ${n}`);
    });
  });
  await plugins.emitReady(
    (id) =>
      makePluginCtx(id, (m) => {
        log.ok(m);
      }),
    (line) => log.ok(line),
  );
  await bootLine(`插件加载完成：共 ${plugins.list().length} 个`);

  /** Soft power-off: ignore normal chat until #开机. #重启 calls system restart executable. */
  let powerOff = false;

  await bootGroup("工作流");
  await bootLine("开始装载工作流");
  const workflows = new WorkflowRunner();
  workflows.register({
    id: "starter",
    name: "Starter Flow",
    entry: "t1",
    nodes: [
      { id: "t1", type: "trigger", next: ["m1"] },
      { id: "m1", type: "memory", config: { op: "set", key: "boot", value: true }, next: ["l1"] },
      { id: "l1", type: "llm", next: ["tool1"] },
      { id: "tool1", type: "tool", config: { name: "status" }, next: ["d1"] },
      { id: "d1", type: "delay", config: { ms: 10 }, next: [] },
    ],
  });
  for (const w of listLocalWorkflows(ROOT)) {
    workflows.register(toWorkflowDef(w));
  }
  await bootLine(`工作流已就绪：${workflows.list().length} 个`);

  const mcp = new McpHost();
  mcp.register({
    name: "nexus.status",
    description: "Return Fengyun Nexus runtime status",
    handler: () => ({
      env: envId,
      plugins: plugins.list().length,
      channels: channels.list().map((c) => c.id),
      db: db.stats(),
    }),
  });
  mcp.register({
    name: "nexus.plugins",
    description: "List loaded plugins",
    handler: () =>
      plugins.list().map((p) => ({
        id: p.id,
        name: p.name,
        version: p.version,
      })),
  });
  mcp.register({
    name: "nexus.workflows",
    description: "List workflows",
    handler: () => workflows.list().map((w) => ({ id: w.id, name: w.name })),
  });
  mcp.register({
    name: "nexus.open_apps",
    description: "List open desktop apps / window titles on this machine",
    handler: async (args) => listOpenDesktopApps({ limit: Number(args?.limit) || 20 }),
  });
  mcp.register({
    name: "nexus.web_search",
    description: "搜索公开网页，返回标题、链接和摘要",
    handler: async (args) => webSearch(String(args?.query || args?.q || "")),
  });
  mcp.register({
    name: "nexus.web_read",
    description: "读取一个公开网页的正文摘要",
    handler: async (args) => webRead(String(args?.url || "")),
  });
  mcp.register({
    name: "nexus.host_info",
    description: "本机系统信息：处理器、内存、磁盘、开机时长",
    handler: () => hostInfo(),
  });
  mcp.register({
    name: "nexus.host_uptime",
    description: "本机开机运行时长",
    handler: () => hostUptime(),
  });
  mcp.register({
    name: "nexus.workspace_list",
    description: "列出 data/agent-workspace 沙箱目录（只读）",
    handler: (args) => workspaceList(ROOT, String(args?.path || ".")),
  });
  mcp.register({
    name: "nexus.logs",
    description: "查看 Fengyun Nexus 框架最近运行日志（内存环，可按级别/关键词过滤）",
    handler: (args) => {
      const levelsRaw = String(args?.levels || args?.level || "").trim();
      const levels = levelsRaw
        ? levelsRaw.split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean)
        : [];
      const q = queryLogEntries({
        limit: Number(args?.limit) || 80,
        levels: levels.length ? levels : undefined,
        contains: String(args?.contains || args?.q || "").trim() || undefined,
      });
      return {
        ...q,
        lines: q.items.map(
          (e) => `${e.at.replace("T", " ").slice(0, 19)} [${e.level}] ${e.message}`,
        ),
      };
    },
  });

  // 桌面 UIA（Windows）
  mcp.register({
    name: "nexus.uia_windows",
    description: "列出本机已打开的窗口标题（Windows UIA）",
    handler: () => uiaWindows(ROOT),
  });
  mcp.register({
    name: "nexus.uia_tree",
    description: "扫描指定窗口的控件树，用于精准定位按钮/输入框",
    handler: (args) =>
      uiaTree(ROOT, {
        title: String(args?.title || ""),
        handle: Number(args?.handle) || 0,
        depth: Number(args?.depth) || 3,
        limit: Number(args?.limit) || 120,
      }),
  });
  mcp.register({
    name: "nexus.uia_focus",
    description: "把指定窗口提到前台",
    handler: (args) =>
      uiaFocus(ROOT, { title: String(args?.title || ""), handle: Number(args?.handle) || 0 }),
  });
  mcp.register({
    name: "nexus.uia_click",
    description: "点击窗口内控件。用 name / auto_id / control_type 定位",
    handler: (args) =>
      uiaClick(ROOT, {
        title: String(args?.title || ""),
        handle: Number(args?.handle) || 0,
        name: String(args?.name || ""),
        auto_id: String(args?.auto_id || ""),
        control_type: String(args?.control_type || ""),
      }),
  });
  mcp.register({
    name: "nexus.uia_set_text",
    description: "向窗口内输入框填字",
    handler: (args) =>
      uiaSetText(ROOT, {
        title: String(args?.title || ""),
        handle: Number(args?.handle) || 0,
        name: String(args?.name || ""),
        auto_id: String(args?.auto_id || ""),
        control_type: String(args?.control_type || "Edit"),
        text: String(args?.text ?? ""),
      }),
  });
  mcp.register({
    name: "nexus.uia_keys",
    description: "向窗口或控件模拟按键。keys 语法同 pywinauto，如 ^a{ENTER}",
    handler: (args) =>
      uiaKeys(ROOT, {
        title: String(args?.title || ""),
        handle: Number(args?.handle) || 0,
        name: String(args?.name || ""),
        auto_id: String(args?.auto_id || ""),
        control_type: String(args?.control_type || ""),
        keys: String(args?.keys || ""),
      }),
  });
  mcp.register({
    name: "nexus.window_see",
    description: "认出窗口里文字和控件的位置。网页壳控件树为空时用",
    handler: (args) =>
      uiaSee(ROOT, {
        title: String(args?.title || ""),
        handle: Number(args?.handle) || 0,
        limit: Number(args?.limit) || 40,
      }),
  });
  mcp.register({
    name: "nexus.click_text",
    description: "按窗口上的文字点击",
    handler: (args) =>
      uiaClickText(ROOT, {
        title: String(args?.title || ""),
        handle: Number(args?.handle) || 0,
        text: String(args?.text || ""),
      }),
  });

  // 网页控件（Playwright）
  mcp.register({
    name: "nexus.web_attach",
    description: "挂上已开的 Electron/Chromium 调试口，读出页面文字与控件",
    handler: (args) =>
      webAttach(ROOT, {
        port: Number(args?.port) || 0,
        hint: String(args?.hint || args?.title || ""),
        session: String(args?.session || "desktop-web"),
      }),
  });
  mcp.register({
    name: "nexus.web_open",
    description: "用 Playwright 打开网页会话，可点选填字按键",
    handler: (args) =>
      webOpen(ROOT, {
        url: String(args?.url || ""),
        session: String(args?.session || "default"),
        headless: args?.headless === false ? false : true,
      }),
  });
  mcp.register({
    name: "nexus.web_snapshot",
    description: "列出当前网页可交互控件与推荐 selector",
    handler: (args) =>
      webSnapshot(ROOT, {
        session: String(args?.session || "default"),
        limit: Number(args?.limit) || 40,
      }),
  });
  mcp.register({
    name: "nexus.web_click",
    description: "按 CSS selector 点击网页控件",
    handler: (args) =>
      webClick(ROOT, {
        selector: String(args?.selector || ""),
        session: String(args?.session || "default"),
      }),
  });
  mcp.register({
    name: "nexus.web_type",
    description: "向网页输入框填字",
    handler: (args) =>
      webType(ROOT, {
        selector: String(args?.selector || ""),
        text: String(args?.text ?? ""),
        session: String(args?.session || "default"),
        clear: args?.clear !== false,
      }),
  });
  mcp.register({
    name: "nexus.web_keys",
    description: "网页模拟按键，如 Enter / Control+a / Tab",
    handler: (args) =>
      webKeys(ROOT, {
        key: String(args?.key || args?.keys || ""),
        session: String(args?.session || "default"),
      }),
  });
  mcp.register({
    name: "nexus.web_screenshot",
    description: "截当前网页会话画面",
    handler: (args) =>
      webScreenshot(ROOT, {
        session: String(args?.session || "default"),
        path: args?.path ? String(args.path) : undefined,
      }),
  });
  mcp.register({
    name: "nexus.web_close",
    description: "关闭网页操控会话",
    handler: (args) => webClose({ session: String(args?.session || "default") }),
  });

  agentWorkspaceRoot(ROOT);

  workflows.setHandlers({
    llm: async (prompt) => {
      if (!llm.snapshot().hasKey) return "";
      return llm.chat([
        { role: "system", content: frameworkSystemPrompt() },
        { role: "user", content: prompt },
      ]);
    },
    tool: async (name, args) => {
      const mapped = name.includes(".") ? name : `nexus.${name}`;
      try {
        return await mcp.call(mapped, args);
      } catch {
        try {
          return await mcp.call(name, args);
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) };
        }
      }
    },
    http: async (url, init) => {
      const method = String(init.method || "GET").toUpperCase();
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json", accept: "application/json" },
        body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(init.body ?? {}),
        signal: AbortSignal.timeout(20_000),
      });
      const text = await res.text();
      try {
        return { status: res.status, json: JSON.parse(text) };
      } catch {
        return { status: res.status, text: text.slice(0, 2000) };
      }
    },
  });

  const agentSkills = loadAgentSkills(ROOT);
  await bootLine(
    agentSkills.length ? `运行时技能 ${agentSkills.length} 个` : "运行时技能：无",
  );
  initEnvTasks(ROOT);

  const tokens = new Map<string, { user: string; exp: number }>();

  function invalidateAllSessions(): void {
    tokens.clear();
  }

  function issueToken(user: string): string {
    const hours = adminCfg.sessionHours || 12;
    const token = randomBytes(24).toString("hex");
    const exp = Date.now() + hours * 3600_000;
    tokens.set(hashToken(token), { user, exp });
    return token;
  }

  function authMiddleware(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ): void {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      res.status(401).json({ error: "未授权，请先登录" });
      return;
    }
    const rec = tokens.get(hashToken(token));
    if (!rec || rec.exp < Date.now()) {
      if (rec) tokens.delete(hashToken(token));
      res.status(401).json({ error: "登录已过期，请重新登录" });
      return;
    }
    (req as express.Request & { adminUser?: string }).adminUser = rec.user;
    next();
  }

  function shortCommit(): string {
    try {
      return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 5_000,
      }).trim();
    } catch {
      return "";
    }
  }

  function collectStatusInput(): StatusShotInput {
    const ob = onebot.status();
    const snap = llm.snapshot();
    const ch = getChannelSettings(channelCfg, "onebot11");
    const list = plugins.listConsole();
    const enabled = list.filter((p) => p.enabled !== false).length;
    const ap = activeProvider(llmStore);
    return {
      version: readLocalVersion(ROOT),
      commit: shortCommit() || undefined,
      envId: profile.id,
      envLabel: profile.label,
      powerOff,
      uptime: formatUptime(Date.now() - startedAt),
      gatewayPort: Number(process.env.PORT ?? profile.gateway.port),
      onebot: {
        enabled: ob.enabled,
        connected: ob.connected,
        selfId: ob.selfId,
        clients: ob.clients,
      },
      ai: {
        hasKey: Boolean(snap.hasKey),
        activeName: ap?.name,
        model: snap.model || ap?.model,
      },
      pluginsEnabled: enabled,
      pluginsTotal: list.length,
      replyGroupIds: ch.replyGroupIds || [],
      channels: channels.list().map((c) => {
        const s = getChannelSettings(channelCfg, c.id);
        return { id: c.id, label: s.label || c.label || c.id };
      }),
      plugins: list.map((p) => ({
        name: p.name || p.id,
        version: p.version,
        enabled: p.enabled !== false,
      })),
      db: {
        driver: db.info().driver,
        messages: db.stats().messages,
        plugins: db.stats().plugins,
        kv: db.stats().kv,
        path: db.info().filePath,
      },
      bots: (ob.bots || []).map((b) => ({
        selfId: b.selfId,
        label: b.label,
        connected: b.connected,
        apiBase: b.apiBase,
      })),
    };
  }

  let lastStatusLines: string[] | null = null;

  async function collectStatusHtml(): Promise<string> {
    const base = collectStatusInput();
    const totals = readOnlineTotals(db.getKv(ONLINE_KV));
    const [accounts, reach] = await Promise.all([
      collectStatusAccounts({
        bots: base.bots,
        call: (action, botId) => onebot.callAction(action, {}, { botId, timeoutMs: 8000 }),
        sessionMs: (id) => onebot.sessionMs(id),
        totalMs: (id) => totals[id] || 0,
        counts: (id) => db.countMessagesByAccount(id),
      }),
      probePublicReach(),
    ]);
    const input: StatusShotInput = { ...base, accounts, reach };
    lastStatusLines = buildStatusLines(input);
    return buildStatusPanelHtml(input);
  }

  function collectStatusLines(): string[] {
    return lastStatusLines || buildStatusLines(collectStatusInput());
  }

  setPluginRuntime({
    statusLines: collectStatusLines,
    statusHtml: () => collectStatusHtml(),
  });

  /** Process inbound message: # admin → plugins (first match) → LLM. Never local-echo. */
  async function processInbound(
    msg: NexusMessage,
    opts?: { isAdminConsole?: boolean; onDelta?: (text: string) => void },
  ): Promise<string[]> {
    const accountId = String(msg.meta?.selfId || msg.meta?.botId || "");
    const writeMsg = (row: {
      id: string;
      channel: string;
      chatId: string;
      userId: string;
      role: "user" | "assistant" | "system";
      content: string;
      createdAt: string;
      accountId?: string;
      raw?: string;
    }) => db.insertMessage({ ...row, accountId: row.accountId || accountId });
    const chSettings = getChannelSettings(channelCfg, msg.channel);
    const isMaster = isChannelMaster(chSettings, msg.userId);
    const isAdminConsole = Boolean(opts?.isAdminConsole);
    const capabilityMode = isMaster || isAdminConsole;
    const trimmedRaw = msg.content.trim();
    const trimmed = stripWakePrefix(trimmedRaw, botCfg);
    const isHash = trimmed.startsWith("#") || trimmed.startsWith(botCfg.commandPrefix || "#");
    const hashCmd = isHash
      ? resolveAdminHash(trimmed) ?? (trimmed.split(/\s+/)[0] ?? "")
      : "";

    if (powerOff && !isHash) {
      return [];
    }

    // Framework admin # only — plugin # goes to PluginHost by priority
    if (isHash && isAdminHash(hashCmd)) {
      const cmd = parseHashCommand(trimmed, {
        powerOff,
        isMaster,
        isAdminConsole,
        uptime: formatUptime(Date.now() - startedAt),
      });
      if (cmd.handled) {
        if (typeof cmd.powerOff === "boolean") powerOff = cmd.powerOff;

        let replies = [...cmd.replies];

        if (cmd.systemRestart) {
          const uptime = formatUptime(Date.now() - startedAt);
          replies = [buildRestartingMessage(uptime)];
          sessions.markAllForResume();
          const gid = originGroupId(msg);
          const mt = originMessageType(msg);
          saveRestartNotify(ROOT, {
            channel: msg.channel,
            chatId: gid ? `group:${gid}` : msg.chatId,
            userId: msg.userId,
            messageType: mt,
            groupId: gid,
            botId: String(msg.meta?.botId || msg.meta?.selfId || ""),
            requestedAt: nowIso(),
            previousUptime: uptime,
          });
          log.info(
            `已记重启回执目标：${mt}${gid ? ` 群 ${gid}` : ` 会话=${msg.chatId}`}  bot=${String(msg.meta?.botId || msg.meta?.selfId || "?")}`,
          );
        }

        let updateResult: Awaited<ReturnType<typeof applyFullUpdate>> | null = null;

        if (cmd.systemUpdate) {
          log.info(
            `收到 #更新  channel=${msg.channel}  user=${msg.userId}  chat=${msg.chatId}`,
          );
          const repoUrl = String(registry.pluginsRepo?.url || "").trim();
          updateResult = applyFullUpdate(ROOT, {
            pluginsRepoUrl: repoUrl || undefined,
            pluginsRepoBranch: registry.pluginsRepo?.branch || "main",
          });
          const upd = updateResult;
          if (!upd.ok) {
            const detail = upd.error ? `更新失败\n${upd.error}` : "更新失败";
            log.error(detail);
            replies = [detail];
          } else {
            const report = upd.reportText || upd.message;
            replies = [report];
            const gid = originGroupId(msg);
            const mt = originMessageType(msg);
            if (upd.shouldExit) {
              sessions.markAllForResume();
              const uptime = formatUptime(Date.now() - startedAt);
              saveRestartNotify(ROOT, {
                channel: msg.channel,
                chatId: gid ? `group:${gid}` : msg.chatId,
                userId: msg.userId,
                messageType: mt,
                groupId: gid,
                botId: String(msg.meta?.botId || msg.meta?.selfId || ""),
                requestedAt: nowIso(),
                previousUptime: uptime,
                updateSummary: upd.updateSummary || upd.changeItems || [],
              });
            }
            if (msg.channel === "onebot11") {
              try {
                let sent = false;
                if (upd.forwardNodes?.length) {
                  sent = await onebot.sendForward(upd.forwardNodes, {
                    ...msg,
                    chatId: gid ? `group:${gid}` : msg.chatId,
                    meta: { ...msg.meta, messageType: mt, groupId: gid },
                  });
                }
                if (!sent) {
                  sent = await onebot.sendText(report, {
                    ...msg,
                    chatId: gid ? `group:${gid}` : msg.chatId,
                    meta: { ...msg.meta, messageType: mt, groupId: gid },
                  });
                }
                log.info(
                  sent
                    ? `更新报告已发回原${mt === "group" ? `群 ${gid}` : "会话"}`
                    : "更新报告发送失败，将回退由回复通道再试",
                );
                if (sent) {
                  writeMsg({
                    id: newId("msg"),
                    channel: msg.channel,
                    chatId: gid ? `group:${gid}` : msg.chatId,
                    userId: "nexus",
                    role: "assistant",
                    content: report,
                    createdAt: nowIso(),
                  });
                  replies = [];
                }
              } catch (e) {
                log.warn(
                  `更新回执发送失败：${e instanceof Error ? e.message : String(e)}`,
                );
              }
            }
            for (const line of report.split(/\n/)) {
              if (line.trim()) log.info(`[更新] ${line}`);
            }
          }
        }

        for (const content of replies) {
          writeMsg({
            id: newId("msg"),
            channel: msg.channel,
            chatId: msg.chatId,
            userId: "nexus",
            role: "assistant",
            content,
            createdAt: nowIso(),
          });
        }
        writeMsg({
          id: msg.id,
          channel: msg.channel,
          chatId: msg.chatId,
          userId: msg.userId,
          role: "user",
          content: msg.content,
          createdAt: msg.createdAt,
          raw: archiveRaw(msg, capabilityMode),
        });

        if (cmd.systemUpdate) {
          const last = replies[0] ?? updateResult?.message ?? "";
          if (!updateResult?.ok || last.startsWith("更新失败")) {
            clearRestartNotify(ROOT);
            return replies.length ? replies : [last || "更新失败"];
          }
          // 已是最新：只通知，不重启
          if (!updateResult.shouldExit) {
            clearRestartNotify(ROOT);
            log.ok("已是最新，跳过重启");
            return replies.length ? replies : [updateResult.message];
          }
          const out =
            msg.channel === "onebot11" && replies.length === 0
              ? []
              : replies;
          const r = scheduleSystemRestart(ROOT);
          if (!r.ok) {
            clearRestartNotify(ROOT);
            log.error(`更新后重启失败：${r.message}`);
            return last ? [`${last}\n重启失败：${r.message}`] : [`重启失败：${r.message}`];
          }
          log.ok(`更新完成，同窗口重启（退出码 ${r.exitCode}）`);
          setTimeout(() => process.exit(r.exitCode), 2800);
          return out;
        }

        if (cmd.systemRestart) {
          const r = scheduleSystemRestart(ROOT);
          if (!r.ok) {
            clearRestartNotify(ROOT);
            log.error(`系统重启失败：${r.message}`);
            return [r.message];
          }
          log.ok(`已请求同窗口重启（退出码 ${r.exitCode}）`);
          setTimeout(() => process.exit(r.exitCode), 1200);
        }
        return replies;
      }
    }

    // 框架 / 插件 # 指令：任何群都可响应（不吃 AI 回复群白名单）
    // 软关机：仍允许只读诊断 #状态；其它插件 # 指令挡住
    if (powerOff && isHash && !isAdminHash(hashCmd)) {
      const allowDiag = /^#(状态|菜单|帮助|help)$/i.test(String(hashCmd || "").trim());
      if (!allowDiag) return [];
    }

    const session = sessions.getOrCreate({
      channel: msg.channel,
      chatId: msg.chatId,
      userId: msg.userId,
    });
    // 插件匹配用去掉呼唤前缀后的文本（nexus帮助 → #帮助）
    const pluginMsg = trimmed !== trimmedRaw ? { ...msg, content: trimmed } : msg;

    const pluginReplies = await Promise.race([
      plugins.onMessage(
        pluginMsg,
        (id) =>
          makePluginCtx(id, (m) => log.plugin(id, m), {
            channelId: msg.channel,
            eventUserId: msg.userId,
          }),
        async (id) => {
          const assign = getChannelPluginAssign(ROOT, msg.channel, id);
          if (msg.channel === "onebot11" && assign.accounts.length) {
            if (!accountId || !assign.accounts.includes(accountId)) return false;
          }
          const plug = plugins.get(id);
          if (plug?.setConfig) {
            const base = loadPluginConfigMap(ROOT)[id] || {};
            const own = accountId ? assign.byAccount[accountId] : undefined;
            const merged = own ? { ...base, ...own } : base;
            if (Object.keys(merged).length) await plug.setConfig(merged);
          }
          return true;
        },
      ),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("插件处理超时")), 55_000);
      }),
    ]).catch((e) => {
      const tip = e instanceof Error ? e.message : String(e);
      log.warn(`插件分发失败：${tip}`);
      return [
        {
          id: newId("msg"),
          channel: msg.channel,
          chatId: msg.chatId,
          userId: "nexus",
          type: "text" as const,
          content: tip.includes("超时") ? "插件处理超时，请稍后重试" : `插件异常：${tip}`,
          createdAt: nowIso(),
        },
      ];
    });

    if (pluginReplies.length) {
      sessions.append(session, "user", trimmed);
      writeMsg({
        id: msg.id,
        channel: msg.channel,
        chatId: msg.chatId,
        userId: msg.userId,
        role: "user",
        content: trimmed,
        createdAt: msg.createdAt,
        raw: archiveRaw(msg, capabilityMode),
      });
      const texts = pluginReplies.map((r) => {
        if (r.type === "image") {
          const url = r.attachments?.[0]?.url;
          if (url) {
            // OneBot / NapCat：CQ 图片；控制台也能看见路径提示
            return `[CQ:image,file=${url}]`;
          }
        }
        return r.content;
      }).filter(Boolean);
      for (const content of texts) {
        sessions.append(session, "assistant", content);
        writeMsg({
          id: newId("msg"),
          channel: msg.channel,
          chatId: msg.chatId,
          userId: "nexus",
          role: "assistant",
          content,
          createdAt: nowIso(),
        });
      }
      return texts;
    }

    if (
      !isHash &&
      msg.meta?.messageType === "group" &&
      !isGroupReplyAllowed(chSettings, msg.meta?.groupId as string | undefined)
    ) {
      return [];
    }

    if (!isHash && chSettings.onlyMasters && chSettings.masters.length && !isMaster) {
      return [];
    }

    if (!llm.snapshot().hasKey) {
      return [];
    }

    // 群聊：必须 @ 机器人，或开头呼唤词，才走 AI
    if (
      !shouldTriggerAi({
        channel: msg.channel,
        messageType: msg.meta?.messageType as string | undefined,
        content: trimmedRaw,
        atSelf: Boolean(msg.meta?.atSelf),
        bot: botCfg,
        isAdminConsole,
      })
    ) {
      return [];
    }

    const history: Array<{ role: "user" | "assistant" | "system"; content: string }> = [
      {
        role: "system",
        content: frameworkSystemPrompt({
          capability: capabilityMode,
          userId: msg.userId,
          senderName: msg.meta?.senderName,
        }),
      },
    ];
    const skillBlock = skillsPromptBlock(agentSkills);
    if (skillBlock) history.push({ role: "system", content: skillBlock });
    const persona = String(chSettings.systemPrompt || "").trim();
    if (persona) history.push({ role: "system", content: persona });
    // 给模型：去掉 @ 和呼唤前缀
    const userAsk = stripAtMentions(
      stripWakeForChat(trimmedRaw, botCfg),
      msg.meta?.selfId as string | undefined,
    );
    if (!userAsk || isJunkAiText(userAsk)) return [];

    sessions.append(session, "user", userAsk);
    writeMsg({
      id: msg.id,
      channel: msg.channel,
      chatId: msg.chatId,
      userId: msg.userId,
      role: "user",
      content: userAsk,
      createdAt: msg.createdAt,
      raw: archiveRaw(msg, capabilityMode),
    });

    history.push(
      ...session.turns.slice(-20).map((t) => ({
        role: t.role as "user" | "assistant" | "system",
        content: t.content,
      })),
    );
    const resumeHint = sessions.takeResumeHint(session);
    if (resumeHint) {
      history.splice(1, 0, { role: "system", content: resumeHint });
      log.info("会话续聊  重启前对话已接上");
    }

    const who = msg.meta?.senderName ? `${msg.meta.senderName}/${msg.userId}` : msg.userId;
    log.info(capabilityMode ? `对话鉴权 主人·能力模式  ${who}` : `对话鉴权 非主人·禁止能力  ${who}`);

    const capSink: string[] = [];
    const toolBag = {
      mcp,
      workflows,
      plugins,
      statusLines: collectStatusLines,
      channelSettings: () => getChannelSettings(channelCfg, msg.channel),
      userId: msg.userId,
      isMaster,
      isAdminConsole,
      capSink,
      invokeCapability: async (text: string) => {
        const fake: NexusMessage = {
          ...msg,
          id: newId("msg"),
          content: text.trim(),
          createdAt: nowIso(),
        };
        const replies = await Promise.race([
          plugins.onMessage(
            fake,
            (id) =>
              makePluginCtx(id, (m) => log.plugin(id, m), {
                channelId: msg.channel,
                eventUserId: msg.userId,
              }),
            async (id) => {
              const assign = getChannelPluginAssign(ROOT, msg.channel, id);
              if (msg.channel === "onebot11" && assign.accounts.length) {
                if (!accountId || !assign.accounts.includes(accountId)) return false;
              }
              const plug = plugins.get(id);
              if (plug?.setConfig) {
                const base = loadPluginConfigMap(ROOT)[id] || {};
                const own = accountId ? assign.byAccount[accountId] : undefined;
                const merged = own ? { ...base, ...own } : base;
                if (Object.keys(merged).length) await plug.setConfig(merged);
              }
              return true;
            },
          ),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("能力调用超时")), 20_000);
          }),
        ]).catch((e) => {
          const tip = e instanceof Error ? e.message : String(e);
          return [
            {
              id: newId("msg"),
              channel: msg.channel,
              chatId: msg.chatId,
              userId: "nexus",
              type: "text" as const,
              content: tip.includes("超时") ? "能力调用超时" : `能力调用失败：${tip}`,
              createdAt: nowIso(),
            },
          ];
        });
        return replies
          .map((r) => {
            if (r.type === "image") {
              const url = r.attachments?.[0]?.url;
              if (url) return `[CQ:image,file=${url}]`;
            }
            return r.content;
          })
          .filter(Boolean);
      },
      setPluginEnabled: (id: string, enabled: boolean) => {
        const p = plugins.get(id);
        if (!p) return { ok: false, message: "插件未找到" };
        plugins.setEnabled(id, enabled);
        db.upsertPlugin({
          id: p.manifest.id,
          name: p.manifest.name,
          version: p.manifest.version,
          enabled,
          loadedAt: nowIso(),
        });
        const message = enabled ? `已启用 ${p.manifest.name}` : `已停用 ${p.manifest.name}`;
        log.info(message);
        return { ok: true, message };
      },
      reloadPlugins: async () => {
        const result = await reloadPlugins(pluginHotDeps);
        return { ok: result.ok, message: result.message };
      },
      installPack: async (id: string) => {
        const ecoUrl = String(registry.ecosystemRepo?.url || "").trim();
        const result = installEcosystemPack(ROOT, id, {
          ecosystemRepoUrl: ecoUrl || undefined,
          ecosystemRepoBranch: registry.ecosystemRepo?.branch || "main",
        });
        if (result.ok && result.applied.length) {
          const reload = await reloadPlugins(pluginHotDeps);
          return {
            ok: result.ok,
            message: `${result.message}；${reload.ok ? "已热重载" : reload.message}`,
          };
        }
        return { ok: result.ok, message: result.message };
      },
      installRuntime: (runtime: string) => {
        try {
          const task = createInstallTask({ runtime: runtime as EnvRuntimeId });
          return { ok: true, message: `已加入安装队列：${task.runtime} ${task.version}` };
        } catch (e) {
          return { ok: false, message: e instanceof Error ? e.message : String(e) };
        }
      },
      listRuntimes: () => listRuntimes(),
      repoRoot: ROOT,
      messageCtx: msg,
      onebot,
      patchChannelSettings: (patch: Record<string, unknown>) => {
        const prev = getChannelSettings(channelCfg, msg.channel);
        const next: ChannelSettings = { ...prev };
        if (typeof patch.label === "string") next.label = patch.label;
        if (typeof patch.systemPrompt === "string") next.systemPrompt = patch.systemPrompt;
        if (typeof patch.note === "string") next.note = patch.note;
        if (typeof patch.onlyMasters === "boolean") next.onlyMasters = patch.onlyMasters;
        if (typeof patch.replyGroupIds === "string") {
          next.replyGroupIds = String(patch.replyGroupIds)
            .split(/[,，\s]+/)
            .map((s) => s.trim())
            .filter(Boolean);
        } else if (Array.isArray(patch.replyGroupIds)) {
          next.replyGroupIds = patch.replyGroupIds.map((x) => String(x).trim()).filter(Boolean);
        }
        channelCfg = {
          channels: { ...channelCfg.channels, [msg.channel]: next },
        };
        saveChannelsConfig(ROOT, channelCfg);
        return { ok: true, message: "通道设置已保存" };
      },
      getOneBotSnapshot: () => {
        const st = onebot.status();
        return {
          enabled: st.enabled,
          connected: st.connected,
          clients: st.clients,
          reverseWsPath: st.reverseWsPath,
          httpPath: st.httpPath,
          bots: (st.bots || []).map((b) => ({
            selfId: b.selfId,
            label: b.label,
            connected: b.connected,
            apiBase: b.apiBase,
            listenPort: b.listenPort,
          })),
        };
      },
      patchOneBotConfig: (patch: Record<string, unknown>) => {
        const prev = onebot.getConfig();
        const next: OneBotConfig = {
          ...prev,
          enabled: typeof patch.enabled === "boolean" ? patch.enabled : prev.enabled,
          reverseWsPath:
            typeof patch.reverseWsPath === "string" && patch.reverseWsPath
              ? String(patch.reverseWsPath)
              : prev.reverseWsPath,
          httpPath:
            typeof patch.httpPath === "string" && patch.httpPath
              ? String(patch.httpPath)
              : prev.httpPath,
        };
        persistOneBotConfig(next);
        onebot.updateConfig(next);
        return { ok: true, message: "OneBot 配置已保存", config: { ...next, accessToken: "" } };
      },
    };

    const llmDeadlineMs = capabilityMode ? 0 : 90_000;
    const toolRun = capabilityMode
      ? llm.chatWithTools(
          history,
          buildAgentToolDefs(mcp),
          async (name, args) => {
            const hint =
              name === "nexus_shell"
                ? ` ${String((args as { command?: string }).command || "")
                    .replace(/\s+/g, " ")
                    .slice(0, 160)}`
                : "";
            log.info(`工具 ${name}${hint}`);
            const result = await runAgentTool(name, args, toolBag);
            const raw = typeof result === "string" ? result : JSON.stringify(result ?? "");
            log.info(`工具回执 ${name}  ${raw.replace(/\s+/g, " ").slice(0, 180) || "空"}`);
            return result;
          },
          {
            ...(opts?.onDelta ? { onDelta: opts.onDelta } : {}),
            onTrace: (line) => log.info(line),
            maxRounds: 0,
          },
        )
      : llm.chat(history, opts?.onDelta ? { onDelta: opts.onDelta } : undefined);
    const assistant = (
      await (llmDeadlineMs > 0
        ? Promise.race([
            toolRun,
            new Promise<string>((_, reject) => {
              setTimeout(() => reject(new Error("AI 响应超时")), llmDeadlineMs);
            }),
          ])
        : toolRun
      ).catch((e) => {
        const tip = e instanceof Error ? e.message : String(e);
        log.warn(`LLM 调用失败：${tip}`);
        return tip.includes("超时") ? "AI 响应超时，我再试一次或说简单点。" : `AI 异常：${tip}`;
      })
    ).trim();

    let spoken = stripLeakedToolMarkup(assistant);
    // 泄出工具已在 chatWithTools 内正式执行；这里只清残留标记，避免再跑一遍
    if (capabilityMode && extractLeakedToolCalls(assistant).length) {
      log.info("正文里的工具调用已在对话循环里执行，不再重复补跑");
    }

    if (!spoken.trim() && capabilityMode) {
      spoken = "好了。";
      log.warn("能力模式结束后没有可发正文，已改发一句提示");
    }

    const { thinkingNodes, speak } = splitThinkingAndSpeak(spoken);
    // 回话按空行/分类拆成多条短气泡；思考只走合并转发，不占气泡
    const parts = speak ? splitAiSegments(speak) : [];
    const extra = capSink.map((x) => x.trim()).filter(Boolean);
    let thinkingForwarded = false;

    // QQ：思考用合并转发；控制台等通道仍把思考当普通文本段
    if (msg.channel === "onebot11" && thinkingNodes.length) {
      try {
        thinkingForwarded = await onebot.sendForward(thinkingNodes, msg, {
          nickname: "思考",
          userId: String(msg.meta?.selfId || msg.meta?.botId || "80000000"),
        });
        if (thinkingForwarded) log.info(`思考已合并转发  ${thinkingNodes.length} 段`);
        else log.warn("思考合并转发失败，改并入正文");
      } catch (e) {
        log.warn(`思考转发异常：${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (thinkingNodes.length && !thinkingForwarded) {
      parts.unshift(`思考：\n${thinkingNodes.join("\n\n")}`);
      if (parts.length > 5) {
        const head = parts.shift()!;
        const rest = parts.splice(0).join("\n\n");
        parts.push(head, rest);
      }
    }

    const all = [...parts, ...extra].filter((x) => x && !isJunkAiText(x));
    if (!all.length && thinkingForwarded) {
      log.warn("思考已发，标签外没有回话");
      all.push("还没写完，我接着弄。");
    }
    if (!all.length) return [];
    log.info(
      `AI 发出  思考 ${thinkingNodes.length} 段  回话 ${all.length} 条  ${all
        .join(" / ")
        .replace(/\s+/g, " ")
        .slice(0, 220)}`,
    );

    const replyJoined = all.join("\n\n");
    const storeAs =
      thinkingNodes.length && thinkingForwarded
        ? `思考：\n${thinkingNodes.join("\n\n")}${replyJoined ? `\n\n${replyJoined}` : ""}`
        : replyJoined;
    if (storeAs) {
      sessions.append(session, "assistant", storeAs);
      writeMsg({
        id: newId("msg"),
        channel: msg.channel,
        chatId: msg.chatId,
        userId: "nexus",
        role: "assistant",
        content: storeAs,
        createdAt: nowIso(),
      });
    }
    return all;
  }

  function tokenIsAdmin(req: express.Request): boolean {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return false;
    const rec = tokens.get(hashToken(token));
    return Boolean(rec && rec.exp >= Date.now());
  }

  async function handleChat(
    raw: unknown,
    opts?: { isAdminConsole?: boolean },
  ): Promise<{ replies: unknown[]; assistant: string }> {
    const web = channels.get("web")!;
    const msg = web.normalizeInbound(raw);
    const texts = await processInbound(msg, opts);
    let assistant = texts.join("\n");
    if (!assistant) {
      const c = String((raw as { content?: string } | null)?.content ?? "").trim();
      if (opts?.isAdminConsole) {
        if (c.startsWith("#")) {
          assistant = "未命中指令，发送 #帮助";
        } else {
          assistant = "无插件应答。管理指令发送 #帮助";
        }
      } else if (c.startsWith("#")) {
        assistant = "无权限或未登录";
      }
    }
    const replies = texts.map((content) =>
      web.formatOutbound({
        id: newId("msg"),
        channel: msg.channel,
        chatId: msg.chatId,
        userId: "nexus",
        type: "text",
        content,
        meta: { replyTo: msg.id },
        createdAt: nowIso(),
      }),
    );
    return { replies, assistant };
  }

  onebot.setEnrichInbound(async (msg, ev) => {
    const records = extractOb11Records(ev.message, ev.raw_message);
    if (!records.length) return msg;
    const dest = join(ROOT, "data", "agent-media");
    const texts: string[] = [];
    for (const rec of records.slice(0, 2)) {
      const dl = await onebot.downloadRecordFile(rec, dest);
      if (!dl.ok || !dl.path) {
        texts.push("（收到语音，下载失败）");
        continue;
      }
      const stt = await speechFileToText(dl.path);
      if (stt.ok && stt.text) texts.push(stt.text);
      else texts.push(`（收到语音，未能听写：${stt.message}）`);
    }
    const voiceText = texts.filter(Boolean).join(" ").trim();
    const merged = [msg.content.replace(/\[语音\]/g, "").trim(), voiceText]
      .filter(Boolean)
      .join("\n")
      .trim();
    return {
      ...msg,
      content: merged || voiceText || "（语音消息）",
      meta: { ...msg.meta, rawMessage: msg.meta?.rawMessage || ev.raw_message },
    };
  });
  onebot.setInboundHandler(async (msg) => processInbound(msg));
  onebot.setNoticeHandler(async (ev) => {
    const channelId = "onebot11";
    return plugins.emitNotice(ev, (id) =>
      makePluginCtx(id, (m) => log.plugin(id, m), {
        channelId,
        eventUserId: String(ev.user_id ?? ""),
      }),
    );
  });

  const app = express();
  if (profile.gateway.cors) app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.get("/v1/ob11-media/:name", (req, res) => {
    const file = resolveOb11Media(String(req.params.name || ""));
    if (!file) {
      res.status(404).end();
      return;
    }
    res.type(file.toLowerCase().endsWith(".png") ? "png" : "jpeg");
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(file);
  });

  app.get("/v1/media/shot/:name", (req, res) => {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ")
      ? header.slice(7)
      : String(req.query.token || "");
    const rec = token ? tokens.get(hashToken(token)) : undefined;
    if (!rec || rec.exp < Date.now()) {
      res.status(401).end();
      return;
    }
    const name = basename(String(req.params.name || ""));
    if (!/^[\w.-]+\.(png|svg)$/i.test(name)) {
      res.status(400).end();
      return;
    }
    const file = join(ROOT, "data", "draw", name);
    if (!existsSync(file)) {
      res.status(404).end();
      return;
    }
    res.type(name.toLowerCase().endsWith(".svg") ? "image/svg+xml" : "png");
    res.sendFile(file);
  });

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      product: "Fengyun Nexus",
      env: profile.id,
      label: profile.label,
      plugins: plugins.list().length,
      db: db.stats(),
      time: nowIso(),
    });
  });

  app.get("/v1/meta", (_req, res) => {
    res.json({
      product: "Fengyun Nexus",
      version: readLocalVersion(ROOT),
      env: profile,
      features: profile.features,
      admin: {
        setupCompleted: adminCfg.setupCompleted,
        sessionHours: adminCfg.sessionHours || 12,
        refreshInvalidatesSession: false,
      },
      plugins: {
        available: true,
        loaded: plugins.list().length,
        tips: scan.tips,
      },
      db: db.stats(),
      console: consoleAppearance,
    });
  });

  /** 控制台外观（壁纸等），登录页也可读 */
  app.get("/v1/console/appearance", (_req, res) => {
    res.json({
      ok: true,
      appearance: consoleAppearance,
      defaults: { wallpaperUrl: DEFAULT_WALLPAPER_URL },
    });
  });

  app.get("/v1/admin/console", authMiddleware, (_req, res) => {
    res.json({
      ok: true,
      appearance: consoleAppearance,
      defaults: { wallpaperUrl: DEFAULT_WALLPAPER_URL },
    });
  });

  app.put("/v1/admin/console", authMiddleware, (req, res) => {
    const body = (req.body ?? {}) as Partial<ConsoleAppearance>;
    let wallpaperUrl = consoleAppearance.wallpaperUrl;
    if (typeof body.wallpaperUrl === "string") {
      const next = body.wallpaperUrl.trim() || DEFAULT_WALLPAPER_URL;
      if (!isAllowedWallpaperUrl(next)) {
        res.status(400).json({
          error: "壁纸地址须为站点相对路径（如 /wallpapers/default.jpg）或 http(s) 链接",
          errorType: "bad_request",
        });
        return;
      }
      wallpaperUrl = next;
    }
    const fit = body.wallpaperFit;
    const next: ConsoleAppearance = {
      ...consoleAppearance,
      wallpaperUrl,
      wallpaperFit:
        fit === "contain" || fit === "fill" || fit === "cover"
          ? fit
          : consoleAppearance.wallpaperFit,
      wallpaperDim:
        typeof body.wallpaperDim === "number"
          ? body.wallpaperDim
          : typeof body.wallpaperDim === "string"
            ? Number(body.wallpaperDim)
            : consoleAppearance.wallpaperDim,
      note: typeof body.note === "string" ? body.note : consoleAppearance.note,
    };
    consoleAppearance = next;
    saveConsoleAppearance(ROOT, consoleAppearance);
    log.ok(`控制台外观已保存  wallpaper=${consoleAppearance.wallpaperUrl}`);
    res.json({ ok: true, message: "已保存", appearance: consoleAppearance });
  });

  /** 教程 / 示例：新窗口打开，路径仅允许 docs、模板、workflows */
  app.get("/v1/docs/view", (req, res) => {
    const path = String(req.query.path || "");
    const result = renderDocView(ROOT, path);
    res.status(result.ok ? 200 : result.status).type("html").send(result.html);
  });

  app.post("/v1/admin/login", (req, res) => {
    const { username, password } = req.body ?? {};
    const expectUser = adminCfg.username;
    const expectPass = currentPassword();
    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !safeEqual(username, expectUser) ||
      !safeEqual(password, expectPass)
    ) {
      res.status(401).json({ error: "用户名或密码错误" });
      log.warn(`管理登录失败  用户=${typeof username === "string" ? username : "?"}`);
      return;
    }
    const token = issueToken(expectUser);
    const mustReconfigure = !adminCfg.setupCompleted;
    log.info(`管理登录成功  用户=${expectUser}  需重设账号=${mustReconfigure ? "是" : "否"}`);
    res.json({
      token,
      username: expectUser,
      expiresInHours: adminCfg.sessionHours || 12,
      mustReconfigure,
      message: mustReconfigure
        ? "首次登录：请立即设置正式用户名与密码，然后重新登录。"
        : undefined,
    });
  });

  app.get("/v1/admin/me", authMiddleware, (req, res) => {
    res.json({
      user: (req as express.Request & { adminUser?: string }).adminUser,
      env: profile.id,
      setupCompleted: adminCfg.setupCompleted,
      mustReconfigure: !adminCfg.setupCompleted,
      expiresInHours: adminCfg.sessionHours || 12,
    });
  });

  app.get("/v1/admin/overview", authMiddleware, (req, res) => {
    if (!adminCfg.setupCompleted) {
      res.status(403).json({ error: "请先完成账号设置" });
      return;
    }
    res.json({
      env: profile,
      plugins: plugins.list(),
      channels: channels.list().map((c) => ({ id: c.id, label: c.label ?? c.id })),
      workflows: workflows.list().map((w) => ({ id: w.id, name: w.name })),
      sessions: sessions.list().length,
      mcpTools: mcp.list(),
      db: db.stats(),
      adminUser: (req as express.Request & { adminUser?: string }).adminUser,
    });
  });

  app.post("/v1/admin/setup-credentials", authMiddleware, (req, res) => {
    const { username, password, confirmPassword } = req.body ?? {};
    if (typeof username !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "请求参数无效" });
      return;
    }
    const uErr = validateUsername(username.trim());
    if (uErr) {
      res.status(400).json({ error: uErr });
      return;
    }
    const pErr = validatePassword(password);
    if (pErr) {
      res.status(400).json({ error: pErr });
      return;
    }
    if (password !== confirmPassword) {
      res.status(400).json({ error: "两次密码不一致" });
      return;
    }

    adminCfg = {
      ...adminCfg,
      username: username.trim(),
      defaultPassword: password,
      setupCompleted: true,
      sessionHours: 12,
    };
    delete process.env[adminCfg.passwordEnv];
    persistAdmin(adminCfg);
    invalidateAllSessions();
    res.json({
      ok: true,
      message: "凭据已更新，所有登录态已失效，请使用新用户名与密码重新登录。",
    });
  });

  app.post("/v1/admin/credentials", authMiddleware, (req, res) => {
    if (!adminCfg.setupCompleted) {
      res.status(403).json({ error: "请先完成账号设置" });
      return;
    }
    const { currentPassword: cur, username, password, confirmPassword } = req.body ?? {};
    if (typeof cur !== "string" || !safeEqual(cur, currentPassword())) {
      res.status(401).json({ error: "当前密码不正确" });
      return;
    }
    let nextUser = adminCfg.username;
    if (typeof username === "string" && username.trim()) {
      const uErr = validateUsername(username.trim());
      if (uErr) {
        res.status(400).json({ error: uErr });
        return;
      }
      nextUser = username.trim();
    }
    let nextPass = currentPassword();
    if (typeof password === "string" && password.length > 0) {
      const pErr = validatePassword(password);
      if (pErr) {
        res.status(400).json({ error: pErr });
        return;
      }
      if (password !== confirmPassword) {
        res.status(400).json({ error: "两次密码不一致" });
        return;
      }
      nextPass = password;
    }

    adminCfg = {
      ...adminCfg,
      username: nextUser,
      defaultPassword: nextPass,
      setupCompleted: true,
      sessionHours: 12,
    };
    delete process.env[adminCfg.passwordEnv];
    persistAdmin(adminCfg);
    invalidateAllSessions();
    res.json({
      ok: true,
      message: "用户名/密码已更新，所有登录态已失效，请重新登录。",
    });
  });

  app.get("/v1/plugins", authMiddleware, (_req, res) => {
    res.json({
      items: plugins.listConsole(),
      tips: scan.tips,
    });
  });

  app.post("/v1/plugins/reload", authMiddleware, async (_req, res) => {
    const result = await reloadPlugins(pluginHotDeps);
    res.status(result.ok ? 200 : 500).json({
      ok: result.ok,
      message: result.message,
      loaded: result.loaded,
      items: plugins.listConsole(),
    });
  });

  app.post("/v1/plugins/:id/enable", authMiddleware, (req, res) => {
    const id = String(req.params.id);
    const p = plugins.get(id);
    if (!p) {
      res.status(404).json({ error: "插件未找到", errorType: "not_found" });
      return;
    }
    plugins.setEnabled(id, true);
    db.upsertPlugin({
      id: p.manifest.id,
      name: p.manifest.name,
      version: p.manifest.version,
      enabled: true,
      loadedAt: nowIso(),
    });
    log.ok(`插件已启用  ${id}`);
    res.json({
      ok: true,
      message: `已启用 ${p.manifest.name}`,
      items: plugins.listConsole(),
    });
  });

  app.post("/v1/plugins/:id/disable", authMiddleware, (req, res) => {
    const id = String(req.params.id);
    const p = plugins.get(id);
    if (!p) {
      res.status(404).json({ error: "插件未找到", errorType: "not_found" });
      return;
    }
    plugins.setEnabled(id, false);
    db.upsertPlugin({
      id: p.manifest.id,
      name: p.manifest.name,
      version: p.manifest.version,
      enabled: false,
      loadedAt: nowIso(),
    });
    log.warn(`插件已停用  ${id}`);
    res.json({
      ok: true,
      message: `已停用 ${p.manifest.name}`,
      items: plugins.listConsole(),
    });
  });

  app.get("/v1/plugins/:id/config", authMiddleware, async (req, res) => {
    const id = String(req.params.id);
    const p = plugins.get(id);
    if (!p) {
      res.status(404).json({ error: "插件未找到", errorType: "not_found" });
      return;
    }
    if (!p.configSchema?.length) {
      res.json({
        ok: true,
        id,
        supported: false,
        message: "该插件暂未支持配置",
        schema: [],
        values: {},
      });
      return;
    }
    const values = (await p.getConfig?.()) ?? {};
    res.json({
      ok: true,
      id,
      supported: true,
      schema: p.configSchema,
      values,
    });
  });

  app.put("/v1/plugins/:id/config", authMiddleware, async (req, res) => {
    const id = String(req.params.id);
    const p = plugins.get(id);
    if (!p) {
      res.status(404).json({ error: "插件未找到", errorType: "not_found" });
      return;
    }
    if (!p.configSchema?.length || !p.setConfig) {
      res.status(400).json({
        error: "该插件暂未支持配置",
        errorType: "unsupported",
      });
      return;
    }
    const raw = (req.body ?? {}) as Record<string, unknown>;
    const body =
      raw.values && typeof raw.values === "object" && !Array.isArray(raw.values)
        ? (raw.values as Record<string, unknown>)
        : raw;
    const next: Record<string, unknown> = {};
    for (const field of p.configSchema) {
      if (Object.prototype.hasOwnProperty.call(body, field.key)) {
        if (field.type === "number") {
          const n = Number(body[field.key]);
          next[field.key] = Number.isFinite(n) ? n : field.default;
        } else if (field.type === "boolean") {
          next[field.key] = body[field.key] === true || body[field.key] === "true";
        } else {
          next[field.key] = body[field.key];
        }
      } else if (field.default !== undefined) {
        next[field.key] = field.default;
      }
    }
    await p.setConfig(next);
    const values = (await p.getConfig?.()) ?? next;
    savePluginConfig(ROOT, id, values);
    res.json({ ok: true, message: "已修改成功，立即生效", id, values });
  });

  app.get("/v1/channels", authMiddleware, (_req, res) => {
    res.json({
      items: channels.list().map((c) => {
        const s = getChannelSettings(channelCfg, c.id);
        const ob = c.id === "onebot11" ? onebot.status() : null;
        return {
          id: c.id,
          label: s.label || c.label || c.id,
          masters: s.masters,
          onlyMasters: s.onlyMasters,
          source: channels.sourceOf(c.id) || "core",
          connected: ob ? ob.connected : undefined,
          clients: ob ? ob.clients : undefined,
        };
      }),
    });
  });

  app.get("/v1/channels/:id/settings", authMiddleware, (req, res) => {
    const id = String(req.params.id);
    if (!channels.get(id)) {
      res.status(404).json({ error: "通道未找到", errorType: "not_found" });
      return;
    }
    res.json({
      ok: true,
      id,
      settings: getChannelSettings(channelCfg, id),
    });
  });

  app.put("/v1/channels/:id/settings", authMiddleware, (req, res) => {
    const id = String(req.params.id);
    if (!channels.get(id)) {
      res.status(404).json({ error: "通道未找到", errorType: "not_found" });
      return;
    }
    const body = (req.body ?? {}) as Partial<ChannelSettings>;
    const prev = getChannelSettings(channelCfg, id);
    const parseList = (v: unknown, fallback: string[]): string[] => {
      if (typeof v === "string") {
        return v
          .split(/[,，\s]+/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
      return fallback;
    };
    const hasTier =
      body.coreMasters != null || body.newMasters != null || body.normalMasters != null;
    let coreMasters = prev.coreMasters;
    let newMasters = prev.newMasters;
    let normalMasters = prev.normalMasters;
    if (hasTier) {
      coreMasters = parseList(body.coreMasters, prev.coreMasters);
      newMasters = parseList(body.newMasters, prev.newMasters);
      normalMasters = parseList(body.normalMasters, prev.normalMasters);
    } else if (body.masters != null) {
      // 旧字段：整表写成核心主人
      coreMasters = parseList(body.masters, prev.masters);
      newMasters = [];
      normalMasters = [];
    }
    const next: ChannelSettings = {
      ...prev,
      ...body,
      coreMasters,
      newMasters,
      normalMasters,
      masters: [...coreMasters, ...newMasters, ...normalMasters],
      replyGroupIds: parseList(body.replyGroupIds, prev.replyGroupIds),
      systemPrompt:
        typeof body.systemPrompt === "string" ? body.systemPrompt : prev.systemPrompt,
      onlyMasters:
        typeof body.onlyMasters === "boolean" ? body.onlyMasters : prev.onlyMasters,
      note: typeof body.note === "string" ? body.note : prev.note,
      label: typeof body.label === "string" ? body.label : prev.label,
    };
    channelCfg = {
      channels: { ...channelCfg.channels, [id]: next },
    };
    saveChannelsConfig(ROOT, channelCfg);
    const saved = getChannelSettings(channelCfg, id);
    log.ok(
      `通道配置已保存  ${id}  核心=${saved.coreMasters.join(",") || "—"}  新=${saved.newMasters.join(",") || "—"}  普通=${saved.normalMasters.join(",") || "—"}`,
    );
    res.json({
      ok: true,
      message: "已修改成功，立即生效",
      id,
      settings: saved,
    });
  });

  app.get("/v1/channels/:id/plugin-scope/:pluginId", authMiddleware, (req, res) => {
    const channelId = String(req.params.id);
    const pluginId = String(req.params.pluginId);
    if (!channels.get(channelId)) {
      res.status(404).json({ error: "通道未找到" });
      return;
    }
    res.json({ ok: true, ...getChannelPluginAssign(ROOT, channelId, pluginId) });
  });

  app.put("/v1/channels/:id/plugin-scope/:pluginId", authMiddleware, (req, res) => {
    const channelId = String(req.params.id);
    const pluginId = String(req.params.pluginId);
    if (!channels.get(channelId)) {
      res.status(404).json({ error: "通道未找到" });
      return;
    }
    const body = (req.body ?? {}) as {
      accounts?: unknown;
      accountId?: unknown;
      values?: unknown;
    };
    const prev = getChannelPluginAssign(ROOT, channelId, pluginId);
    const accounts = Array.isArray(body.accounts)
      ? body.accounts.map((x) => String(x || "").trim()).filter(Boolean)
      : prev.accounts;
    const byAccount = { ...prev.byAccount };
    const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
    if (accountId && body.values && typeof body.values === "object" && !Array.isArray(body.values)) {
      byAccount[accountId] = body.values as Record<string, unknown>;
    }
    const saved = saveChannelPluginAssign(ROOT, channelId, pluginId, { accounts, byAccount });
    if (accountId) {
      const plug = plugins.get(pluginId);
      const base = loadPluginConfigMap(ROOT)[pluginId] || {};
      if (plug?.setConfig) void plug.setConfig({ ...base, ...byAccount[accountId] });
    }
    res.json({ ok: true, message: "已修改成功，立即生效", ...saved });
  });

  app.get("/v1/workflows", authMiddleware, (_req, res) => {
    const local = listLocalWorkflows(ROOT);
    const byId = new Map(local.map((w) => [w.id, w]));
    res.json({
      items: workflows.list().map((w) => {
        const meta = byId.get(w.id);
        return {
          id: w.id,
          name: w.name,
          description: meta?.description,
          author: meta?.author,
          file: meta?.file,
          local: Boolean(meta),
        };
      }),
      guide: scaffoldWorkflowGuide(ROOT),
    });
  });

  app.post("/v1/workflows", authMiddleware, (req, res) => {
    const body = (req.body ?? {}) as {
      id?: string;
      name?: string;
      description?: string;
      author?: string;
    };
    const created = createLocalWorkflow(ROOT, {
      id: String(body.id || ""),
      name: String(body.name || ""),
      description: body.description ? String(body.description) : undefined,
      author: body.author ? String(body.author) : undefined,
    });
    if (!created.ok) {
      res.status(400).json({ error: created.error });
      return;
    }
    workflows.register(toWorkflowDef(created.workflow));
    log.ok(`已创建本地工作流 ${created.path}`);
    res.json({
      ...created,
      items: workflows.list(),
    });
  });

  app.post("/v1/workflows/:id/run", authMiddleware, async (req, res) => {
    const result = await workflows.run(String(req.params.id), req.body ?? {});
    res.json(result);
  });

  app.get("/v1/db/stats", authMiddleware, (_req, res) => {
    res.json({ ok: true, ...db.stats() });
  });

  app.get("/v1/mcp/tools", authMiddleware, (_req, res) => {
    res.json({ items: mcp.list() });
  });

  app.post("/v1/mcp/call", authMiddleware, async (req, res) => {
    try {
      const name = String(req.body?.name ?? "");
      const args = (req.body?.args ?? {}) as Record<string, unknown>;
      const result = await mcp.call(name, args);
      res.json({ ok: true, result });
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/v1/chat", authMiddleware, async (req, res) => {
    try {
      const result = await handleChat(req.body, {
        isAdminConsole: true,
      });
      res.json({ ok: true, ...result });
    } catch (e) {
      const t = formatErrorForClient(e);
      log.error(`${t.errorType}  ${t.raw ?? ""}`);
      res.status(500).json(t);
    }
  });

  app.post("/v1/chat/stream", authMiddleware, async (req, res) => {
    res.setHeader("content-type", "text/event-stream; charset=utf-8");
    res.setHeader("cache-control", "no-cache");
    res.setHeader("connection", "keep-alive");
    res.flushHeaders?.();
    const write = (obj: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
    };
    try {
      const web = channels.get("web")!;
      const msg = web.normalizeInbound(req.body);
      let streamed = "";
      const texts = await processInbound(msg, {
        isAdminConsole: true,
        onDelta: (delta) => {
          if (!delta) return;
          streamed += delta;
          write({ delta });
        },
      });
      let assistant = texts.join("\n");
      if (!assistant) {
        const c = String((req.body as { content?: string } | null)?.content ?? "").trim();
        assistant = c ? "未命中指令，发送 #帮助" : "";
      }
      // 若模型没走流式增量，把终稿一次补上
      if (!streamed && assistant) write({ delta: assistant });
      const replies = texts.map((content) => ({
        id: newId("msg"),
        channel: "web",
        chatId: msg.chatId,
        userId: "nexus",
        type: "text",
        content,
        createdAt: nowIso(),
      }));
      write({ done: true, assistant, replies });
      res.end();
    } catch (e) {
      write({ error: e instanceof Error ? e.message : String(e) });
      res.end();
    }
  });

  app.get("/v1/messages/recent", authMiddleware, (req, res) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 60)));
    const channel = typeof req.query.channel === "string" ? req.query.channel : "";
    const chatId = typeof req.query.chatId === "string" ? req.query.chatId : "";
    let items = chatId
      ? db.recentMessages(chatId, limit) // 旧 → 新，适合对话回放
      : db.recentAllMessages(limit); // 新 → 旧，适合动态流
    if (channel) items = items.filter((m) => m.channel === channel);
    res.json({
      ok: true,
      powerOff,
      items,
    });
  });

  app.post("/v1/channels/webhook", async (req, res) => {
    const adapter = channels.get("webhook")!;
    const msg = adapter.normalizeInbound(req.body);
    const texts = await processInbound(msg);
    const assistant = texts[0] ?? "";
    res.json(
      adapter.formatOutbound({
        id: newId("msg"),
        channel: "webhook",
        chatId: msg.chatId,
        userId: "nexus",
        type: "text",
        content: assistant,
        createdAt: nowIso(),
      }),
    );
  });

  /** OneBot 11 HTTP 上报（NapCat HTTP 客户端） */
  app.post(onebotCfg.httpPath, async (req, res) => {
    const q = typeof req.query.access_token === "string" ? req.query.access_token : null;
    if (!onebot.checkHttpAuth(req.headers.authorization, q)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const result = await onebot.handleHttpEvent(req.body);
    res.json(result);
  });

  function onebotPayload() {
    const st = onebot.status();
    const cfg = onebot.getConfig();
    const gwPort = Number(process.env.PORT ?? profile.gateway.port);
    const wsPath = cfg.reverseWsPath || st.reverseWsPath || "/onebot/v11/ws";
    const path = wsPath.startsWith("/") ? wsPath : `/${wsPath}`;
    const bind = String(process.env.HOST || "0.0.0.0").trim() || "0.0.0.0";
    const wsHosts = connectHosts(bind);
    const urlsFor = (listenPort: number) => {
      const p = listenPort > 0 ? listenPort : gwPort;
      return wsHosts.map((h) => `ws://${h}:${p}${path}`);
    };
    const bots = st.bots.map((b) => ({
      ...b,
      reverseWsUrls: urlsFor(b.listenPort),
    }));
    const reverseWsUrl = buildReverseWsUrl({
      port: gwPort,
      path,
      token: onebot.tokenFor(0),
    });
    const napcat = getNapCatStatus({
      root: ROOT,
      reverseWsUrl,
      connected: st.connected,
      selfId: st.selfId,
    });
    return {
      ...st,
      bots,
      reverseWsUrl,
      wsHosts,
      wsPath: path,
      gatewayPort: gwPort,
      napcat,
      config: cfg,
    };
  }

  app.get("/v1/channels/onebot11", authMiddleware, (_req, res) => {
    res.json({ ok: true, ...onebotPayload() });
  });

  app.get("/v1/admin/napcat", authMiddleware, (_req, res) => {
    const cfg = onebot.getConfig();
    const reverseWsUrl = buildReverseWsUrl({
      port: Number(process.env.PORT ?? profile.gateway.port),
      path: cfg.reverseWsPath || "/onebot/v11/ws",
      token: onebot.tokenFor(0),
    });
    const st = onebot.status();
    res.json({
      ok: true,
      ...getNapCatStatus({
        root: ROOT,
        reverseWsUrl,
        connected: st.connected,
        selfId: st.selfId,
      }),
      onebot: st,
    });
  });

  app.post("/v1/admin/napcat/launch", authMiddleware, (_req, res) => {
    const r = tryLaunchNapCat(ROOT);
    res.status(r.ok ? 200 : 400).json({ ok: r.ok, message: r.message });
  });

  app.post("/v1/admin/napcat/wire", authMiddleware, (_req, res) => {
    const cfg = onebot.getConfig();
    const reverseWsUrl = buildReverseWsUrl({
      port: Number(process.env.PORT ?? profile.gateway.port),
      path: cfg.reverseWsPath || "/onebot/v11/ws",
      token: onebot.tokenFor(0),
    });
    const marker = readNapCatMarker(ROOT);
    const home = marker?.home;
    if (!home) {
      res.status(400).json({ error: "尚未安装 NapCat，请先到环境配置安装" });
      return;
    }
    const files = wireNapCatConfigs(home, reverseWsUrl, onebot.tokenFor(0));
    const next = { ...cfg, enabled: true };
    persistOneBotConfig(next);
    onebot.updateConfig(next);
    res.json({
      ok: true,
      message: `已写入 ${files.length} 个配置，并启用 OneBot`,
      reverseWsUrl,
      files,
    });
  });

  app.post("/v1/channels/onebot11/config", authMiddleware, (req, res) => {
    const body = (req.body ?? {}) as Partial<OneBotConfig>;
    const prev = onebot.getConfig();
    const bots = Array.isArray(body.bots)
      ? body.bots.map((b) => ({
          selfId: String(b?.selfId || "").trim(),
          label: String(b?.label || "").trim(),
          listenPort: Math.floor(Number(b?.listenPort) || 0),
          apiBase: onebot.napcatApi(String(b?.apiBase || "").trim()),
          accessToken: String(b?.accessToken || "").trim(),
        }))
      : prev.bots;
    const next: OneBotConfig = {
      ...prev,
      enabled: typeof body.enabled === "boolean" ? body.enabled : prev.enabled,
      accessToken: typeof body.accessToken === "string" ? body.accessToken : prev.accessToken,
      reverseWsPath:
        typeof body.reverseWsPath === "string" && body.reverseWsPath
          ? body.reverseWsPath
          : prev.reverseWsPath,
      httpPath:
        typeof body.httpPath === "string" && body.httpPath ? body.httpPath : prev.httpPath,
      docsUrl: prev.docsUrl,
      bots,
    };
    persistOneBotConfig(next);
    onebot.updateConfig(next);
    log.info(`OneBot 11 配置已保存  enabled=${next.enabled}  bots=${next.bots.length}`);
    res.json({
      ok: true,
      message: "已修改成功，立即生效",
      ...onebotPayload(),
    });
  });

  app.get("/v1/registry", authMiddleware, (_req, res) => {
    res.json({
      ok: true,
      baseUrl: registry.baseUrl,
      tokenConfigured: Boolean(process.env[registry.tokenEnv]),
      tokenEnv: registry.tokenEnv,
      update: registry.update,
      pluginsRepo: registry.pluginsRepo || null,
      ecosystemRepo: registry.ecosystemRepo || null,
      /** 专仓地址只读，发行配置锁定，控制台不可改 */
      pluginsRepoLocked: true,
      ecosystemRepoLocked: true,
      categories: Object.entries(registry.categories).map(([id, c]) => ({
        id,
        label: c.label,
        path: c.path,
      })),
    });
  });

  /** 专仓地址不可经 API 修改 */
  app.patch("/v1/registry", authMiddleware, (req, res) => {
    if (req.body?.pluginsRepo !== undefined || req.body?.ecosystemRepo !== undefined) {
      res.status(403).json({
        error: "系统插件 / 生态专仓地址已锁定，不可在控制台修改",
        pluginsRepo: registry.pluginsRepo || null,
        ecosystemRepo: registry.ecosystemRepo || null,
      });
      return;
    }
    res.status(400).json({ error: "无可保存项" });
  });

  /** 对比本地 plugins/ 与远端是否一致 */
  app.get("/v1/registry/plugin-updates", authMiddleware, (_req, res) => {
    try {
      const repoUrl = String(registry.pluginsRepo?.url || "").trim();
      const result = checkPluginUpdates(ROOT, {
        branch: "main",
        pluginsRepoUrl: repoUrl || undefined,
        pluginsRepoBranch: registry.pluginsRepo?.branch || "main",
      });
      const need = result.items.filter(
        (i) => i.status === "update" || i.status === "remote-only",
      );
      const skipped = result.items.filter((i) => i.status === "same").length;
      const updates = need.length;
      const present = (i: (typeof result.items)[number]) => ({
        id: i.id,
        dir: i.dir,
        name: i.name,
        localVersion: i.localVersion,
        remoteVersion: i.remoteVersion,
        repoUrl: i.repoUrl,
        status: i.status,
        message: i.message,
      });
      res.json({
        ok: result.ok,
        source: result.source.replace(/\.git$/i, ""),
        branch: result.branch,
        items: need.map(present),
        skipped,
        summary: {
          total: result.items.length,
          update: updates,
          same: skipped,
          localOnly: result.items.filter((i) => i.status === "local-only").length,
          remoteOnly: result.items.filter((i) => i.status === "remote-only").length,
        },
        message:
          updates > 0
            ? `有 ${updates} 个插件有更新。${skipped ? `其余 ${skipped} 个无更新，已跳过。` : ""}`
            : skipped
              ? `已检测，${skipped} 个插件无更新，已跳过。`
              : "没有待更新的插件。",
      });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  /** 从专仓 / 本仓 origin 拉取不一致的插件目录，并热重载 */
  app.post("/v1/registry/plugin-updates/apply", authMiddleware, async (req, res) => {
    try {
      const repoUrl = String(registry.pluginsRepo?.url || "").trim();
      const dirs = Array.isArray(req.body?.dirs)
        ? (req.body.dirs as unknown[]).map((d) => String(d))
        : undefined;
      const result = applyPluginUpdates(ROOT, {
        branch: "main",
        pluginsRepoUrl: repoUrl || undefined,
        pluginsRepoBranch: registry.pluginsRepo?.branch || "main",
        dirs,
      });
      let reloadMsg = "";
      if (result.applied.length) {
        const reload = await reloadPlugins(pluginHotDeps);
        reloadMsg = reload.ok ? `；已热重载 ${reload.loaded} 个插件` : `；热重载失败：${reload.message}`;
      }
      res.json({
        ...result,
        message: `${result.message}${reloadMsg}`,
      });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  /** 生态专仓：读 catalog，对照本地安装状态 */
  app.get("/v1/registry/ecosystem", authMiddleware, (_req, res) => {
    try {
      const ecoUrl = String(registry.ecosystemRepo?.url || "").trim();
      const result = loadEcosystemCatalog(ROOT, {
        ecosystemRepoUrl: ecoUrl || undefined,
        ecosystemRepoBranch: registry.ecosystemRepo?.branch || "main",
      });
      res.json({
        ok: result.ok,
        source: result.source,
        message: result.message,
        hub: result.catalog?.hub || null,
        categories: result.catalog?.categories || [],
        items: result.items,
        localItems: listExtraInstalls(ROOT, result.items.map((i) => i.id)),
        ecosystemRepo: registry.ecosystemRepo || null,
      });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  /** 生态专仓：下载 path / git 收录并热重载 */
  app.post("/v1/registry/ecosystem/install", authMiddleware, async (req, res) => {
    try {
      const packId = String(req.body?.id || req.body?.packId || "").trim();
      if (!packId) {
        res.status(400).json({ error: "请指定要安装的收录 id" });
        return;
      }
      const ecoUrl = String(registry.ecosystemRepo?.url || "").trim();
      const result = installEcosystemPack(ROOT, packId, {
        ecosystemRepoUrl: ecoUrl || undefined,
        ecosystemRepoBranch: registry.ecosystemRepo?.branch || "main",
      });
      let reloadMsg = "";
      if (result.ok && result.applied.length) {
        const reload = await reloadPlugins(pluginHotDeps);
        reloadMsg = reload.ok
          ? `；已热重载 ${reload.loaded} 个插件`
          : `；热重载失败：${reload.message}`;
      }
      res.json({
        ...result,
        message: `${result.message}${reloadMsg}`,
      });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  /** 本地上传 zip 装进 plugins/。不登记到生态仓。 */
  app.post(
    "/v1/registry/ecosystem/upload",
    authMiddleware,
    express.raw({
      limit: "32mb",
      type: (req) => !String(req.headers["content-type"] || "").includes("application/json"),
    }),
    async (req, res) => {
      try {
        const zip = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        const result = installUploadedZip(ROOT, zip);
        let reloadMsg = "";
        if (result.ok && result.applied.length) {
          const reload = await reloadPlugins(pluginHotDeps);
          reloadMsg = reload.ok
            ? `；已热重载 ${reload.loaded} 个插件`
            : `；热重载失败：${reload.message}`;
        }
        res.status(result.ok ? 200 : 400).json({
          ...result,
          message: `${result.message}${reloadMsg}`,
        });
      } catch (e) {
        res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
      }
    },
  );

  /** 移除本机已下载的生态插件，不删系统插件 */
  app.post("/v1/registry/ecosystem/remove", authMiddleware, async (req, res) => {
    try {
      const id = String(req.body?.id || "").trim();
      const fallback = Array.isArray(req.body?.dirs) ? req.body.dirs.map((d: unknown) => String(d)) : [];
      const result = removeInstalledPack(ROOT, id, fallback);
      let reloadMsg = "";
      if (result.ok) {
        const reload = await reloadPlugins(pluginHotDeps);
        reloadMsg = reload.ok ? `；已热重载 ${reload.loaded} 个插件` : `；热重载失败：${reload.message}`;
      }
      res.status(result.ok ? 200 : 400).json({ ...result, message: `${result.message}${reloadMsg}` });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  /** 用投稿人自己的令牌登录，令牌不落盘 */
  app.post("/v1/registry/ecosystem/account", authMiddleware, async (req, res) => {
    try {
      const result = await loginGitAccount(String(req.body?.host || ""), String(req.body?.token || ""));
      res.status(result.ok ? 200 : 400).json(result);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/v1/registry/ecosystem/repos", authMiddleware, async (req, res) => {
    try {
      const result = await listOwnRepos(String(req.body?.host || ""), String(req.body?.token || ""));
      res.status(result.ok ? 200 : 400).json(result);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  /** 引用自己的公开仓库，向生态仓提 PR，等维护者审核 */
  app.post("/v1/registry/ecosystem/submit", authMiddleware, async (req, res) => {
    try {
      const result = await submitEcosystemPr(String(req.body?.host || ""), String(req.body?.token || ""), {
        repoUrl: req.body?.repoUrl,
        branch: req.body?.branch,
        id: req.body?.id,
        name: req.body?.name,
        description: req.body?.description,
        version: req.body?.version,
        category: req.body?.category,
        menus: Array.isArray(req.body?.menus) ? req.body.menus.map((m: unknown) => String(m)) : String(req.body?.menus || "").split(/[,，\s]+/),
      });
      res.status(result.ok ? 200 : 400).json(result);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.get("/v1/registry/ecosystem/reviews", authMiddleware, async (_req, res) => {
    try {
      const result = await listOpenReviews();
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.get("/v1/admin/llm", authMiddleware, (_req, res) => {
    const snap = llm.snapshot();
    res.json({
      ok: true,
      ...snap,
      ...publicProviders(llmStore),
    });
  });

  /** Realtime switch active provider (no restart). */
  app.post("/v1/admin/llm/switch", authMiddleware, (req, res) => {
    const id = String(req.body?.id ?? "");
    const hit = llmStore.providers.find((p) => p.id === id);
    if (!hit) {
      res.status(404).json({ error: "未找到该供应商", errorType: "not_found" });
      return;
    }
    llmStore = { ...llmStore, activeId: id };
    saveProvidersFile(ROOT, llmStore);
    applyProviderToLlm(llm, hit);
    log.ok(`AI 供应商已切换 → ${hit.name}（${hit.category}）`);
    res.json({
      ok: true,
      message: `已切换到 ${hit.name}，立即生效。`,
      ...llm.snapshot(),
      ...publicProviders(llmStore),
    });
  });

  app.post("/v1/admin/llm", authMiddleware, (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const targetId = String(body.id ?? llmStore.activeId);
    const providers = llmStore.providers.map((p) => {
      if (p.id !== targetId) return p;
      const next = { ...p };
      if (typeof body.name === "string" && body.name) next.name = body.name;
      if (typeof body.category === "string" && body.category) {
        next.category = body.category as LlmProvider["category"];
      }
      if (typeof body.baseUrl === "string") next.baseUrl = body.baseUrl;
      if (typeof body.model === "string") next.model = body.model;
      if (typeof body.apiKey === "string" && body.apiKey.length > 0) next.apiKey = body.apiKey;
      if (body.clearKey === true) next.apiKey = "";
      return next;
    });
    let activeId = llmStore.activeId;
    if (body.activate === true) activeId = targetId;
    llmStore = { activeId, providers };
    saveProvidersFile(ROOT, llmStore);
    applyProviderToLlm(llm, activeProvider(llmStore));
    log.info(`AI 供应商已更新  id=${targetId}  active=${activeId}`);
    res.json({
      ok: true,
      message: "供应商已保存并即时生效（本地 llm.local.json）。",
      ...llm.snapshot(),
      ...publicProviders(llmStore),
    });
  });

  app.get("/v1/logs", authMiddleware, (req, res) => {
    const limit = Number(req.query.limit ?? 120);
    const levelsRaw = String(req.query.levels || req.query.level || "").trim();
    const levels = levelsRaw
      ? levelsRaw.split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean)
      : [];
    const contains = String(req.query.contains || req.query.q || "").trim();
    if (levels.length || contains) {
      const q = queryLogEntries({ limit, levels, contains: contains || undefined });
      res.json({ ok: true, ...q });
      return;
    }
    res.json({ ok: true, items: getLogEntries(limit) });
  });

  app.get("/v1/admin/db", authMiddleware, (_req, res) => {
    res.json({
      ok: true,
      active: dbCfg.active,
      info: db.info(),
      stats: db.stats(),
      backends: Object.entries(dbCfg.backends).map(([id, b]) => ({
        id,
        ...b,
      })),
    });
  });

  app.get("/v1/admin/db/detect", authMiddleware, (_req, res) => {
    const items = NexusDatabase.detect();
    res.json({
      ok: true,
      items,
      active: dbCfg.active,
      info: db.info(),
      backends: Object.entries(dbCfg.backends).map(([id, b]) => ({
        id,
        ...b,
      })),
    });
  });

  app.post("/v1/admin/db/switch", authMiddleware, async (req, res) => {
    const id = String(req.body?.id ?? "") as "json" | "memory" | "sqlite";
    const pathOverride =
      typeof req.body?.path === "string" && req.body.path.trim()
        ? String(req.body.path).trim()
        : undefined;
    let b = dbCfg.backends[id];
    if (!b) {
      res.status(404).json({ error: "未知数据库驱动", errorType: "not_found" });
      return;
    }
    const detected = NexusDatabase.detect().find((d) => d.id === id);
    if (detected && !detected.available) {
      res.status(400).json({
        error: detected.reason || "当前环境无法使用该数据库",
        errorType: "unavailable",
      });
      return;
    }
    if (pathOverride) {
      b = { ...b, enabled: true, path: pathOverride };
      dbCfg = {
        ...dbCfg,
        backends: { ...dbCfg.backends, [id]: b },
      };
    }
    if (!b.enabled) {
      res.status(400).json({
        error: "该数据库未启用。请先在配置中开启，或换已启用的驱动。",
        errorType: "disabled",
      });
      return;
    }
    dbCfg = { ...dbCfg, active: id };
    saveDbConfig(ROOT, dbCfg);
    const open = resolveDbOpenOpts(ROOT, dbCfg);
    try {
      db.close();
    } catch {
      /* ignore */
    }
    db = new NexusDatabase({ driver: open.driver, filePath: open.filePath });
    await db.open();
    log.ok(`数据库已切换 → ${open.driver}  ${open.label}`);
    res.json({
      ok: true,
      message: `已切换到 ${open.label}，立即生效。`,
      active: open.active,
      info: db.info(),
      stats: db.stats(),
      backends: Object.entries(dbCfg.backends).map(([bid, bb]) => ({
        id: bid,
        ...bb,
      })),
    });
  });

  app.get("/v1/admin/env-runtimes", authMiddleware, (_req, res) => {
    res.json({ ok: true, runtimes: listRuntimes(), counts: taskCounts() });
  });

  app.post("/v1/admin/env-runtimes/auto-queue", authMiddleware, (_req, res) => {
    const result = autoQueueMissing();
    res.json({
      ok: true,
      message:
        result.queued.length > 0
          ? `已自动排队 ${result.queued.length} 个未安装环境`
          : "所需环境均已就绪",
      queued: result.queued,
      skipped: result.skipped,
      items: listTasks(),
      counts: taskCounts(),
      runtimes: listRuntimes(),
    });
  });

  app.get("/v1/admin/env-tasks", authMiddleware, (_req, res) => {
    res.json({ ok: true, items: listTasks(), counts: taskCounts() });
  });

  app.get("/v1/admin/env-tasks/:id", authMiddleware, (req, res) => {
    const task = getTask(String(req.params.id));
    if (!task) {
      res.status(404).json({ error: "任务未找到" });
      return;
    }
    res.json({ ok: true, task });
  });

  app.post("/v1/admin/env-tasks", authMiddleware, (req, res) => {
    try {
      const runtime = String(req.body?.runtime ?? "") as EnvRuntimeId;
      const version = req.body?.version ? String(req.body.version) : undefined;
      const mode = req.body?.mode
        ? (String(req.body.mode) as "compile" | "binary")
        : undefined;
      const task = createInstallTask({ runtime, version, mode, auto: Boolean(req.body?.auto) });
      res.json({
        ok: true,
        message: "已加入队列并自动开始",
        task,
        counts: taskCounts(),
        items: listTasks(),
      });
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/v1/admin/env-tasks/:id/status", authMiddleware, (req, res) => {
    const status = String(req.body?.status ?? "") as EnvTaskStatus;
    const allowed: EnvTaskStatus[] = [
      "pending",
      "running",
      "paused",
      "done",
      "failed",
      "cancelled",
    ];
    if (!allowed.includes(status)) {
      res.status(400).json({ error: "状态无效" });
      return;
    }
    const task = setTaskStatus(String(req.params.id), status);
    if (!task) {
      res.status(404).json({ error: "任务未找到" });
      return;
    }
    res.json({ ok: true, task, counts: taskCounts(), items: listTasks() });
  });

  app.delete("/v1/admin/env-tasks/:id", authMiddleware, (req, res) => {
    const result = removeTask(String(req.params.id));
    if (!result.ok) {
      res.status(404).json({ error: result.message });
      return;
    }
    res.json({
      ok: true,
      message: result.message,
      counts: taskCounts(),
      items: listTasks(),
    });
  });

  app.post("/v1/admin/env-tasks/:id/remove", authMiddleware, (req, res) => {
    const result = removeTask(String(req.params.id));
    if (!result.ok) {
      res.status(404).json({ error: result.message });
      return;
    }
    res.json({
      ok: true,
      message: result.message,
      counts: taskCounts(),
      items: listTasks(),
    });
  });

  app.get("/v1/admin/update/check", authMiddleware, (_req, res) => {
    const fw = checkRemoteUpdate(ROOT);
    const repoUrl = String(registry.pluginsRepo?.url || "").trim();
    let plugins: {
      available: number;
      skipped: number;
      items: Array<{
        name: string;
        dir: string;
        status: string;
        repoUrl?: string;
        detail?: string;
      }>;
    } = { available: 0, skipped: 0, items: [] };
    if (repoUrl) {
      try {
        const checked = checkPluginUpdates(ROOT, {
          pluginsRepoUrl: repoUrl,
          pluginsRepoBranch: registry.pluginsRepo?.branch || "main",
        });
        const need = checked.items.filter(
          (i) => i.status === "update" || i.status === "remote-only",
        );
        plugins = {
          available: need.length,
          skipped: checked.items.filter((i) => i.status === "same").length,
          items: need.map((i) => ({
            name: i.name || i.id || i.dir,
            dir: i.dir,
            status: i.status,
            repoUrl: (i.repoUrl || repoUrl).replace(/\.git$/i, ""),
            detail:
              i.localVersion && i.remoteVersion && i.localVersion !== i.remoteVersion
                ? `${i.localVersion} → ${i.remoteVersion}`
                : i.message || "有更新",
          })),
        };
      } catch (e) {
        plugins = {
          available: 0,
          skipped: 0,
          items: [
            {
              name: "系统插件",
              dir: "",
              status: "error",
              detail: e instanceof Error ? e.message : String(e),
            },
          ],
        };
      }
    }
    const updateAvailable = Boolean(fw.updateAvailable) || plugins.available > 0;
    const bits: string[] = [];
    if (fw.updateAvailable) {
      const cur = fw.currentVersion || "?";
      const rem = fw.remoteVersion || cur;
      bits.push(cur === rem ? `主框架 ${cur} 有新内容` : `主框架 ${cur} → ${rem}`);
    }
    if (plugins.available) bits.push(`系统插件 ${plugins.available} 个有更新`);
    const skipLine = plugins.skipped
      ? `${plugins.skipped} 个插件无更新，已跳过`
      : "";
    res.status(fw.ok ? 200 : 502).json({
      ok: fw.ok,
      currentVersion: fw.currentVersion,
      remoteVersion: fw.remoteVersion,
      repoUrl: fw.repoUrl,
      updateAvailable,
      message: [updateAvailable ? `发现更新：${bits.join("，")}` : fw.ok ? `主框架已是最新，版本 ${fw.currentVersion || ""}` : fw.message, skipLine]
        .filter(Boolean)
        .join("。"),
      plugins,
      pluginsRepoUrl: repoUrl.replace(/\.git$/i, ""),
    });
  });

  app.post("/v1/admin/update/apply", authMiddleware, (req, res) => {
    if (!req.body?.confirm) {
      res.status(400).json({ error: "请确认后更新", errorType: "confirm_required" });
      return;
    }
    const repoUrl = String(registry.pluginsRepo?.url || "").trim();
    const result = applyFullUpdate(ROOT, {
      pluginsRepoUrl: repoUrl || undefined,
      pluginsRepoBranch: registry.pluginsRepo?.branch || "main",
    });
    if (!result.ok) {
      res.status(500).json(result);
      return;
    }
    res.json(result);
    if (result.shouldExit) {
      const r = scheduleSystemRestart(ROOT);
      if (r.ok) {
        log.ok(`更新完成，同窗口重启（退出码 ${r.exitCode}）`);
      } else {
        log.warn(`更新完成，但重启标记失败：${r.message}`);
      }
      setTimeout(() => process.exit(r.ok ? r.exitCode : 0), 2800);
    }
  });

  app.get("/v1/admin/bot", authMiddleware, (_req, res) => {
    res.json({ ok: true, bot: botCfg });
  });

  app.put("/v1/admin/bot", authMiddleware, (req, res) => {
    const body = (req.body ?? {}) as Partial<BotConfig>;
    const next: BotConfig = {
      ...botCfg,
      name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : botCfg.name,
      wakePrefixes: Array.isArray(body.wakePrefixes)
        ? body.wakePrefixes.map((x) => String(x).trim()).filter(Boolean)
        : typeof body.wakePrefixes === "string"
          ? String(body.wakePrefixes)
              .split(/[,，\s]+/)
              .map((s) => s.trim())
              .filter(Boolean)
          : botCfg.wakePrefixes,
      commandPrefix:
        typeof body.commandPrefix === "string" && body.commandPrefix
          ? body.commandPrefix
          : botCfg.commandPrefix,
      note: typeof body.note === "string" ? body.note : botCfg.note,
    };
    botCfg = next;
    saveBotConfig(ROOT, botCfg);
    log.ok(`机器人配置已保存  name=${botCfg.name}  前缀=${botCfg.wakePrefixes.join(",") || "无"}`);
    res.json({ ok: true, message: "已保存", bot: botCfg });
  });

  app.get("/v1/admin/dev/plugins", authMiddleware, (_req, res) => {
    res.json({
      ok: true,
      items: listPluginDirs(ROOT),
      guide: scaffoldPluginGuide(ROOT),
    });
  });

  app.get("/v1/admin/dev/plugins/:dir/files", authMiddleware, (req, res) => {
    const dir = String(req.params.dir || "");
    res.json({ ok: true, dir, files: listPluginFiles(ROOT, dir) });
  });

  app.get("/v1/admin/dev/file", authMiddleware, (req, res) => {
    const path = String(req.query.path ?? "");
    const r = readPluginFile(ROOT, path);
    if (!r.ok) {
      res.status(400).json({ error: r.error });
      return;
    }
    res.json({ ok: true, path: r.path, content: r.content });
  });

  app.put("/v1/admin/dev/file", authMiddleware, (req, res) => {
    const path = String(req.body?.path ?? "");
    const content = String(req.body?.content ?? "");
    const r = writePluginFile(ROOT, path, content);
    if (!r.ok) {
      res.status(400).json({ error: r.error });
      return;
    }
    log.ok(`已保存插件文件 ${r.path}`);
    res.json({ ok: true, path: r.path, message: "已保存，插件热重载会自动生效" });
  });

  app.get("/v1/admin/dev/new-plugin", authMiddleware, (_req, res) => {
    res.json({ ok: true, ...scaffoldPluginGuide(ROOT) });
  });

  app.post("/v1/admin/dev/plugins", authMiddleware, async (req, res) => {
    const body = (req.body ?? {}) as {
      id?: string;
      name?: string;
      version?: string;
      author?: string;
      description?: string;
      kind?: "framework" | "channel";
    };
    const created = createLocalPlugin(ROOT, {
      id: String(body.id || ""),
      name: String(body.name || ""),
      version: body.version ? String(body.version) : undefined,
      author: body.author ? String(body.author) : undefined,
      description: body.description ? String(body.description) : undefined,
      kind: body.kind === "channel" ? "channel" : "framework",
    });
    if (!created.ok) {
      res.status(400).json({ error: created.error });
      return;
    }
    const reload = await reloadPlugins(pluginHotDeps);
    log.ok(`已创建本地插件 ${created.path}`);
    res.json({
      ...created,
      reload,
      items: plugins.listConsole(),
      guide: scaffoldPluginGuide(ROOT),
    });
  });

  const distHtml = join(WEB_DIST, "index.html");
  const pubHtml = join(PUBLIC_FALLBACK, "index.html");
  const distOk = existsSync(distHtml);
  const pubOk = existsSync(pubHtml);
  let staticRoot: string | null = null;
  if (distOk && pubOk) {
    // 谁新用谁：避免旧 dist 一直压住 git 里已更新的 public
    try {
      staticRoot =
        statSync(distHtml).mtimeMs >= statSync(pubHtml).mtimeMs ? WEB_DIST : PUBLIC_FALLBACK;
    } catch {
      staticRoot = WEB_DIST;
    }
  } else if (distOk) {
    staticRoot = WEB_DIST;
  } else if (pubOk) {
    staticRoot = PUBLIC_FALLBACK;
  }

  /** 默认壁纸：优先 Web public，其次 assets/console */
  const wallPublic = join(ROOT, "apps/web/public/wallpapers/default.jpg");
  const wallAsset = join(ROOT, "assets/console/wallpaper-default.jpg");
  const wallFile = existsSync(wallPublic) ? wallPublic : existsSync(wallAsset) ? wallAsset : null;
  if (wallFile) {
    app.get("/wallpapers/default.jpg", (_req, res) => {
      res.type("jpg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.sendFile(wallFile);
    });
  }

  if (staticRoot) {
    app.use(
      express.static(staticRoot, {
        setHeaders(res, filePath) {
          if (filePath.endsWith("index.html") || filePath.endsWith(`${sep}index.html`)) {
            res.setHeader("Cache-Control", "no-store");
          }
        },
      }),
    );
    app.get(["/", "/console", "/index.html"], (_req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.sendFile(join(staticRoot, "index.html"));
    });
  } else {
    app.get("/", (_req, res) => {
      res
        .status(503)
        .type("text")
        .send("Fengyun Nexus console not built. Run: pnpm --filter @fengyun/nexus-web build");
    });
  }

  const port = Number(process.env.PORT ?? profile.gateway.port);
  // 默认听所有网卡。只要本机访问时再设 HOST=127.0.0.1
  const host = String(process.env.HOST || "0.0.0.0").trim() || "0.0.0.0";

  try {
    const opened = ensureGatewayPortOpen({ envId: profile.id, host, port });
    if (opened.attempted && !opened.ok) log.warn(opened.message);
  } catch (e) {
    log.warn(`端口放行跳过：${e instanceof Error ? e.message : String(e)}`);
  }

  const urls = consoleUrls(port, host);
  const publicIp = host === "0.0.0.0" || host === "::" ? await lookupPublicIpv4() : "";
  if (publicIp) urls.unshift(`http://${publicIp}:${port}/`);
  {
    const hosts = connectHosts(host, publicIp);
    const mediaHost = hosts.find((h) => h !== "127.0.0.1") || hosts[0] || "127.0.0.1";
    setOb11MediaHost(mediaHost);
  }
  const server = app.listen(port, host, async () => {
    onebot.attach(server);
    await bootGroup("网关");
    await bootLine("开始启动网关");
    await bootLine(`网关已监听：${host}:${port}`);
    const primary = urls.find((u) => !u.includes("127.0.0.1"));
    const local = urls.find((u) => u.includes("127.0.0.1"));
    if (primary) await bootLine(`控制台已打开：${primary}`);
    if (local && local !== primary) await bootLine(`本机控制台：${local}`);
    if (onebot.getConfig().enabled) {
      const cfg = onebot.getConfig();
      const wsPath = cfg.reverseWsPath || "/onebot/v11/ws";
      const hosts = connectHosts(host, publicIp);
      const show = hosts.find((h) => h !== "127.0.0.1") || hosts[0] || "127.0.0.1";
      const ports = new Set<number>([port]);
      for (const b of cfg.bots || []) {
        const p = Math.floor(Number(b.listenPort) || 0);
        if (p > 0 && p < 65536) ports.add(p);
      }
      await bootGroup("OneBot");
      await bootLine("开始准备反向连接");
      for (const p of ports) {
        const names = (cfg.bots || [])
          .filter((b) => {
            const lp = Math.floor(Number(b.listenPort) || 0);
            return lp === p || (p === port && !lp);
          })
          .map((b) => b.label || b.selfId || "")
          .filter(Boolean);
        const tag = names.length ? names.join("、") : p === port ? "网关" : "独立端口";
        await bootLine(`反向地址已列出：${tag}  ws://${show}:${p}${wsPath}`);
      }
    }
    void printBootSuccess();
    warnBootGaps({
      root: ROOT,
      setupCompleted: Boolean(adminCfg.setupCompleted),
      onebotEnabled: onebot.getConfig().enabled,
      onebotConnected: () => onebot.status().connected,
    });
    void deliverRestartSuccessNotice();

    // 后端终端输入（跑代码的那个窗口），不是网页
    startTerminalRepl({
      logTip: (m) => log.ok(m),
      onLine: async (line) => {
        const result = await handleChat(
          { content: line, chatId: "terminal-main", userId: "terminal-admin" },
          { isAdminConsole: true },
        );
        if (result.assistant) return [result.assistant];
        return result.replies
          .map((r) => {
            if (r && typeof r === "object" && "content" in (r as object)) {
              return String((r as { content?: string }).content ?? "");
            }
            return "";
          })
          .filter(Boolean);
      },
    });
  });

  async function deliverRestartSuccessNotice(): Promise<void> {
    const pending = peekRestartNotify(ROOT);
    if (!pending) return;

    const ageMs = Date.now() - Date.parse(pending.requestedAt || "");
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 10 * 60_000) {
      clearRestartNotify(ROOT);
      log.info("重启回执记录过期或无效，已丢弃");
      return;
    }
    // 先清掉，避免这次发失败后手动再启又补发刷屏
    clearRestartNotify(ROOT);

    const restartTook = formatUptime(ageMs);
    const loaded = plugins
      .listConsole()
      .filter((p) => p.enabled !== false)
      .map((p) => ({ id: p.id, name: p.name, version: p.version }));
    const shotOpts = {
      previousUptime: pending.previousUptime,
      restartTook,
      version: readLocalVersion(ROOT),
      commit: shortCommit() || undefined,
      updateSummary: pending.updateSummary,
    };
    const lines = buildRestartOkLines(loaded, shotOpts);
    const text = lines.join("\n");

    let sendPayload = "";
    try {
      const html = buildRestartOkPanelHtml(loaded, shotOpts);
      const shot = await renderHtmlShot({
        html,
        selector: "#panel",
        width: 720,
        height: 960,
      });
      if (shot.ok) {
        sendPayload = `[CQ:image,file=${pathToFileURL(shot.pngPath).href}]`;
      }
    } catch (e) {
      log.warn(`重启报告出图失败：${e instanceof Error ? e.message : String(e)}`);
    }
    if (!sendPayload) {
      log.warn("重启成功图没画出来，不发文字");
      return;
    }

    db.insertMessage({
      id: newId("msg"),
      channel: pending.channel,
      chatId: pending.chatId,
      userId: "nexus",
      role: "assistant",
      content: text,
      createdAt: nowIso(),
    });

    if (pending.channel === "onebot11") {
      const gid =
        pending.groupId ||
        (pending.chatId.startsWith("group:") ? pending.chatId.slice(6) : undefined);
      const mt = pending.messageType || (gid ? "group" : "private");
      const ctx = {
        id: newId("msg"),
        channel: "onebot11" as const,
        chatId: gid ? `group:${gid}` : pending.chatId,
        userId: pending.userId,
        type: "text" as const,
        content: sendPayload,
        meta: {
          messageType: mt,
          groupId: gid,
          botId: pending.botId || undefined,
          selfId: pending.botId || undefined,
        },
        createdAt: nowIso(),
      };
      const botHint = pending.botId || "最近连上的号";
      log.info(`重启回执准备发往 bot=${botHint}${gid ? ` 群 ${gid}` : ""}`);
      for (let i = 0; i < 20; i++) {
        const live = pending.botId
          ? onebot.listConnectedSelfIds().includes(pending.botId)
          : onebot.status().connected;
        if (!live) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        const imgOk = await onebot.sendText(sendPayload, { ...ctx, content: sendPayload });
        if (imgOk) {
          log.ok(`重启成功图已发回原${mt === "group" ? `群 ${gid}` : "会话"}`);
          return;
        }
        log.warn("重启成功图没发出，不改发文字");
        return;
      }
      log.warn("重启成功图未发出：目标号没连上");
      return;
    }

    log.ok("重启成功通知已写入消息流");
  }

  server.on("error", (err) => {
    const t = translateError(err);
    log.error(`${t.title}（${t.type}）`);
    log.error(t.hint);
    log.error(`原始信息：${t.raw}`);
    process.exit(1);
  });
}

bootstrap().catch((e) => {
  const t = translateError(e);
  log.error(`${t.title}（${t.type}）`);
  log.error(t.hint);
  log.error(`原始信息：${t.raw}`);
  process.exit(1);
});
