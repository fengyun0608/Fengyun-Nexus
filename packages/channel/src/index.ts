import { newId, nowIso, type NexusMessage } from "@fengyun/nexus-shared";

function clipSource(raw: unknown): string {
  try {
    const s = JSON.stringify(raw ?? {});
    return s.length > 8000 ? `${s.slice(0, 8000)}…` : s;
  } catch {
    return "";
  }
}

export interface ChannelAdapter {
  id: string;
  /** Optional human label for console. */
  label?: string;
  normalizeInbound(raw: unknown): NexusMessage;
  formatOutbound(msg: NexusMessage): unknown;
}

/** Factory helper for pluggable adapters. */
export function defineAdapter(adapter: ChannelAdapter): ChannelAdapter {
  return adapter;
}

export class WebChannel implements ChannelAdapter {
  id = "web";
  label = "Web Console";

  normalizeInbound(raw: unknown): NexusMessage {
    const body = (raw ?? {}) as Record<string, unknown>;
    return {
      id: newId("msg"),
      channel: this.id,
      chatId: String(body.chatId ?? "web-default"),
      userId: String(body.userId ?? "web-user"),
      type: "text",
      content: String(body.content ?? ""),
      meta: {
        rawMessage: String(body.content ?? ""),
        senderName: body.nickname != null ? String(body.nickname) : undefined,
        source: clipSource(body),
      },
      createdAt: nowIso(),
    };
  }

  formatOutbound(msg: NexusMessage): unknown {
    return {
      id: msg.id,
      content: msg.content,
      createdAt: msg.createdAt,
      replyTo: msg.meta?.replyTo,
    };
  }
}

export class WebhookChannel implements ChannelAdapter {
  id = "webhook";
  label = "HTTP Webhook";

  normalizeInbound(raw: unknown): NexusMessage {
    const body = (raw ?? {}) as Record<string, unknown>;
    return {
      id: newId("msg"),
      channel: this.id,
      chatId: String(body.chatId ?? body.room ?? "webhook"),
      userId: String(body.userId ?? body.from ?? "webhook-user"),
      type: "text",
      content: String(body.content ?? body.text ?? ""),
      meta: {
        rawMessage: String(body.raw_message ?? body.content ?? body.text ?? ""),
        senderName: body.nickname != null ? String(body.nickname) : undefined,
        source: clipSource(body),
      },
      createdAt: nowIso(),
    };
  }

  formatOutbound(msg: NexusMessage): unknown {
    return { ok: true, message: msg };
  }
}

export {
  OneBot11Channel,
  extractOb11Text,
  extractOb11Records,
  type Ob11MessageEvent,
  type Ob11Segment,
} from "./onebot11.js";

export class ChannelRegistry {
  private adapters = new Map<string, ChannelAdapter>();
  private sources = new Map<string, "core" | "plugin">();

  /** source=core 内置；plugin 来自插件包 adapter 目录扫描 */
  register(adapter: ChannelAdapter, source: "core" | "plugin" = "core"): boolean {
    const id = String(adapter?.id || "").trim();
    if (!id) return false;
    if (this.sources.get(id) === "core" && source === "plugin") {
      return false;
    }
    this.adapters.set(id, adapter);
    this.sources.set(id, source);
    return true;
  }

  unregister(id: string): boolean {
    this.sources.delete(id);
    return this.adapters.delete(id);
  }

  get(id: string): ChannelAdapter | undefined {
    return this.adapters.get(id);
  }

  list(): ChannelAdapter[] {
    return [...this.adapters.values()];
  }

  listWithSource(): Array<ChannelAdapter & { source: "core" | "plugin" }> {
    return this.list().map((a) => ({
      ...a,
      source: this.sources.get(a.id) || "core",
    }));
  }

  has(id: string): boolean {
    return this.adapters.has(id);
  }

  sourceOf(id: string): "core" | "plugin" | undefined {
    return this.sources.get(id);
  }

  /** 卸掉旧的插件通道，再挂上本次扫到的（内置 core 不动） */
  remountPlugins(adapters: ChannelAdapter[]): { mounted: string[]; skipped: string[] } {
    for (const [id, src] of [...this.sources.entries()]) {
      if (src === "plugin") {
        this.adapters.delete(id);
        this.sources.delete(id);
      }
    }
    const mounted: string[] = [];
    const skipped: string[] = [];
    for (const a of adapters) {
      if (this.register(a, "plugin")) mounted.push(a.id);
      else skipped.push(a.id);
    }
    return { mounted, skipped };
  }
}
