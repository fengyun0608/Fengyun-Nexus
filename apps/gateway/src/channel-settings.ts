import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type ChannelSettings = {
  label?: string;
  /** Owner / master user ids for this channel (e.g. QQ numbers). */
  masters: string[];
  /** If true, only masters trigger bot replies. */
  onlyMasters: boolean;
  /**
   * QQ 群白名单：仅这些群会回复 AI/插件。空 = 不限制群。
   * 仅对 messageType=group 生效。
   */
  replyGroupIds: string[];
  /** #更新 / 重启成功时额外抄送的群（发指令的原群一定发，不必填这里） */
  notifyGroupIds: string[];
  /** 本通道 AI 人设（注入 system prompt） */
  systemPrompt: string;
  note?: string;
  [key: string]: unknown;
};

export type ChannelsConfigFile = {
  channels: Record<string, ChannelSettings>;
};

function parseIdList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((m) => String(m).trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function normalize(raw: Partial<ChannelSettings> | undefined): ChannelSettings {
  const masters = parseIdList(raw?.masters);
  return {
    ...(raw ?? {}),
    label: typeof raw?.label === "string" ? raw.label : undefined,
    masters,
    onlyMasters: Boolean(raw?.onlyMasters),
    replyGroupIds: parseIdList(raw?.replyGroupIds),
    notifyGroupIds: parseIdList(raw?.notifyGroupIds),
    systemPrompt: typeof raw?.systemPrompt === "string" ? raw.systemPrompt : "",
    note: typeof raw?.note === "string" ? raw.note : "",
  };
}

export function loadChannelsConfig(root: string): ChannelsConfigFile {
  const def = JSON.parse(
    readFileSync(join(root, "configs/channels.default.json"), "utf8"),
  ) as ChannelsConfigFile;
  const local = join(root, "configs/channels.local.json");
  if (!existsSync(local)) {
    return {
      channels: Object.fromEntries(
        Object.entries(def.channels ?? {}).map(([id, s]) => [id, normalize(s)]),
      ),
    };
  }
  try {
    const j = JSON.parse(readFileSync(local, "utf8")) as Partial<ChannelsConfigFile>;
    const merged: Record<string, ChannelSettings> = {};
    for (const [id, s] of Object.entries(def.channels ?? {})) {
      merged[id] = normalize({ ...s, ...(j.channels?.[id] ?? {}) });
    }
    for (const [id, s] of Object.entries(j.channels ?? {})) {
      if (!merged[id]) merged[id] = normalize(s);
    }
    return { channels: merged };
  } catch {
    return {
      channels: Object.fromEntries(
        Object.entries(def.channels ?? {}).map(([id, s]) => [id, normalize(s)]),
      ),
    };
  }
}

export function saveChannelsConfig(root: string, cfg: ChannelsConfigFile): void {
  writeFileSync(
    join(root, "configs/channels.local.json"),
    `${JSON.stringify(cfg, null, 2)}\n`,
    "utf8",
  );
}

export function getChannelSettings(
  cfg: ChannelsConfigFile,
  id: string,
): ChannelSettings {
  return normalize(cfg.channels[id] ?? { masters: [], onlyMasters: false });
}

export function isChannelMaster(
  settings: ChannelSettings,
  userId: string,
): boolean {
  if (!settings.masters.length) return false;
  return settings.masters.includes(String(userId));
}

/** 群消息是否允许本通道回复（空白名单 = 全部群） */
export function isGroupReplyAllowed(
  settings: ChannelSettings,
  groupId: string | undefined,
): boolean {
  if (!settings.replyGroupIds.length) return true;
  if (!groupId) return true;
  return settings.replyGroupIds.includes(String(groupId));
}
