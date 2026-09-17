import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import {
  ChannelRegistry,
  WebChannel,
  WebhookChannel,
} from "@fengyun/nexus-channel";
import { MessageRouter, SessionManager, createEchoHandler } from "@fengyun/nexus-core";
import { LlmRouter } from "@fengyun/nexus-llm";
import { McpHost } from "@fengyun/nexus-mcp-host";
import { PluginHost, definePlugin } from "@fengyun/nexus-plugin-sdk";
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../..");
const ADMIN_LOCAL = join(ROOT, "configs/admin.local.json");
const RUNTIME_LOCAL = join(ROOT, "configs/runtime.local.json");
const PUBLIC_DIR = join(__dirname, "../public");

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
  const raw = (process.env.NEXUS_ENV || loadRuntimeEnvHint() || (isTermuxHost() ? "termux" : "desktop")).toLowerCase();
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
  const local = join(ROOT, "configs/registry.local.json");
  if (existsSync(local)) return JSON.parse(readFileSync(local, "utf8")) as RegistryConfig;
  return loadJson<RegistryConfig>("configs/registry.json");
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

/**
 * Strong password: ≥10 chars, upper, lower, digit, special.
 */
function validatePassword(password: string): string | null {
  if (password.length < 10) return "密码至少 10 位";
  if (!/[a-z]/.test(password)) return "密码须含小写字母";
  if (!/[A-Z]/.test(password)) return "密码须含大写字母";
  if (!/[0-9]/.test(password)) return "密码须含数字";
  if (!/[^A-Za-z0-9]/.test(password)) return "密码须含特殊字符";
  if (password === "console") return "请勿使用初始密码";
  return null;
}

loadDotEnv();

const envId = resolveEnvId();
const profile = loadEnvProfile(envId);
let adminCfg = loadAdmin();
adminCfg.sessionHours = adminCfg.sessionHours || 12;
const registry = loadRegistry();

function currentPassword(): string {
  return process.env[adminCfg.passwordEnv] || adminCfg.defaultPassword;
}

const sessions = new SessionManager();
const router = new MessageRouter();
const channels = new ChannelRegistry();
channels.register(new WebChannel());
channels.register(new WebhookChannel());

const llm = new LlmRouter({
  apiKey: process.env.NEXUS_LLM_API_KEY,
  baseUrl: process.env.NEXUS_LLM_BASE_URL,
  model: process.env.NEXUS_LLM_MODEL,
});

const plugins = new PluginHost();
plugins.register(
  definePlugin({
    manifest: {
      id: "built-in.echo",
      name: "Echo",
      version: "0.1.0",
      category: "demo",
      hooks: ["onMessage", "onReady"],
      permissions: ["channel.send"],
    },
    onReady(ctx) {
      ctx.log("echo ready");
    },
    onMessage(msg) {
      if (!msg.content.startsWith("/echo ")) return null;
      return {
        id: newId("msg"),
        channel: msg.channel,
        chatId: msg.chatId,
        userId: "plugin:echo",
        type: "text",
        content: msg.content.slice(6),
        meta: { replyTo: msg.id },
        createdAt: nowIso(),
      };
    },
  }),
);

const workflows = new WorkflowRunner();
workflows.register({
  id: "starter",
  name: "Starter Flow",
  entry: "t1",
  nodes: [
    { id: "t1", type: "trigger", next: ["l1"] },
    { id: "l1", type: "llm", next: ["d1"] },
    { id: "d1", type: "delay", config: { ms: 10 }, next: [] },
  ],
});

const mcp = new McpHost();
mcp.register({
  name: "nexus.status",
  description: "Return Nexus runtime status",
  handler: () => ({
    env: envId,
    plugins: plugins.list().length,
    channels: channels.list().map((c) => c.id),
  }),
});

router.use(createEchoHandler());

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
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const rec = tokens.get(hashToken(token));
  if (!rec || rec.exp < Date.now()) {
    if (rec) tokens.delete(hashToken(token));
    res.status(401).json({ error: "session expired" });
    return;
  }
  (req as express.Request & { adminUser?: string }).adminUser = rec.user;
  next();
}

async function handleChat(raw: unknown): Promise<{ replies: unknown[]; assistant: string }> {
  const web = channels.get("web")!;
  const msg = web.normalizeInbound(raw);
  const session = sessions.getOrCreate({
    channel: msg.channel,
    chatId: msg.chatId,
    userId: msg.userId,
  });
  sessions.append(session, "user", msg.content);

  const pluginReplies = await plugins.onMessage(msg, (id) => ({
    pluginId: id,
    reply: async () => undefined,
    log: (m) => console.log(`[plugin:${id}]`, m),
  }));

  let assistant: string;
  if (pluginReplies.length) {
    assistant = pluginReplies.map((r) => r.content).join("\n");
  } else {
    const history = session.turns.slice(-12).map((t) => ({
      role: t.role as "user" | "assistant" | "system",
      content: t.content,
    }));
    assistant = await llm.chat(history);
  }

  sessions.append(session, "assistant", assistant);
  const outMsg: NexusMessage = {
    id: newId("msg"),
    channel: msg.channel,
    chatId: msg.chatId,
    userId: "nexus",
    type: "text",
    content: assistant,
    meta: { replyTo: msg.id },
    createdAt: nowIso(),
  };
  return {
    replies: [web.formatOutbound(outMsg), ...pluginReplies.map((r) => web.formatOutbound(r))],
    assistant,
  };
}

