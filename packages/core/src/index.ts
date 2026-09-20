import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
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
  /** 重启后下一次对话要提示模型接着做 */
  resumeAfterRestart?: boolean;
}

type PersistShape = {
  version: 1;
  sessions: Array<{
    key: string;
    session: Session;
  }>;
};

function sessionKey(input: {
  channel: string;
  chatId: string;
  userId: string;
}): string {
  return `${input.channel}:${input.chatId}:${input.userId}`;
}

export class SessionManager {
  private sessions = new Map<string, Session>();
  private filePath = "";
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly maxTurns = 40;

  /** 绑定落盘路径并读回；重启后仍能接着聊 */
  bindStore(filePath: string): void {
    this.filePath = filePath;
    this.load();
  }

  getOrCreate(input: {
    channel: string;
    chatId: string;
    userId: string;
    personaId?: string;
  }): Session {
    const key = sessionKey(input);
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
    if (session.turns.length > this.maxTurns) {
      session.turns = session.turns.slice(-this.maxTurns);
    }
    session.updatedAt = nowIso();
    this.scheduleSave();
  }

  /** 重启前调用：给有对话的会话打上「接着做」标记并立刻落盘 */
  markAllForResume(): void {
    for (const s of this.sessions.values()) {
      if (s.turns.length) s.resumeAfterRestart = true;
    }
    this.flush();
  }

  /** 取一次重启续聊提示，取完清掉，避免每句都提示 */
  takeResumeHint(session: Session): string | null {
    if (!session.resumeAfterRestart) return null;
    session.resumeAfterRestart = false;
    this.scheduleSave();
    return "框架刚重启过。上面是重启前的对话，请接着做完，不要从零重来，也不要再写一遍框架里已有的指令或插件。";
  }

  list(): Session[] {
    return [...this.sessions.values()];
  }

  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.saveNow();
  }

  private scheduleSave(): void {
    if (!this.filePath) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.saveNow();
    }, 200);
  }

  private saveNow(): void {
    if (!this.filePath) return;
    try {
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const payload: PersistShape = {
        version: 1,
        sessions: [...this.sessions.entries()].map(([key, session]) => ({
          key,
          session: {
            ...session,
            turns: session.turns.slice(-this.maxTurns),
          },
        })),
      };
      writeFileSync(this.filePath, `${JSON.stringify(payload)}\n`, "utf8");
    } catch {
      /* 落盘失败不挡回话 */
    }
  }

  private load(): void {
    if (!this.filePath || !existsSync(this.filePath)) return;
    try {
      const raw = JSON.parse(readFileSync(this.filePath, "utf8")) as PersistShape;
      if (!raw || raw.version !== 1 || !Array.isArray(raw.sessions)) return;
      for (const row of raw.sessions) {
        if (!row?.key || !row.session) continue;
        const s = row.session;
        if (!Array.isArray(s.turns)) s.turns = [];
        s.turns = s.turns.slice(-this.maxTurns);
        this.sessions.set(row.key, s);
      }
    } catch {
      /* 坏文件就当没有 */
    }
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
