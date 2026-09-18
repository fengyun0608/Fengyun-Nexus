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
    /** 消息里 @ 到的 QQ */
    atQqs?: string[];
    /** 是否 @ 了机器人自己 */
    atSelf?: boolean;
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
  /** 插件专仓（可选）。未配时对照本仓 origin 的 plugins/ 目录。 */
  pluginsRepo?: { url: string; branch?: string };
}

export function newId(prefix = "nx"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
