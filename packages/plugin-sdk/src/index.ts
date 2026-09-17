import { newId, nowIso, type NexusMessage } from "@fengyun/nexus-shared";

export type PluginPermission =
  | "channel.send"
  | "llm.chat"
  | "fs.data"
  | "mcp.expose"
  | "workflow.register"
  | "db.read"
  | "db.write";

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  engines?: { nexus?: string };
  main?: string;
  permissions?: PluginPermission[];
  hooks?: Array<"onMessage" | "onReady" | "onCron" | "onWorkflowNode">;
  contributes?: {
    mcpTools?: string[];
    workflowNodes?: string[];
    adapters?: string[];
  };
  category?: "demo" | "basic" | "standard" | "local";
  /** Priority: smaller runs earlier (XRK-like). */
  priority?: number;
}

export interface PluginRule {
  /** Match message content (string or RegExp source). */
  reg: string | RegExp;
  /** Method name on plugin instance, or inline handler key. */
  fnc: string;
  permission?: "master" | "admin" | "all";
  describe?: string;
}

/** Yunzai-like event object `e` — reply / identity / raw. */
export class NexusEvent {
  readonly id: string;
  readonly channel: string;
  readonly chatId: string;
  readonly userId: string;
  readonly msg: string;
  readonly raw: NexusMessage;
  private _replies: string[] = [];

  constructor(message: NexusMessage) {
    this.id = message.id;
    this.channel = message.channel;
    this.chatId = message.chatId;
    this.userId = message.userId;
    this.msg = message.content;
    this.raw = message;
  }

  get message(): string {
    return this.msg;
  }

  async reply(content: string): Promise<void> {
    this._replies.push(content);
  }

  takeReplies(): string[] {
    const out = [...this._replies];
    this._replies = [];
    return out;
  }

  toOutbound(userId = "nexus"): NexusMessage[] {
    return this.takeReplies().map((content) => ({
      id: newId("msg"),
      channel: this.channel,
      chatId: this.chatId,
      userId,
      type: "text" as const,
      content,
      meta: { replyTo: this.id },
      createdAt: nowIso(),
    }));
  }
}

export interface PluginContext {
  pluginId: string;
  reply: (content: string, to: NexusMessage) => Promise<void>;
  log: (msg: string) => void;
}

export interface PluginConfigField {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "select" | "password";
  description?: string;
  options?: Array<{ value: string; label: string }>;
  default?: unknown;
}

export interface NexusPlugin {
  manifest: PluginManifest;
  rule?: PluginRule[];
  /** Extensible console config form. Omit = 「暂未支持配置」. */
  configSchema?: PluginConfigField[];
  getConfig?(): Record<string, unknown> | Promise<Record<string, unknown>>;
  setConfig?(cfg: Record<string, unknown>): void | Promise<void>;
  onReady?(ctx: PluginContext): Promise<void> | void;
  onMessage?(msg: NexusMessage, ctx: PluginContext): Promise<NexusMessage | null> | NexusMessage | null;
  accept?(e: NexusEvent, ctx: PluginContext): Promise<boolean | void> | boolean | void;
}

/** Base class for directory plugins (reference style, Nexus-owned API). */
export abstract class Plugin implements NexusPlugin {
  abstract manifest: PluginManifest;
  rule: PluginRule[] = [];
  priority = 5000;
  configSchema?: PluginConfigField[];

  onReady?(ctx: PluginContext): Promise<void> | void;
  onMessage?(msg: NexusMessage, ctx: PluginContext): Promise<NexusMessage | null> | NexusMessage | null;
  getConfig?(): Record<string, unknown> | Promise<Record<string, unknown>>;
  setConfig?(cfg: Record<string, unknown>): void | Promise<void>;

  async accept(e: NexusEvent, ctx: PluginContext): Promise<boolean | void> {
    for (const r of this.rule) {
      const re = typeof r.reg === "string" ? new RegExp(r.reg) : r.reg;
      if (!re.test(e.msg)) continue;
      const fn = (this as unknown as Record<string, unknown>)[r.fnc];
      if (typeof fn === "function") {
        await (fn as (e: NexusEvent, ctx: PluginContext) => Promise<void>).call(this, e, ctx);
        return true;
      }
    }
    return false;
  }
}

export function definePlugin(plugin: NexusPlugin): NexusPlugin {
  return plugin;
}

export class PluginHost {
  private plugins = new Map<string, NexusPlugin>();

  register(plugin: NexusPlugin): void {
    this.plugins.set(plugin.manifest.id, plugin);
  }

  get(id: string): NexusPlugin | undefined {
    return this.plugins.get(id);
  }

  list(): PluginManifest[] {
    return [...this.plugins.values()]
      .sort((a, b) => (a.manifest.priority ?? 5000) - (b.manifest.priority ?? 5000))
      .map((p) => p.manifest);
  }

  values(): NexusPlugin[] {
    return [...this.plugins.values()].sort(
      (a, b) => (a.manifest.priority ?? 5000) - (b.manifest.priority ?? 5000),
    );
  }

  async emitReady(makeCtx: (id: string) => PluginContext): Promise<void> {
    for (const p of this.values()) {
      await p.onReady?.(makeCtx(p.manifest.id));
    }
  }

  async dispatchEvent(e: NexusEvent, makeCtx: (id: string) => PluginContext): Promise<NexusMessage[]> {
    const out: NexusMessage[] = [];
    for (const p of this.values()) {
      const ctx = makeCtx(p.manifest.id);
      if (typeof p.accept === "function") {
        const hit = await p.accept(e, ctx);
        if (hit) {
          out.push(...e.toOutbound(`plugin:${p.manifest.id}`));
          continue;
        }
      }
      if (p.onMessage) {
        const r = await p.onMessage(e.raw, ctx);
        if (r) out.push(r);
      }
    }
    return out;
  }

  async onMessage(msg: NexusMessage, makeCtx: (id: string) => PluginContext): Promise<NexusMessage[]> {
    const e = new NexusEvent(msg);
    return this.dispatchEvent(e, makeCtx);
  }
}
