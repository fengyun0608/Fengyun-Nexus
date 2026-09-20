import { newId, nowIso, type NexusMessage } from "@fengyun/nexus-shared";

export type PluginPermission =
  | "channel.send"
  | "llm.chat"
  | "fs.data"
  | "mcp.expose"
  | "workflow.register"
  | "db.read"
  | "db.write"
  | "onebot.api"
  | "channel.master";

export type MasterLevel = "core" | "new" | "normal";

export type Ob11CallResult = {
  ok: boolean;
  data?: unknown;
  retcode?: number;
  message?: string;
};

export interface PluginManifest {
  /**
   * Technical id — English only (ASCII). Prefer `z.xxx` / `vendor.feature`.
   * Used for enable/disable, config keys, logs. Not shown as the main console title.
   */
  id: string;
  /**
   * Display name for the console plugin manager.
   * Prefer Chinese for the default UI (e.g. 「菜单」「回声」); id stays English.
   */
  name: string;
  version: string;
  /** 插件作者显示名 */
  author?: string;
  /** 一句话说明 */
  description?: string;
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

/** 事件对象 `e` — reply / identity / raw. */
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

  /**
   * 只发图，不附带旁文。第二参数仅作内部占位文案，不会再推一条文字消息。
   */
  async replyImage(file: string, _label = "image"): Promise<void> {
    this._replies.push({ type: "image", content: "image", file });
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

/** 系统内置截图结果（由网关注入 @fengyun/browser-shot） */
export type PluginShotResult =
  | { ok: true; htmlPath: string; pngPath: string }
  | { ok: false; htmlPath: string; message: string; pngPath?: string };

/** 插件调用系统截图：菜单卡片 / 任意 HTML */
export interface PluginShot {
  renderMenu(opts: {
    title: string;
    lines?: string[];
    sections?: Array<{ title: string; lines: string[] }>;
    outDir?: string;
  }): Promise<PluginShotResult>;
  renderHtml(opts: {
    html: string;
    outDir?: string;
    selector?: string;
    width?: number;
    height?: number;
  }): Promise<PluginShotResult>;
}

export interface PluginContext {
  pluginId: string;
  reply: (content: string, to: NexusMessage) => Promise<void>;
  log: (msg: string) => void;
  /** 系统截图能力；菜单图 / 网页图走这里，勿在插件里另装浏览器 */
  shot: PluginShot;
  /** 宿主运行时只读信息（状态图等） */
  runtime: {
    /** 框架 / 网络 / OneBot / AI / 群等状态行（纯文本回退） */
    statusLines: () => string[];
    /** 状态面板 HTML，配合 shot.renderHtml({ selector: "#panel" }) */
    statusHtml: () => string | Promise<string>;
  };
  /** 当前事件用户是否为本通道主人 */
  isMaster?: (userId?: string) => boolean;
  /** 主人级别；非主人返回 null */
  masterLevel?: (userId?: string) => MasterLevel | null;
  /** 当前入站通道 id */
  channelId?: string;
  /** OneBot API（仅 onebot11 可用） */
  ob11?: {
    call: (
      action: string,
      params?: Record<string, unknown>,
      opts?: { botId?: string },
    ) => Promise<Ob11CallResult>;
    selfId: () => string;
    listBots: () => Array<{
      selfId: string;
      label: string;
      connected: boolean;
      apiBase: string;
    }>;
  };
  /** 主人查询（通道级）。增减只能在网页控制台通道设置里改。 */
  masters?: {
    list: (channelId?: string) => {
      core: string[];
      new: string[];
      normal: string[];
      all: string[];
    };
  };
}

export interface PluginConfigField {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "select" | "password" | "textarea";
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
  /**
   * 插件加载完成时调用。
   * 可用 ctx.log 打自定义加载文案，多行、图案都行；也可 return 字符串或字符串数组。
   * 框架自己的「已加载：xxx」不会被这里改掉。
   */
  onReady?(
    ctx: PluginContext,
  ): Promise<void | string | string[]> | void | string | string[];
  onMessage?(msg: NexusMessage, ctx: PluginContext): Promise<NexusMessage | null> | NexusMessage | null;
  /** OneBot notice 等非消息事件（如群禁言） */
  onNotice?(ev: Record<string, unknown>, ctx: PluginContext): Promise<string[] | void> | string[] | void;
  accept?(e: NexusEvent, ctx: PluginContext): Promise<boolean | void> | boolean | void;
}

/** Base class for directory plugins (reference style, Nexus-owned API). */
export abstract class Plugin implements NexusPlugin {
  abstract manifest: PluginManifest;
  rule: PluginRule[] = [];
  priority = 5000;
  configSchema?: PluginConfigField[];

  /**
   * 插件加载完成时调用。
   * 可用 ctx.log 打自定义加载文案，多行、图案都行；也可 return 字符串或字符串数组。
   */
  onReady?(
    ctx: PluginContext,
  ): Promise<void | string | string[]> | void | string | string[];
  onMessage?(msg: NexusMessage, ctx: PluginContext): Promise<NexusMessage | null> | NexusMessage | null;
  onNotice?(ev: Record<string, unknown>, ctx: PluginContext): Promise<string[] | void> | string[] | void;
  getConfig?(): Record<string, unknown> | Promise<Record<string, unknown>>;
  setConfig?(cfg: Record<string, unknown>): void | Promise<void>;

  async accept(e: NexusEvent, ctx: PluginContext): Promise<boolean | void> {
    for (const r of this.rule) {
      const re = typeof r.reg === "string" ? new RegExp(r.reg) : r.reg;
      if (!re.test(e.msg)) continue;
      const need = r.permission || "all";
      if (need === "master" || need === "admin") {
        const ok = ctx.isMaster?.(e.userId) ?? false;
        if (!ok) {
          await e.reply("无权限");
          return true;
        }
      }
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
  /** 单个插件抛错时回调，不中断其它插件 */
  onError?: (id: string, message: string) => void;

  register(plugin: NexusPlugin): void {
    this.plugins.set(plugin.manifest.id, plugin);
  }

  /** 卸掉单个插件（热更某个目录时用），停用标记一并清掉。 */
  unregister(id: string): boolean {
    const had = this.plugins.delete(id);
    this.disabled.delete(id);
    return had;
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

  async emitReady(
    makeCtx: (id: string) => PluginContext,
    print?: (line: string) => void | Promise<void>,
    onlyIds?: Iterable<string>,
  ): Promise<void> {
    const allow = onlyIds ? new Set(onlyIds) : null;
    for (const p of this.values()) {
      if (allow && !allow.has(p.manifest.id)) continue;
      if (!this.isEnabled(p.manifest.id)) continue;
      try {
        const r = await p.onReady?.(makeCtx(p.manifest.id));
        const lines = Array.isArray(r) ? r : typeof r === "string" && r.trim() ? [r] : [];
        for (const line of lines) {
          const t = String(line ?? "");
          if (!t) continue;
          await print?.(t);
        }
      } catch (err) {
        this.report(p, err);
        await print?.(`插件 ${p.manifest.name || p.manifest.id} 就绪时出错`);
      }
    }
  }

  async emitNotice(
    ev: Record<string, unknown>,
    makeCtx: (id: string) => PluginContext,
  ): Promise<string[]> {
    const out: string[] = [];
    for (const p of this.values()) {
      if (!this.isEnabled(p.manifest.id)) continue;
      if (typeof p.onNotice !== "function") continue;
      const ctx = makeCtx(p.manifest.id);
      try {
        const r = await p.onNotice(ev, ctx);
        if (Array.isArray(r)) out.push(...r.filter((x) => String(x || "").trim()));
      } catch (err) {
        this.report(p, err);
      }
    }
    return out;
  }

  async dispatchEvent(
    e: NexusEvent,
    makeCtx: (id: string) => PluginContext,
    gate?: (id: string) => boolean | Promise<boolean>,
  ): Promise<NexusMessage[]> {
    const out: NexusMessage[] = [];
    let failedName = "";
    const isCmd = String(e.raw.content || "").trim().startsWith("#");
    for (const p of this.values()) {
      if (!this.isEnabled(p.manifest.id)) continue;
      if (gate && !(await gate(p.manifest.id))) continue;
      const scope =
        p.manifest.adapterScope ??
        (p.manifest.kind === "framework" || !(p.manifest.channels?.length) ? "all" : "specified");
      const chs = p.manifest.channels ?? [];
      if (scope !== "all" && chs.length && !chs.includes(e.channel)) continue;

      const ctx = makeCtx(p.manifest.id);
      try {
        if (typeof p.accept === "function") {
          const hit = await p.accept(e, ctx);
          if (hit) {
            out.push(...e.toOutbound(`plugin:${p.manifest.id}`));
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
      } catch (err) {
        this.report(p, err);
        failedName = p.manifest.name || p.manifest.id;
      }
    }
    if (!out.length && failedName && isCmd) {
      out.push({
        id: newId("msg"),
        channel: e.channel,
        chatId: e.chatId,
        userId: "nexus",
        type: "text",
        content: `插件 ${failedName} 出错了`,
        createdAt: nowIso(),
      });
    }
    return out;
  }

  private report(p: NexusPlugin, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    this.onError?.(p.manifest.id, message);
  }

  async onMessage(
    msg: NexusMessage,
    makeCtx: (id: string) => PluginContext,
    gate?: (id: string) => boolean | Promise<boolean>,
  ): Promise<NexusMessage[]> {
    const e = new NexusEvent(msg);
    return this.dispatchEvent(e, makeCtx, gate);
  }
}
