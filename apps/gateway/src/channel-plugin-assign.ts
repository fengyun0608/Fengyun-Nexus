/**
 * 通道给插件分配：哪些号生效，每个号一份配置。
 * 生效列表空着 = 这个通道上所有号都走。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type ChannelPluginAssign = {
  accounts: string[];
  byAccount: Record<string, Record<string, unknown>>;
};

type FileShape = Record<string, Record<string, ChannelPluginAssign>>;

const FILE_NAME = "channel-plugin.local.json";

function empty(): ChannelPluginAssign {
  return { accounts: [], byAccount: {} };
}

function pathOf(root: string): string {
  return join(root, "configs", FILE_NAME);
}

export function loadChannelPluginFile(root: string): FileShape {
  const p = pathOf(root);
  if (!existsSync(p)) return {};
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as FileShape;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return raw;
  } catch {
    return {};
  }
}

function writeFile(root: string, data: FileShape): void {
  mkdirSync(join(root, "configs"), { recursive: true });
  writeFileSync(pathOf(root), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function getChannelPluginAssign(root: string, channelId: string, pluginId: string): ChannelPluginAssign {
  const row = loadChannelPluginFile(root)[channelId]?.[pluginId];
  if (!row || typeof row !== "object") return empty();
  const accounts = Array.isArray(row.accounts)
    ? row.accounts.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  const byAccount: Record<string, Record<string, unknown>> = {};
  if (row.byAccount && typeof row.byAccount === "object") {
    for (const [k, v] of Object.entries(row.byAccount)) {
      if (v && typeof v === "object" && !Array.isArray(v)) byAccount[k] = v as Record<string, unknown>;
    }
  }
  return { accounts, byAccount };
}

export function saveChannelPluginAssign(
  root: string,
  channelId: string,
  pluginId: string,
  next: ChannelPluginAssign,
): ChannelPluginAssign {
  const all = loadChannelPluginFile(root);
  const ch = { ...(all[channelId] || {}) };
  ch[pluginId] = {
    accounts: next.accounts.map((x) => String(x || "").trim()).filter(Boolean),
    byAccount: next.byAccount,
  };
  all[channelId] = ch;
  writeFile(root, all);
  return ch[pluginId];
}
