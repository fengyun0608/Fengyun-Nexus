import { newId, nowIso, type NexusMessage } from "@fengyun/nexus-shared";

export interface ChatTurn {
  role: "user" | "assistant" | "system";
  content: string;
  at: string;
}

export interface Session {
  id: string;
  channel: string;
  chatId: string;
  userId: string;
  personaId?: string;
  turns: ChatTurn[];
  createdAt: string;
  updatedAt: string;
}

export class SessionManager {
  private sessions = new Map<string, Session>();

  getOrCreate(input: {
    channel: string;
    chatId: string;
    userId: string;
    personaId?: string;
  }): Session {
    const key = `${input.channel}:${input.chatId}:${input.userId}`;
    let s = this.sessions.get(key);
    if (!s) {
      s = {
        id: newId("sess"),
        channel: input.channel,
        chatId: input.chatId,
        userId: input.userId,
        personaId: input.personaId,
        turns: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      this.sessions.set(key, s);
    }
    return s;
  }

  append(session: Session, role: ChatTurn["role"], content: string): void {
    session.turns.push({ role, content, at: nowIso() });
    session.updatedAt = nowIso();
  }

  list(): Session[] {
    return [...this.sessions.values()];
  }
}

export type MessageHandler = (msg: NexusMessage) => Promise<NexusMessage | null> | NexusMessage | null;

export class MessageRouter {
  private handlers: MessageHandler[] = [];

  use(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  async dispatch(msg: NexusMessage): Promise<NexusMessage[]> {
    const out: NexusMessage[] = [];
    for (const h of this.handlers) {
      const r = await h(msg);
      if (r) out.push(r);
    }
    return out;
  }
}

export function createEchoHandler(): MessageHandler {
  return (msg) => {
    if (msg.type !== "text") return null;
    return {
      id: newId("msg"),
      channel: msg.channel,
      chatId: msg.chatId,
      userId: "nexus",
      type: "text",
      content: msg.content,
      meta: { replyTo: msg.id },
      createdAt: nowIso(),
    };
  };
}
