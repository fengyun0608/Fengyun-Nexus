import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import {
  ChannelRegistry,
  WebChannel,
  WebhookChannel,
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
import { bootStep, printBootBanner, printBootSuccess } from "./boot-banner.js";
import { checkPluginUpdates, applyPluginUpdates } from "./registry-check.js";
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
  setTaskStatus,
  taskCounts,
  type EnvRuntimeId,
  type EnvTaskStatus,
} from "./env-tasks.js";
import { applyRemoteUpdate, checkRemoteUpdate, readLocalVersion } from "./update-check.js";
import { applyFullUpdate } from "./full-update.js";
import { buildRestartOkLines, buildRestartOkPanelHtml, buildStatusLines, buildStatusPanelHtml, type StatusShotInput } from "./status-shot.js";
import { execFileSync } from "node:child_process";
import { loadBotConfig, saveBotConfig, stripWakePrefix, shouldTriggerAi, stripAtMentions, stripWakeForChat, type BotConfig } from "./bot-config.js";
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
import { pathToFileURL } from "node:url";
import { renderHtmlShot, renderMenuShot } from "./menu-shot.js";
import { makePluginCtx, setPluginRuntime } from "./plugin-ctx.js";
import { splitAiSegments } from "./ai-segments.js";
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
import { reloadPlugins, watchPluginsHotReload } from "./plugin-hot-reload.js";
import { getLogEntries, log } from "./log.js";
import {
  activeProvider,
  loadProvidersFile,
  publicProviders,
  saveProvidersFile,
  type LlmProvider,
} from "./llm-store.js";
import { OneBot11Bridge, type OneBotConfig } from "./onebot11-bridge.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../..");
const ADMIN_LOCAL = join(ROOT, "configs/admin.local.json");
const RUNTIME_LOCAL = join(ROOT, "configs/runtime.local.json");
const ONEBOT_LOCAL = join(ROOT, "configs/onebot.local.json");
const WEB_DIST = join(ROOT, "apps/web/dist");
const PUBLIC_FALLBACK = join(__dirname, "../public");
const PLUGINS_DIR = join(ROOT, "plugins");

