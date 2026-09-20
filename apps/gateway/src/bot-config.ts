import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type BotConfig = {
  name: string;
  /** 呼唤前缀，如 nexus / 风云；群聊里开头带这个才触发 AI（或 @ 机器人） */
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

export function matchWakePrefix(
  text: string,
  cfg: BotConfig,
): { matched: boolean; rest: string } {
  let t = text.trim();
  if (!t) return { matched: false, rest: t };
  const prefixes = cfg.wakePrefixes
    .map((p) => p.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!prefixes.length) return { matched: false, rest: t };

  const cmd = cfg.commandPrefix || "#";
  for (const p of prefixes) {
    const reHash = new RegExp(`^${escapeReg(cmd)}\\s*${escapeReg(p)}\\s*`, "i");
    if (reHash.test(t)) {
      return { matched: true, rest: t.replace(reHash, cmd).trim() };
    }
    const rePlain = new RegExp(`^${escapeReg(p)}\\s*`, "i");
    if (rePlain.test(t)) {
      let rest = t.replace(rePlain, "").trim();
      // 「nexus帮助」→「#帮助」；「nexus 你好」有空格 → 仍当说话
      // 中文常没空格：「白子禁言这个人」不能加成「#禁言…」，否则会误进群管
      if (rest && !rest.startsWith(cmd) && !rest.startsWith("#")) {
        const hasArgSep = /\s/.test(rest) || rest.includes("@") || /\[CQ:at/i.test(rest);
        const shortBare = [...rest].length <= 6;
        if (hasArgSep || shortBare) {
          // 有空格/@：白子禁言 @对方 10；短词：白子帮助 / 白子状态
          rest = `${cmd}${rest}`;
        }
      }
      return { matched: true, rest };
    }
  }
  return { matched: false, rest: t };
}

/**
 * 去掉呼唤前缀，方便匹配 #帮助 / nexus帮助 / #nexus帮助。
 */
export function stripWakePrefix(text: string, cfg: BotConfig): string {
  return matchWakePrefix(text, cfg).rest;
}

/** 闲聊用：只摘掉开头呼唤词，绝不自动加 # */
export function stripWakeForChat(text: string, cfg: BotConfig): string {
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
    if (reHash.test(t)) return t.replace(reHash, "").trim();
    const rePlain = new RegExp(`^${escapeReg(p)}\\s*`, "i");
    if (rePlain.test(t)) return t.replace(rePlain, "").trim();
  }
  return t;
}

export function hasWakePrefix(text: string, cfg: BotConfig): boolean {
  return matchWakePrefix(text, cfg).matched;
}

/** 去掉 @机器人 / CQ:at，留给模型干净句子 */
export function stripAtMentions(text: string, selfId?: string): string {
  let t = String(text || "");
  t = t.replace(/\[CQ:at,[^\]]*\]/gi, " ");
  if (selfId) {
    t = t.replace(new RegExp(`@${escapeReg(selfId)}\\s*`, "g"), " ");
  }
  // 残留 @123456
  t = t.replace(/@\d{5,}\s*/g, " ");
  return t.replace(/\s+/g, " ").trim();
}

/**
 * 群聊要不要走 AI：必须 @ 机器人，或开头呼唤词。
 * 私聊 / 控制台 / 非 QQ：直接放行。
 */
export function shouldTriggerAi(opts: {
  channel: string;
  messageType?: string;
  content: string;
  atSelf?: boolean;
  bot: BotConfig;
  isAdminConsole?: boolean;
}): boolean {
  if (opts.isAdminConsole) return true;
  if (opts.channel !== "onebot11") return true;
  if (opts.messageType !== "group") return true;
  if (opts.atSelf) return true;
  if (hasWakePrefix(opts.content, opts.bot)) return true;
  return false;
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
