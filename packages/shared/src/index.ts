export type NexusEnvId = "mobile" | "desktop" | "server" | "termux";

export type MessageType = "text" | "image" | "event" | "tool";

export interface NexusMessage {
  id: string;
  channel: string;
  chatId: string;
  userId: string;
  type: MessageType;
  content: string;
  attachments?: Array<{ kind: string; url: string }>;
  meta?: {
    tenantId?: string;
    personaId?: string;
    replyTo?: string;
    /** OneBot 11 */
    messageType?: "private" | "group" | string;
    groupId?: string;
    selfId?: string;
    /** 多号时标明这条消息来自哪一个机器人 */
    botId?: string;
    /** 消息里 @ 到的 QQ */
    atQqs?: string[];
    /** 是否 @ 了机器人自己 */
    atSelf?: boolean;
    /** 通道原文，如 OneBot raw_message */
    rawMessage?: string;
    /** 发送者昵称 */
    senderName?: string;
    /** 入站事件源码（已截断） */
    source?: string;
  };
  createdAt: string;
}

export interface EnvProfile {
  id: NexusEnvId;
  label: string;
  gateway: {
    host: string;
    port: number;
    cors: boolean;
  };
  web: {
    compactChrome: boolean;
    touchOptimized: boolean;
    maxWidth: number;
    serveStatic?: boolean;
  };
  features: Record<string, boolean>;
}

export interface AdminConfig {
  username: string;
  passwordEnv: string;
  defaultPassword: string;
  /** Login session lifetime in hours (default 12). */
  sessionHours: number;
  /** False until first console reconfiguration of username/password. */
  setupCompleted: boolean;
}

export interface RegistryConfig {
  baseUrl: string;
  tokenEnv: string;
  categories: Record<string, { path: string; label: string }>;
  update: { enabled: boolean; checkOnStart: boolean };
  /** 系统插件专仓。未配时对照本仓 origin 的 plugins/。 */
  pluginsRepo?: { url: string; branch?: string };
  /** 生态收录专仓（catalog.json）。线上收录与社区包更新走这里。 */
  ecosystemRepo?: { url: string; branch?: string };
}

export function newId(prefix = "nx"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
