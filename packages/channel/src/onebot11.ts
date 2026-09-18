import { newId, nowIso, type NexusMessage } from "@fengyun/nexus-shared";

/** OneBot 11 message segment (array format). */
export type Ob11Segment =
  | { type: "text"; data: { text: string } }
  | { type: string; data: Record<string, unknown> };

export type Ob11MessageEvent = {
  post_type?: string;
  message_type?: "private" | "group" | string;
  sub_type?: string;
  user_id?: number | string;
  group_id?: number | string;
  message_id?: number | string;
  self_id?: number | string;
  raw_message?: string;
  message?: string | Ob11Segment[];
  sender?: { user_id?: number | string; nickname?: string };
};

export function extractOb11Text(message: string | Ob11Segment[] | undefined, raw?: string): string {
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message)) {
    return message
      .map((seg) => {
        if (seg.type === "text") return String(seg.data?.text ?? "");
        if (seg.type === "at") return `@${seg.data?.qq ?? ""}`;
        return "";
      })
      .join("")
      .trim();
  }
  return String(raw ?? "").trim();
}

/** 消息里被 @ 的 QQ 号（含 CQ 字符串） */
export function extractOb11AtQqs(
  message: string | Ob11Segment[] | undefined,
  raw?: string,
): string[] {
  const out: string[] = [];
  if (Array.isArray(message)) {
    for (const seg of message) {
      if (seg.type === "at" && seg.data?.qq != null) out.push(String(seg.data.qq));
    }
  }
  const blob = `${typeof message === "string" ? message : ""} ${raw ?? ""}`;
  for (const m of blob.matchAll(/\[CQ:at,qq=([^\]]+)\]/gi)) {
    out.push(String(m[1]).trim());
  }
  return [...new Set(out.filter(Boolean))];
}

/**
 * Built-in OneBot 11 adapter (NapCat / go-cqhttp compatible).
 * @see https://napneko.github.io
 */
export class OneBot11Channel {
  id = "onebot11";
  label = "OneBot 11";

  normalizeInbound(raw: unknown): NexusMessage {
    const ev = (raw ?? {}) as Ob11MessageEvent;
    const text = extractOb11Text(ev.message, ev.raw_message);
    const atQqs = extractOb11AtQqs(ev.message, ev.raw_message);
    const selfId = ev.self_id != null ? String(ev.self_id) : undefined;
    const isGroup = ev.message_type === "group";
    const chatId = isGroup
      ? `group:${ev.group_id ?? "0"}`
      : `private:${ev.user_id ?? "0"}`;
    return {
      id: newId("msg"),
      channel: this.id,
      chatId,
      userId: String(ev.user_id ?? ev.sender?.user_id ?? "0"),
      type: "text",
      content: text,
      meta: {
        replyTo: ev.message_id != null ? String(ev.message_id) : undefined,
        messageType: isGroup ? "group" : "private",
        groupId: ev.group_id != null ? String(ev.group_id) : undefined,
        selfId,
        atQqs,
        atSelf: Boolean(selfId && atQqs.includes(selfId)),
      },
      createdAt: nowIso(),
    };
  }

  /** Build OneBot send_msg action params from a Nexus outbound. */
  toSendParams(msg: NexusMessage): {
    message_type: "private" | "group";
    user_id?: number;
    group_id?: number;
    message: string | Ob11Segment[];
  } {
    const mt = (msg.meta?.messageType as "private" | "group" | undefined) ?? "private";
    let message: string | Ob11Segment[] = msg.content;
    if (msg.type === "image") {
      const file = msg.attachments?.[0]?.url || msg.content;
      message = [
        ...(msg.content && msg.content !== "image"
          ? [{ type: "text" as const, data: { text: `${msg.content}\n` } }]
          : []),
        { type: "image", data: { file } },
      ];
    }
    if (mt === "group") {
      const gid = Number(msg.meta?.groupId ?? msg.chatId.replace(/^group:/, ""));
      return { message_type: "group", group_id: gid, message };
    }
    const uid = Number(msg.userId !== "nexus" ? msg.userId : msg.chatId.replace(/^private:/, ""));
    return { message_type: "private", user_id: uid, message };
  }

  formatOutbound(msg: NexusMessage): unknown {
    return {
      action: "send_msg",
      params: this.toSendParams(msg),
    };
  }
}
