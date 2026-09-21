import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type MasterLevel = "core" | "new" | "normal";

export type ChannelSettings = {
  label?: string;
  /** 兼容旧配置：全部主人并集（读写时与三级字段同步） */
  masters: string[];
  /** 核心主人：控制台可设；可管所有主人 */
  coreMasters: string[];
  /** 新主人：可加普通/新主人，删不了核心与新主人以外的更高权限 */
  newMasters: string[];
  /** 普通主人：可加普通主人，可删普通主人 */
  normalMasters: string[];
  /** If true, only masters trigger bot replies. */
  onlyMasters: boolean;
  /**
   * AI 回复群白名单：仅这些群会走 AI / 普通闲聊。空 = 不限制。
   * 框架与插件的 # 指令不受此限制。
   * 仅对 messageType=group 生效。
   */
  replyGroupIds: string[];
  /** 本通道 AI 人设（注入 system prompt） */
  systemPrompt: string;
  /** Webhook 共享令牌（可被 NEXUS_WEBHOOK_TOKEN 覆盖） */
  accessToken?: string;
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

function uniq(ids: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const s = String(id).trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function syncMastersUnion(s: ChannelSettings): ChannelSettings {
  const coreMasters = uniq(s.coreMasters);
  const newMasters = uniq(s.newMasters).filter((id) => !coreMasters.includes(id));
  const normalMasters = uniq(s.normalMasters).filter(
    (id) => !coreMasters.includes(id) && !newMasters.includes(id),
  );
  return {
    ...s,
    coreMasters,
    newMasters,
    normalMasters,
    masters: uniq([...coreMasters, ...newMasters, ...normalMasters]),
  };
}

function normalize(raw: Partial<ChannelSettings> | undefined): ChannelSettings {
  const legacy = parseIdList(raw?.masters);
  let coreMasters = parseIdList(raw?.coreMasters);
  let newMasters = parseIdList(raw?.newMasters);
  let normalMasters = parseIdList(raw?.normalMasters);
  // 旧配置只有 masters：全部视为核心主人
  if (!coreMasters.length && !newMasters.length && !normalMasters.length && legacy.length) {
    coreMasters = legacy;
  }
  return syncMastersUnion({
    ...(raw ?? {}),
    label: typeof raw?.label === "string" ? raw.label : undefined,
    masters: legacy,
    coreMasters,
    newMasters,
    normalMasters,
    onlyMasters: Boolean(raw?.onlyMasters),
    replyGroupIds: parseIdList(raw?.replyGroupIds),
    systemPrompt: typeof raw?.systemPrompt === "string" ? raw.systemPrompt : "",
    note: typeof raw?.note === "string" ? raw.note : "",
  });
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
  const channels: Record<string, ChannelSettings> = {};
  for (const [id, s] of Object.entries(cfg.channels ?? {})) {
    channels[id] = syncMastersUnion(normalize(s));
  }
  writeFileSync(
    join(root, "configs/channels.local.json"),
    `${JSON.stringify({ channels }, null, 2)}\n`,
    "utf8",
  );
}

export function getChannelSettings(
  cfg: ChannelsConfigFile,
  id: string,
): ChannelSettings {
  return normalize(cfg.channels[id] ?? { masters: [], onlyMasters: false });
}

export function masterLevelOf(
  settings: ChannelSettings,
  userId: string,
): MasterLevel | null {
  const id = String(userId);
  if (settings.coreMasters.includes(id)) return "core";
  if (settings.newMasters.includes(id)) return "new";
  if (settings.normalMasters.includes(id)) return "normal";
  if (settings.masters.includes(id)) return "core";
  return null;
}

export function isChannelMaster(
  settings: ChannelSettings,
  userId: string,
): boolean {
  return masterLevelOf(settings, userId) != null;
}

export function isCoreMaster(settings: ChannelSettings, userId: string): boolean {
  return masterLevelOf(settings, userId) === "core";
}

const LEVEL_RANK: Record<MasterLevel, number> = {
  core: 3,
  new: 2,
  normal: 1,
};

export type MasterMutateResult = { ok: true; settings: ChannelSettings } | { ok: false; error: string };

/** 通道尚无主人时，设第一位核心主人（仅供控制台侧逻辑复用，群指令不可用） */
export function claimFirstMaster(
  settings: ChannelSettings,
  userId: string,
): MasterMutateResult {
  if (settings.masters.length || settings.coreMasters.length) {
    return { ok: false, error: "已有主人，请在控制台通道设置里改" };
  }
  const target = String(userId).trim();
  if (!target) return { ok: false, error: "无法识别你的账号" };
  if (!/^\d{5,}$/.test(target) && !/^web:/i.test(target) && target !== "admin") {
    /* QQ 用数字；控制台也可能是别的 id，仍允许认主 */
    if (target.length < 2) return { ok: false, error: "账号无效" };
  }
  let next = { ...settings };
  next.coreMasters = [target];
  next.newMasters = [];
  next.normalMasters = [];
  next = syncMastersUnion(next);
  return { ok: true, settings: next };
}

/** 主人互加：核心可加任何级；新主人可加新/普通；普通只能加普通。 */
export function addChannelMaster(
  settings: ChannelSettings,
  actorId: string,
  targetId: string,
  level: MasterLevel,
): MasterMutateResult {
  const actor = masterLevelOf(settings, actorId);
  if (!actor) return { ok: false, error: "无权限" };
  const target = String(targetId).trim();
  if (!/^\d{5,}$/.test(target)) return { ok: false, error: "QQ 号无效" };
  if (LEVEL_RANK[actor] < LEVEL_RANK[level]) {
    return { ok: false, error: "权限不够，加不了这个级别" };
  }
  if (actor === "new" && level === "core") {
    return { ok: false, error: "新主人加不了核心主人" };
  }
  if (actor === "normal" && level !== "normal") {
    return { ok: false, error: "普通主人只能加普通主人" };
  }
  let next = { ...settings };
  next.coreMasters = next.coreMasters.filter((x) => x !== target);
  next.newMasters = next.newMasters.filter((x) => x !== target);
  next.normalMasters = next.normalMasters.filter((x) => x !== target);
  if (level === "core") next.coreMasters = [...next.coreMasters, target];
  else if (level === "new") next.newMasters = [...next.newMasters, target];
  else next.normalMasters = [...next.normalMasters, target];
  next = syncMastersUnion(next);
  return { ok: true, settings: next };
}

/** 新主人删不了核心/新主人；普通只能删普通；核心可删非自己（至少留一个核心）。 */
export function removeChannelMaster(
  settings: ChannelSettings,
  actorId: string,
  targetId: string,
): MasterMutateResult {
  const actor = masterLevelOf(settings, actorId);
  if (!actor) return { ok: false, error: "无权限" };
  const target = String(targetId).trim();
  const targetLevel = masterLevelOf(settings, target);
  if (!targetLevel) return { ok: false, error: "对方不是主人" };
  if (actor === "new" && (targetLevel === "core" || targetLevel === "new")) {
    return { ok: false, error: "新主人删不了核心或新主人" };
  }
  if (actor === "normal" && targetLevel !== "normal") {
    return { ok: false, error: "普通主人只能删普通主人" };
  }
  if (targetLevel === "core" && settings.coreMasters.length <= 1) {
    return { ok: false, error: "至少保留一位核心主人" };
  }
  let next = { ...settings };
  next.coreMasters = next.coreMasters.filter((x) => x !== target);
  next.newMasters = next.newMasters.filter((x) => x !== target);
  next.normalMasters = next.normalMasters.filter((x) => x !== target);
  next = syncMastersUnion(next);
  return { ok: true, settings: next };
}

/** 群消息是否允许走 AI / 普通闲聊（空白名单 = 全部群；# 指令不走此判断） */
export function isGroupReplyAllowed(
  settings: ChannelSettings,
  groupId: string | undefined,
): boolean {
  if (!settings.replyGroupIds.length) return true;
  if (!groupId) return true;
  return settings.replyGroupIds.includes(String(groupId));
}