const app = express();
if (profile.gateway.cors) app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    product: "Fengyun Nexus",
    env: profile.id,
    label: profile.label,
    time: nowIso(),
  });
});

app.get("/v1/meta", (_req, res) => {
  res.json({
    product: "Fengyun Nexus",
    version: "0.1.0",
    env: profile,
    features: profile.features,
    admin: {
      setupCompleted: adminCfg.setupCompleted,
      sessionHours: adminCfg.sessionHours || 12,
      refreshInvalidatesSession: true,
    },
    plugins: {
      available: true,
      loaded: plugins.list().length,
    },
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
    res.status(401).json({ error: "invalid credentials" });
    return;
  }
  const token = issueToken(expectUser);
  const mustReconfigure = !adminCfg.setupCompleted;
  res.json({
    token,
    username: expectUser,
    expiresInHours: adminCfg.sessionHours || 12,
    mustReconfigure,
    message: mustReconfigure
      ? "首次登录：请立即在控制台重新配置用户名与密码，然后重新登录。"
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
    res.status(403).json({ error: "setup_required", message: "请先完成用户名与密码配置。" });
    return;
  }
  res.json({
    env: profile,
    plugins: plugins.list(),
    channels: channels.list().map((c) => c.id),
    workflows: workflows.list().map((w) => ({ id: w.id, name: w.name })),
    sessions: sessions.list().length,
    mcpTools: mcp.list(),
    adminUser: (req as express.Request & { adminUser?: string }).adminUser,
  });
});

/** First-time or forced console reconfiguration of username + password. */
app.post("/v1/admin/setup-credentials", authMiddleware, (req, res) => {
  const { username, password, confirmPassword } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "invalid payload" });
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

/** Update username and/or password after setup; invalidates all sessions. */
app.post("/v1/admin/credentials", authMiddleware, (req, res) => {
  if (!adminCfg.setupCompleted) {
    res.status(403).json({ error: "setup_required" });
    return;
  }
  const { currentPassword: cur, username, password, confirmPassword } = req.body ?? {};
  if (typeof cur !== "string" || !safeEqual(cur, currentPassword())) {
    res.status(401).json({ error: "current password mismatch" });
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
  res.json({ items: plugins.list() });
});

app.get("/v1/channels", (_req, res) => {
  res.json({ items: channels.list().map((c) => c.id) });
});

app.get("/v1/workflows", (_req, res) => {
  res.json({ items: workflows.list() });
});

app.post("/v1/workflows/:id/run", authMiddleware, async (req, res) => {
  const result = await workflows.run(req.params.id, req.body ?? {});
  res.json(result);
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
    const result = await handleChat(req.body);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.post("/v1/chat/stream", async (req, res) => {
  res.setHeader("content-type", "text/event-stream");
  res.setHeader("cache-control", "no-cache");
  res.setHeader("connection", "keep-alive");
  try {
    const result = await handleChat(req.body);
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

app.post("/v1/channels/webhook", async (req, res) => {
  const adapter = channels.get("webhook")!;
  const msg = adapter.normalizeInbound(req.body);
  const pluginReplies = await plugins.onMessage(msg, (id) => ({
    pluginId: id,
    reply: async () => undefined,
    log: (m) => console.log(`[plugin:${id}]`, m),
  }));
  const assistant = pluginReplies[0]?.content
    ?? (await llm.chat([{ role: "user", content: msg.content }]));
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

app.get("/v1/registry", authMiddleware, (_req, res) => {
  res.json({
    ok: true,
    categories: Object.keys(registry.categories),
    tokenConfigured: Boolean(process.env[registry.tokenEnv]),
  });
});

if (existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  app.get(["/", "/console"], (_req, res) => {
    res.sendFile(join(PUBLIC_DIR, "index.html"));
  });
}

const port = Number(process.env.PORT ?? profile.gateway.port);
const host = process.env.HOST ?? profile.gateway.host;

app.listen(port, host, () => {
  console.log(`[Nexus] env=${profile.id} http://${host}:${port}`);
  console.log(
    `[Nexus] admin user=${adminCfg.username} setupCompleted=${adminCfg.setupCompleted} sessionHours=${adminCfg.sessionHours}`,
  );
  console.log(`[Nexus] Console http://127.0.0.1:${port}/`);
});
