export type NexusEnvId = "mobile" | "desktop" | "server";

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
}

export function newId(prefix = "nx"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
