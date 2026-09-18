import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type BotConfig = {
  name: string;
  /** 呼唤前缀，如 nexus / 风云；留空不强制 */
  wakePrefixes: string[];
  /** 指令前缀，默认 # */
  commandPrefix: string;
  note?: string;
};

function parseList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === "string") {
    return raw
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function normalize(raw: Partial<BotConfig> | undefined): BotConfig {
  return {
    name: typeof raw?.name === "string" && raw.name.trim() ? raw.name.trim() : "Nexus",
    wakePrefixes: parseList(raw?.wakePrefixes),
    commandPrefix:
      typeof raw?.commandPrefix === "string" && raw.commandPrefix
        ? raw.commandPrefix
        : "#",
    note: typeof raw?.note === "string" ? raw.note : "",
  };
}

export function loadBotConfig(root: string): BotConfig {
  const defPath = join(root, "configs/bot.default.json");
  const localPath = join(root, "configs/bot.local.json");
  let def: Partial<BotConfig> = {};
  if (existsSync(defPath)) {
    try {
      def = JSON.parse(readFileSync(defPath, "utf8")) as Partial<BotConfig>;
    } catch {
      /* ignore */
    }
  }
  if (!existsSync(localPath)) return normalize(def);
  try {
    const local = JSON.parse(readFileSync(localPath, "utf8")) as Partial<BotConfig>;
    return normalize({ ...def, ...local });
  } catch {
    return normalize(def);
  }
}

export function saveBotConfig(root: string, cfg: BotConfig): void {
  writeFileSync(
    join(root, "configs/bot.local.json"),
    `${JSON.stringify(normalize(cfg), null, 2)}\n`,
    "utf8",
  );
}

/**
 * 去掉呼唤前缀，方便匹配 #帮助 / nexus帮助 / #nexus帮助。
 * 返回规范化后的文本（尽量保留 #指令形态）。
 */
export function stripWakePrefix(text: string, cfg: BotConfig): string {
  let t = text.trim();
  if (!t) return t;
  const prefixes = cfg.wakePrefixes
    .map((p) => p.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!prefixes.length) return t;

  const cmd = cfg.commandPrefix || "#";
  for (const p of prefixes) {
    const reHash = new RegExp(`^${escapeReg(cmd)}\\s*${escapeReg(p)}\\s*`, "i");
    if (reHash.test(t)) {
      t = t.replace(reHash, cmd);
      return t.trim();
    }
    const rePlain = new RegExp(`^${escapeReg(p)}\\s*`, "i");
    if (rePlain.test(t)) {
      t = t.replace(rePlain, "");
      t = t.trim();
      if (t && !t.startsWith(cmd) && !t.startsWith("#")) {
        // nexus帮助 → #帮助
        t = `${cmd}${t}`;
      }
      return t;
    }
  }
  return t;
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
