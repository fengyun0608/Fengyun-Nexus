import { newId, nowIso, type NexusMessage } from "@fengyun/nexus-shared";

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
  type Ob11MessageEvent,
  type Ob11Segment,
} from "./onebot11.js";

export class ChannelRegistry {
  private adapters = new Map<string, ChannelAdapter>();

  register(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  unregister(id: string): boolean {
    return this.adapters.delete(id);
  }

  get(id: string): ChannelAdapter | undefined {
    return this.adapters.get(id);
  }

  list(): ChannelAdapter[] {
    return [...this.adapters.values()];
  }

  has(id: string): boolean {
    return this.adapters.has(id);
  }
}
