import { newId, nowIso, type NexusMessage } from "@fengyun/nexus-shared";

export interface ChannelAdapter {
  id: string;
  normalizeInbound(raw: unknown): NexusMessage;
  formatOutbound(msg: NexusMessage): unknown;
}

export class WebChannel implements ChannelAdapter {
  id = "web";

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

export class ChannelRegistry {
  private adapters = new Map<string, ChannelAdapter>();

  register(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(id: string): ChannelAdapter | undefined {
    return this.adapters.get(id);
  }

  list(): ChannelAdapter[] {
    return [...this.adapters.values()];
  }
}
