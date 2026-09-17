import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
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

function loadJson<T>(rel: string): T {
  const p = join(ROOT, rel);
  return JSON.parse(readFileSync(p, "utf8")) as T;
}

function resolveEnvId(): NexusEnvId {
  const raw = (process.env.NEXUS_ENV ?? "desktop").toLowerCase();
  if (raw === "mobile" || raw === "desktop" || raw === "server") return raw;
  return "desktop";
}

function loadEnvProfile(id: NexusEnvId): EnvProfile {
  return loadJson<EnvProfile>(`configs/env.${id}.json`);
}

function loadAdmin(): AdminConfig {
  const local = join(ROOT, "configs/admin.local.json");
  if (existsSync(local)) return JSON.parse(readFileSync(local, "utf8")) as AdminConfig;
  return loadJson<AdminConfig>("configs/admin.default.json");
}

function loadRegistry(): RegistryConfig {
  const local = join(ROOT, "configs/registry.local.json");
  if (existsSync(local)) return JSON.parse(readFileSync(local, "utf8")) as RegistryConfig;
  return loadJson<RegistryConfig>("configs/registry.json");
}

function adminPassword(cfg: AdminConfig): string {
  return process.env[cfg.passwordEnv] || cfg.defaultPassword;
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

const envId = resolveEnvId();
const profile = loadEnvProfile(envId);
const adminCfg = loadAdmin();
const registry = loadRegistry();

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

function issueToken(user: string): string {
  const token = randomBytes(24).toString("hex");
  const exp = Date.now() + adminCfg.sessionHours * 3600_000;
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
    registry: {
      baseUrl: registry.baseUrl,
      categories: registry.categories,
      tokenConfigured: Boolean(process.env[registry.tokenEnv]),
    },
  });
});

app.post("/v1/admin/login", (req, res) => {
  const { username, password } = req.body ?? {};
  const expectUser = adminCfg.username;
  const expectPass = adminPassword(adminCfg);
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
  res.json({ token, username: expectUser, expiresInHours: adminCfg.sessionHours });
});

app.get("/v1/admin/me", authMiddleware, (req, res) => {
  res.json({
    user: (req as express.Request & { adminUser?: string }).adminUser,
    env: profile.id,
  });
});

app.get("/v1/admin/overview", authMiddleware, (_req, res) => {
  res.json({
    env: profile,
    plugins: plugins.list(),
    channels: channels.list().map((c) => c.id),
    workflows: workflows.list().map((w) => ({ id: w.id, name: w.name })),
    sessions: sessions.list().length,
    mcpTools: mcp.list(),
    registry,
  });
});

app.post("/v1/admin/password", authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (typeof currentPassword !== "string" || typeof newPassword !== "string" || newPassword.length < 8) {
    res.status(400).json({ error: "new password must be at least 8 chars" });
    return;
  }
  if (!safeEqual(currentPassword, adminPassword(adminCfg))) {
    res.status(401).json({ error: "current password mismatch" });
    return;
  }
  // Runtime-only until local admin file is written by operator.
  process.env[adminCfg.passwordEnv] = newPassword;
  res.json({ ok: true, hint: "已更新当前进程密码；持久化请写入 configs/admin.local.json 或环境变量。" });
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

app.get("/v1/registry", (_req, res) => {
  res.json({
    ...registry,
    note: "示例/基础/标准插件挂载于开源平台；填写 token 后可远程安装与更新。",
    tokenConfigured: Boolean(process.env[registry.tokenEnv]),
  });
});

const port = Number(process.env.PORT ?? profile.gateway.port);
const host = process.env.HOST ?? profile.gateway.host;

app.listen(port, host, () => {
  console.log(`[Nexus] env=${profile.id} http://${host}:${port}`);
  console.log(`[Nexus] admin user=${adminCfg.username} (password via ${adminCfg.passwordEnv} or default)`);
  console.log(`[Nexus] registry=${registry.baseUrl}`);
});
