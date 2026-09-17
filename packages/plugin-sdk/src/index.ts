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
  /**
   * Plugin family for console multi-layer management:
   * - channel: message-channel plugins (often bound to onebot/web/…)
   * - framework: core / shared framework plugins
   */
  kind?: "channel" | "framework";
  /**
   * Adapter scope — where the plugin applies:
   * - all: every channel (framework list only)
   * - channel: single / “本通道” binding via `channels`
   * - specified: only the listed `channels`
   */
  adapterScope?: "all" | "channel" | "specified";
  /** Channel ids when adapterScope is channel | specified. */
  channels?: string[];
  /** Priority: smaller number runs first; first accept match wins. */
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
  private _replies: Array<{
    type: "text" | "image";
    content: string;
    file?: string;
  }> = [];

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
    this._replies.push({ type: "text", content });
  }

  /** Reply with a local image file path or URL — for menu screenshots etc. */
  async replyImage(file: string, caption = ""): Promise<void> {
    if (caption) this._replies.push({ type: "text", content: caption });
    this._replies.push({ type: "image", content: caption || "image", file });
  }

  takeReplies(): Array<{ type: "text" | "image"; content: string; file?: string }> {
    const out = [...this._replies];
    this._replies = [];
    return out;
  }

  toOutbound(userId = "nexus"): NexusMessage[] {
    return this.takeReplies().map((r) => {
      if (r.type === "image" && r.file) {
        return {
          id: newId("msg"),
          channel: this.channel,
          chatId: this.chatId,
          userId,
          type: "image" as const,
          content: r.content || "image",
          attachments: [{ kind: "image", url: r.file }],
          meta: { replyTo: this.id, ...this.raw.meta },
          createdAt: nowIso(),
        };
      }
      return {
        id: newId("msg"),
        channel: this.channel,
        chatId: this.chatId,
        userId,
        type: "text" as const,
        content: r.content,
        meta: { replyTo: this.id, ...this.raw.meta },
        createdAt: nowIso(),
      };
    });
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
  private disabled = new Set<string>();

  register(plugin: NexusPlugin): void {
    this.plugins.set(plugin.manifest.id, plugin);
  }

  /** Drop all loaded plugins; enabled flags for known ids can be restored by caller. */
  clear(): void {
    this.plugins.clear();
  }

  /** Snapshot of disabled ids before a hot reload. */
  disabledIds(): string[] {
    return [...this.disabled];
  }

  get(id: string): NexusPlugin | undefined {
    return this.plugins.get(id);
  }

  setEnabled(id: string, enabled: boolean): boolean {
    if (!this.plugins.has(id)) return false;
    if (enabled) this.disabled.delete(id);
    else this.disabled.add(id);
    return true;
  }

  isEnabled(id: string): boolean {
    return this.plugins.has(id) && !this.disabled.has(id);
  }

  list(): PluginManifest[] {
    return [...this.plugins.values()]
      .sort((a, b) => (a.manifest.priority ?? 5000) - (b.manifest.priority ?? 5000))
      .map((p) => p.manifest);
  }

  listConsole(): Array<
    PluginManifest & {
      enabled: boolean;
      configSupported: boolean;
      kind: "channel" | "framework";
      adapterScope: "all" | "channel" | "specified";
    }
  > {
    return this.values().map((p) => {
      const channels = p.manifest.channels ?? [];
      const kind: "channel" | "framework" =
        p.manifest.kind ??
        (p.manifest.contributes?.adapters?.length || channels.length ? "channel" : "framework");
      const adapterScope: "all" | "channel" | "specified" =
        p.manifest.adapterScope ??
        (kind === "framework" || !channels.length
          ? "all"
          : channels.length === 1
            ? "channel"
            : "specified");
      return {
        ...p.manifest,
        kind: adapterScope === "all" ? "framework" : "channel",
        adapterScope,
        channels,
        enabled: this.isEnabled(p.manifest.id),
        configSupported: Boolean(p.configSchema?.length),
      };
    });
  }

  values(): NexusPlugin[] {
    return [...this.plugins.values()].sort(
      (a, b) => (a.manifest.priority ?? 5000) - (b.manifest.priority ?? 5000),
    );
  }

  async emitReady(makeCtx: (id: string) => PluginContext): Promise<void> {
    for (const p of this.values()) {
      if (!this.isEnabled(p.manifest.id)) continue;
      await p.onReady?.(makeCtx(p.manifest.id));
    }
  }

  async dispatchEvent(e: NexusEvent, makeCtx: (id: string) => PluginContext): Promise<NexusMessage[]> {
    const out: NexusMessage[] = [];
    for (const p of this.values()) {
      if (!this.isEnabled(p.manifest.id)) continue;
      // Scope filter: all / channel / specified
      const scope =
        p.manifest.adapterScope ??
        (p.manifest.kind === "framework" || !(p.manifest.channels?.length) ? "all" : "specified");
      const chs = p.manifest.channels ?? [];
      if (scope !== "all" && chs.length && !chs.includes(e.channel)) continue;

      const ctx = makeCtx(p.manifest.id);
      if (typeof p.accept === "function") {
        const hit = await p.accept(e, ctx);
        if (hit) {
          out.push(...e.toOutbound(`plugin:${p.manifest.id}`));
          // First match wins — smaller priority already sorted first
          return out;
        }
      }
      if (p.onMessage) {
        const r = await p.onMessage(e.raw, ctx);
        if (r) {
          out.push(r);
          return out;
        }
      }
    }
    return out;
  }

  async onMessage(msg: NexusMessage, makeCtx: (id: string) => PluginContext): Promise<NexusMessage[]> {
    const e = new NexusEvent(msg);
    return this.dispatchEvent(e, makeCtx);
  }
}