function loadOneBotConfig(): OneBotConfig {
  const base = loadJson<OneBotConfig>("configs/onebot.default.json");
  if (!existsSync(ONEBOT_LOCAL)) return base;
  try {
    const local = JSON.parse(readFileSync(ONEBOT_LOCAL, "utf8")) as Partial<OneBotConfig>;
    return { ...base, ...local };
  } catch {
    return base;
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

function resolveEnvId(): NexusEnvId {
  const raw = (
    process.env.NEXUS_ENV ||
    loadRuntimeEnvHint() ||
    (isTermuxHost() ? "termux" : "desktop")
  ).toLowerCase();
  if (raw === "mobile" || raw === "desktop" || raw === "server" || raw === "termux") return raw;
  return "desktop";
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

async function bootstrap(): Promise<void> {
  const startedAt = Date.now();
  printBootBanner();
  loadDotEnv();

  await bootStep("初始化：加载环境变量与运行姿态…");
  const envId = resolveEnvId();
  const profile = loadEnvProfile(envId);
  let adminCfg = loadAdmin();
  adminCfg.sessionHours = adminCfg.sessionHours || 12;
  const registry = loadRegistry();
  await bootStep(`运行姿态 → ${profile.id}（${profile.label}）`);

  function currentPassword(): string {
    return process.env[adminCfg.passwordEnv] || adminCfg.defaultPassword;
  }

  await bootStep("连接数据库…");
  let dbCfg = loadDbConfig(ROOT);
  const dbOpen = resolveDbOpenOpts(ROOT, dbCfg);
  let db = new NexusDatabase({ driver: dbOpen.driver, filePath: dbOpen.filePath });
  await db.open();
  log.ok(`数据库已连接  驱动=${dbOpen.driver}  ${dbOpen.label}`);
  await bootStep(`数据库统计 ${JSON.stringify(db.stats())}`);

  await bootStep("初始化：会话管理器…");
  const sessions = new SessionManager();
  const router = new MessageRouter();

  await bootStep("初始化：消息通道适配器…");
  const channels = new ChannelRegistry();
  channels.register(new WebChannel());
  await bootStep("  · 注册通道 web");
  channels.register(new WebhookChannel());
  await bootStep("  · 注册通道 webhook");
  const onebotCfg = loadOneBotConfig();
  const onebot = new OneBot11Bridge(onebotCfg);
  channels.register(onebot.channel);
  await bootStep(
    onebotCfg.enabled
      ? `  · 注册通道 onebot11（反向 WS ${onebotCfg.reverseWsPath}）`
      : "  · 注册通道 onebot11（未启用）",
  );

  await bootStep("初始化：AI 供应商（LLM）…");
  let llmStore = loadProvidersFile(ROOT);
  const llm = new LlmRouter();
  applyProviderToLlm(llm, activeProvider(llmStore));
  const ap = activeProvider(llmStore);
  await bootStep(
    ap?.apiKey || process.env.NEXUS_LLM_API_KEY
      ? `  · 当前供应商 ${ap?.name ?? ap?.id}  model=${ap?.model || "default"}`
      : "  · 未配置密钥：无 AI 时不自动回复（插件仍可响应）",
  );

  const plugins = new PluginHost();
  await bootStep("初始化：扫描插件目录 plugins/ …");
  const prevPlugins = db.listPlugins();
  const scan = await loadPluginsFromDir(PLUGINS_DIR, (tip) => {
    if (tip.level === "ok") log.ok(`[插件] ${tip.id}  ${tip.message}`);
    else if (tip.level === "warn") log.warn(`[插件] ${tip.id}  ${tip.message}`);
    else if (tip.level === "error") log.error(`[插件] ${tip.id}  ${tip.message}`);
    else log.info(`[插件] ${tip.id}  ${tip.message}`);
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
    await bootStep(
      `  · 挂载插件 ${p.manifest.id}@${p.manifest.version}${enabled ? "" : "（已停用）"}`,
      18,
    );
  }
  await plugins.emitReady((id) => makePluginCtx(id, (m) => log.plugin(id, m)));

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
  };
  // 热更新只重载插件，不重启网关进程
  const hotOff = process.env.NEXUS_PLUGIN_HOT === "0";
  watchPluginsHotReload(pluginHotDeps, { enabled: !hotOff });

  let channelCfg: ChannelsConfigFile = loadChannelsConfig(ROOT);
  let botCfg: BotConfig = loadBotConfig(ROOT);
  await bootStep("初始化：消息通道配置（主人等，与插件装载独立）…");

  /** Soft power-off: ignore normal chat until #开机. #重启 calls system restart executable. */
  let powerOff = false;

  await bootStep(`插件就绪：${plugins.list().length} 个`);

  await bootStep("初始化：工作流引擎…");
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
  await bootStep(`  · 工作流 ${workflows.list().length} 个`);

  await bootStep("初始化：MCP Host…");
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
  await bootStep("  · 注册工具 nexus.status");

  await bootStep("初始化：环境安装队列…");
  initEnvTasks(ROOT, {
    onLog: (line) => log.info(line),
  });
  // 启动时自动把未装环境排进队列，进度打在本终端
  try {
    const aq = autoQueueMissing();
    if (aq.queued.length) {
      await bootStep(`  · 已自动排队 ${aq.queued.length} 个未安装环境`);
    } else {
      await bootStep("  · 运行时环境已就绪");
    }
  } catch (e) {
    log.warn(`环境自动排队跳过：${e instanceof Error ? e.message : String(e)}`);
  }

  await bootStep("初始化：HTTP 网关路由…");

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
    };
  }

  function collectStatusLines(): string[] {
    return buildStatusLines(collectStatusInput());
  }

  setPluginRuntime({
    statusLines: collectStatusLines,
    statusHtml: () => buildStatusPanelHtml(collectStatusInput()),
  });

  /** Process inbound message: # admin → plugins (first match) → LLM. Never local-echo. */
  async function processInbound(
    msg: NexusMessage,
    opts?: { isAdminConsole?: boolean },
  ): Promise<string[]> {
    const chSettings = getChannelSettings(channelCfg, msg.channel);
    const isMaster = isChannelMaster(chSettings, msg.userId);
    const isAdminConsole = Boolean(opts?.isAdminConsole);
    const trimmedRaw = msg.content.trim();
    const trimmed = stripWakePrefix(trimmedRaw, botCfg);
    const isHash = trimmed.startsWith("#") || trimmed.startsWith(botCfg.commandPrefix || "#");
    const hashCmd = isHash
      ? resolveAdminHash(trimmed) ?? (trimmed.split(/\s+/)[0] ?? "")
      : "";

    if (powerOff && !isHash) {
      return [];
    }

    // QQ 群白名单（replyGroupIds）：只限制「非 # 的普通聊天 / AI」，不挡框架与插件指令
    if (
      !isHash &&
      msg.meta?.messageType === "group" &&
      !isGroupReplyAllowed(chSettings, msg.meta?.groupId as string | undefined)
    ) {
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

        // #帮助：和生图一样渲成图片再发
        if ((hashCmd === "#帮助" || hashCmd === "#help") && replies.length) {
          try {
            const shot = await renderMenuShot({
              title: "管理指令",
              lines: replies[0].split(/\n/).filter(Boolean),
            });
            if (shot.ok) {
              const fileUrl = pathToFileURL(shot.pngPath).href;
              replies = [`[CQ:image,file=${fileUrl}]`];
            }
          } catch (e) {
            log.warn(`帮助图渲染失败：${e instanceof Error ? e.message : String(e)}`);
          }
        }

        if (cmd.systemRestart) {
          const uptime = formatUptime(Date.now() - startedAt);
          replies = [buildRestartingMessage(uptime)];
          const gid = originGroupId(msg);
          const mt = originMessageType(msg);
          saveRestartNotify(ROOT, {
            channel: msg.channel,
            chatId: gid ? `group:${gid}` : msg.chatId,
            userId: msg.userId,
            messageType: mt,
            groupId: gid,
            requestedAt: nowIso(),
            previousUptime: uptime,
          });
          log.info(
            `已记录重启回执目标  ${mt}${gid ? ` 群=${gid}` : ` 会话=${msg.chatId}`}`,
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
            // 有实际更新才记重启回执
            if (upd.shouldExit) {
              const uptime = formatUptime(Date.now() - startedAt);
              saveRestartNotify(ROOT, {
                channel: msg.channel,
                chatId: gid ? `group:${gid}` : msg.chatId,
                userId: msg.userId,
                messageType: mt,
                groupId: gid,
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
                  db.insertMessage({
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
          db.insertMessage({
            id: newId("msg"),
            channel: msg.channel,
            chatId: msg.chatId,
            userId: "nexus",
            role: "assistant",
            content,
            createdAt: nowIso(),
          });
        }
        db.insertMessage({
          id: msg.id,
          channel: msg.channel,
          chatId: msg.chatId,
          userId: msg.userId,
          role: "user",
          content: msg.content,
          createdAt: msg.createdAt,
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

    if (!isHash && chSettings.onlyMasters && chSettings.masters.length && !isMaster) {
      return [];
    }

    // 框架 / 插件 # 指令：任何群都可响应（不吃 AI 回复群白名单）
    // 软关机：仍允许只读诊断 #状态；其它插件 # 指令挡住
    if (powerOff && isHash && !isAdminHash(hashCmd)) {
      const allowDiag = /^#状态$/i.test(String(hashCmd || "").trim());
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
      plugins.onMessage(pluginMsg, (id) => makePluginCtx(id, (m) => log.plugin(id, m))),
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
      db.insertMessage({
        id: msg.id,
        channel: msg.channel,
        chatId: msg.chatId,
        userId: msg.userId,
        role: "user",
        content: trimmed,
        createdAt: msg.createdAt,
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
        db.insertMessage({
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

    const history: Array<{ role: "user" | "assistant" | "system"; content: string }> = [];
    const persona = String(chSettings.systemPrompt || "").trim();
    if (persona) {
      history.push({ role: "system", content: persona });
    }
    // 给模型：去掉 @ 和呼唤前缀
    const userAsk = stripAtMentions(
      stripWakeForChat(trimmedRaw, botCfg),
      msg.meta?.selfId as string | undefined,
    );
    if (!userAsk) return [];

    sessions.append(session, "user", userAsk);
    db.insertMessage({
      id: msg.id,
      channel: msg.channel,
      chatId: msg.chatId,
      userId: msg.userId,
      role: "user",
      content: userAsk,
      createdAt: msg.createdAt,
    });

    history.push(
      ...session.turns.slice(-12).map((t) => ({
        role: t.role as "user" | "assistant" | "system",
        content: t.content,
      })),
    );
    const assistant = (
      await Promise.race([
        llm.chat(history),
        new Promise<string>((_, reject) => {
          setTimeout(() => reject(new Error("AI 响应超时")), 50_000);
        }),
      ]).catch((e) => {
        const tip = e instanceof Error ? e.message : String(e);
        log.warn(`LLM 调用失败：${tip}`);
        return tip.includes("超时") ? "AI 响应超时" : `AI 异常：${tip}`;
      })
    ).trim();
    if (!assistant) return [];

    const parts = splitAiSegments(assistant);
    const storeAs = parts.join("\n\n");
    sessions.append(session, "assistant", storeAs);
    db.insertMessage({
      id: newId("msg"),
      channel: msg.channel,
      chatId: msg.chatId,
      userId: "nexus",
      role: "assistant",
      content: storeAs,
      createdAt: nowIso(),
    });
    return parts.length ? parts : [assistant];
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

  onebot.setInboundHandler(async (msg) => processInbound(msg));

  const app = express();
  if (profile.gateway.cors) app.use(cors());
  app.use(express.json({ limit: "2mb" }));

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
    });
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

  app.get("/v1/plugins", (_req, res) => {
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
    const body = (req.body ?? {}) as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const field of p.configSchema) {
      if (Object.prototype.hasOwnProperty.call(body, field.key)) {
        next[field.key] = body[field.key];
      } else if (field.default !== undefined) {
        next[field.key] = field.default;
      }
    }
    await p.setConfig(next);
    const values = (await p.getConfig?.()) ?? next;
    res.json({ ok: true, message: "插件配置已保存", id, values });
  });

  app.get("/v1/channels", (_req, res) => {
    res.json({
      items: channels.list().map((c) => {
        const s = getChannelSettings(channelCfg, c.id);
        return {
          id: c.id,
          label: s.label || c.label || c.id,
          masters: s.masters,
          onlyMasters: s.onlyMasters,
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
    let masters = prev.masters;
    if (typeof body.masters === "string") {
      masters = String(body.masters)
        .split(/[,，\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (Array.isArray(body.masters)) {
      masters = body.masters.map((m) => String(m).trim()).filter(Boolean);
    }
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
    const next: ChannelSettings = {
      ...prev,
      ...body,
      masters,
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
    log.ok(
      `通道配置已保存  ${id}  masters=${next.masters.join(",") || "—"}  AI回复群=${next.replyGroupIds.join(",") || "全部"}`,
    );
    res.json({
      ok: true,
      message: "通道配置已保存（与插件装载独立）",
      id,
      settings: next,
    });
  });

  app.get("/v1/workflows", (_req, res) => {
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

  app.get("/v1/mcp/tools", (_req, res) => {
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

  app.post("/v1/chat", async (req, res) => {
    try {
      const result = await handleChat(req.body, {
        isAdminConsole: tokenIsAdmin(req),
      });
      res.json({ ok: true, ...result });
    } catch (e) {
      const t = formatErrorForClient(e);
      log.error(`${t.errorType}  ${t.raw ?? ""}`);
      res.status(500).json(t);
    }
  });

  app.post("/v1/chat/stream", async (req, res) => {
    res.setHeader("content-type", "text/event-stream");
    res.setHeader("cache-control", "no-cache");
    res.setHeader("connection", "keep-alive");
    try {
      const result = await handleChat(req.body, {
        isAdminConsole: tokenIsAdmin(req),
      });
      const chunk = result.assistant;
      const size = Math.max(8, Math.ceil(chunk.length / 12));
      for (let i = 0; i < chunk.length; i += size) {
        const part = chunk.slice(i, i + size);
        res.write(`data: ${JSON.stringify({ delta: part })}\n\n`);
        await new Promise((r) => setTimeout(r, 16));
      }
      res.write(`data: ${JSON.stringify({ done: true, replies: result.replies })}\n\n`);
      res.end();
    } catch (e) {
      res.write(`data: ${JSON.stringify({ error: e instanceof Error ? e.message : String(e) })}\n\n`);
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

  app.get("/v1/channels/onebot11", authMiddleware, (_req, res) => {
    res.json({ ok: true, ...onebot.status(), config: onebot.getConfig() });
  });

  app.post("/v1/channels/onebot11/config", authMiddleware, (req, res) => {
    const body = (req.body ?? {}) as Partial<OneBotConfig>;
    const next: OneBotConfig = {
      ...onebot.getConfig(),
      enabled: typeof body.enabled === "boolean" ? body.enabled : onebot.getConfig().enabled,
      accessToken:
        typeof body.accessToken === "string" ? body.accessToken : onebot.getConfig().accessToken,
      reverseWsPath:
        typeof body.reverseWsPath === "string" && body.reverseWsPath
          ? body.reverseWsPath
          : onebot.getConfig().reverseWsPath,
      httpPath:
        typeof body.httpPath === "string" && body.httpPath
          ? body.httpPath
          : onebot.getConfig().httpPath,
      docsUrl: onebot.getConfig().docsUrl,
    };
    persistOneBotConfig(next);
    onebot.updateConfig(next);
    log.info(`OneBot 11 配置已保存  enabled=${next.enabled}`);
    res.json({
      ok: true,
      message: "已保存。反向 WS 路径变更需重启网关后生效。",
      ...onebot.status(),
      config: next,
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
      /** 专仓地址只读，发行配置锁定，控制台不可改 */
      pluginsRepoLocked: true,
      categories: Object.entries(registry.categories).map(([id, c]) => ({
        id,
        label: c.label,
        path: c.path,
      })),
    });
  });

  /** 专仓地址不可经 API 修改 */
  app.patch("/v1/registry", authMiddleware, (req, res) => {
    if (req.body?.pluginsRepo !== undefined) {
      res.status(403).json({
        error: "系统插件专仓地址已锁定，不可在控制台修改",
        pluginsRepo: registry.pluginsRepo || null,
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
      const updates = result.items.filter(
        (i) => i.status === "update" || i.status === "remote-only",
      ).length;
      res.json({
        ...result,
        summary: {
          total: result.items.length,
          update: updates,
          same: result.items.filter((i) => i.status === "same").length,
          localOnly: result.items.filter((i) => i.status === "local-only").length,
          remoteOnly: result.items.filter((i) => i.status === "remote-only").length,
        },
        message:
          updates > 0
            ? `有 ${updates} 个插件可更新或可拉取`
            : "本地与远端插件目录一致（或暂未配置插件专仓）",
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

  app.post("/v1/registry/publish", authMiddleware, (req, res) => {
    const pluginId = String(req.body?.pluginId ?? "");
    const category = String(req.body?.category ?? "demo");
    if (!pluginId) {
      res.status(400).json({ error: "请指定 pluginId" });
      return;
    }
    if (!registry.categories[category]) {
      res.status(400).json({ error: `未知分类：${category}` });
      return;
    }
    const tokenOk = Boolean(process.env[registry.tokenEnv]);
    db.setKv(
      `registry:lastPublish`,
      JSON.stringify({ pluginId, category, at: nowIso(), tokenOk }),
    );
    res.json({
      ok: true,
      queued: true,
      tokenConfigured: tokenOk,
      message: tokenOk
        ? `已登记上传意图：${pluginId} → ${category}（远端推送由维护者流水线处理，细节不对公开展示）`
        : `已本地登记 ${pluginId} → ${category}。请先配置 ${registry.tokenEnv}（pnpm nexus set registry-token）后再推送。`,
    });
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
    const allowed: EnvTaskStatus[] = ["pending", "running", "paused", "done", "failed"];
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

  app.get("/v1/admin/update/check", authMiddleware, (_req, res) => {
    const fw = checkRemoteUpdate(ROOT);
    const repoUrl = String(registry.pluginsRepo?.url || "").trim();
    let plugins: {
      available: number;
      items: Array<{ name: string; dir: string; status: string; detail?: string }>;
    } = { available: 0, items: [] };
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
          items: need.map((i) => ({
            name: i.name || i.id || i.dir,
            dir: i.dir,
            status: i.status,
            detail:
              i.localVersion && i.remoteVersion && i.localVersion !== i.remoteVersion
                ? `${i.localVersion}→${i.remoteVersion}`
                : i.remoteVersion || i.message,
          })),
        };
      } catch (e) {
        plugins = {
          available: 0,
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
      bits.push(cur === rem ? `框架 ${cur}（有新代码）` : `框架 ${cur}→${rem}`);
    }
    if (plugins.available) bits.push(`系统插件 ${plugins.available} 个`);
    res.status(fw.ok ? 200 : 502).json({
      ...fw,
      updateAvailable,
      message: updateAvailable
        ? `发现更新：${bits.join(" + ")}`
        : fw.ok
          ? `已是最新 ${fw.currentVersion || ""}`
          : fw.message,
      plugins,
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

  const staticRoot = existsSync(join(WEB_DIST, "index.html"))
    ? WEB_DIST
    : existsSync(join(PUBLIC_FALLBACK, "index.html"))
      ? PUBLIC_FALLBACK
      : null;

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
  const host = process.env.HOST ?? profile.gateway.host;

  await bootStep("初始化：监听端口…");
  const server = app.listen(port, host, () => {
    onebot.attach(server);
    void printBootSuccess({
      url: `http://127.0.0.1:${port}/`,
      env: profile.id,
      plugins: plugins.list().length,
      channels: channels.list().length,
    });
    log.info(
      `管理账号=${adminCfg.username}  首次设置完成=${adminCfg.setupCompleted ? "是" : "否"}  会话=${adminCfg.sessionHours}小时`,
    );
    if (onebotCfg.enabled) {
      log.info(
        `OneBot 11 对接：NapCat 反向 WS → ws://127.0.0.1:${port}${onebotCfg.reverseWsPath}  |  HTTP → ${onebotCfg.httpPath}`,
      );
      log.info(`文档 https://napneko.github.io`);
    }
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

    const loaded = plugins
      .listConsole()
      .filter((p) => p.enabled !== false)
      .map((p) => ({ id: p.id, name: p.name, version: p.version }));
    const lines = buildRestartOkLines(loaded, {
      previousUptime: pending.previousUptime,
      version: readLocalVersion(ROOT),
      commit: shortCommit() || undefined,
      updateSummary: pending.updateSummary,
    });
    const text = lines.join("\n");

    let sendPayload = text;
    try {
      const html = buildRestartOkPanelHtml(loaded, {
        previousUptime: pending.previousUptime,
        version: readLocalVersion(ROOT),
        commit: shortCommit() || undefined,
        updateSummary: pending.updateSummary,
      });
      const shot = await renderHtmlShot({
        html,
        selector: "#panel",
        width: 820,
        height: 1400,
      });
      if (shot.ok) {
        sendPayload = `[CQ:image,file=${pathToFileURL(shot.pngPath).href}]`;
      }
    } catch (e) {
      log.warn(`重启报告出图失败：${e instanceof Error ? e.message : String(e)}`);
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
        },
        createdAt: nowIso(),
      };
      for (let i = 0; i < 45; i++) {
        if (onebot.status().connected) {
          let ok = await onebot.sendText(sendPayload, ctx);
          if (!ok && gid) {
            ok = await onebot.sendTextToGroup(gid, sendPayload);
          }
          if (ok) {
            log.ok(
              `重启成功已发回原${mt === "group" ? `群 ${gid}` : "会话"}`,
            );
            clearRestartNotify(ROOT);
            return;
          }
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      log.warn("重启成功通知未发出：OneBot 未连接，保留待发记录");
      return;
    }

    clearRestartNotify(ROOT);
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
