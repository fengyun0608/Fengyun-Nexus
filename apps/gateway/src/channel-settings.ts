import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type ChannelSettings = {
  label?: string;
  /** Owner / master user ids for this channel (e.g. QQ numbers). */
  masters: string[];
  /** If true, only masters trigger bot replies. */
  onlyMasters: boolean;
  note?: string;
  [key: string]: unknown;
};

export type ChannelsConfigFile = {
  channels: Record<string, ChannelSettings>;
};

function normalize(raw: Partial<ChannelSettings> | undefined): ChannelSettings {
  const masters = Array.isArray(raw?.masters)
    ? raw!.masters.map((m) => String(m).trim()).filter(Boolean)
    : typeof raw?.masters === "string"
      ? String(raw.masters)
          .split(/[,，\s]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  return {
    ...(raw ?? {}),
    label: typeof raw?.label === "string" ? raw.label : undefined,
    masters,
    onlyMasters: Boolean(raw?.onlyMasters),
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
