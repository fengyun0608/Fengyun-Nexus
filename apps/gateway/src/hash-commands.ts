/**
 * Framework admin commands — every command MUST start with `#`.
 * #关机 / #开机 = soft power. #重启 = same-window restart.
 * #更新 = 拉框架 + 系统插件专仓（若已配），有一方更新则多群转发并同窗口重启。
 * Plugin commands (#菜单 / #生图 / …) are NOT handled here — they go to PluginHost.
 */
export type HashCommandResult = {
  handled: boolean;
  replies: string[];
  /** Soft runtime flags */
  powerOff?: boolean;
  /** Invoke repo-root restart.sh / restart.bat then exit process */
  systemRestart?: boolean;
  /** git pull 框架 + 系统插件专仓，有更新则同窗口重启 */
  systemUpdate?: boolean;
};

export type HashCommandContext = {
  powerOff: boolean;
  isMaster: boolean;
  /** Web console with admin session */
  isAdminConsole: boolean;
  /** Process uptime label, e.g. 1小时2分3秒 */
  uptime?: string;
};

/** Built-in admin set — anything else with # is for plugins. */
export const ADMIN_HASH = new Set([
  "#帮助",
  "#help",
  "#关机",
  "#开机",
  "#重启",
  "#更新",
  "#更新插件",
  "#update",
]);

export function isAdminHash(cmd: string): boolean {
  return Boolean(resolveAdminHash(cmd));
}

/** 从首词解析管理指令（支持 #更新框架 → #更新） */
export function resolveAdminHash(rawToken: string): string | null {
  const token = rawToken.trim().split(/\s+/)[0] ?? "";
  if (!token.startsWith("#")) return null;
  if (ADMIN_HASH.has(token)) return token;
  let best: string | null = null;
  for (const c of ADMIN_HASH) {
    if (token.startsWith(c) && (!best || c.length > best.length)) best = c;
  }
  return best;
}

const HELP = [
  "管理指令",
  "#帮助 — 查看指令",
  "#状态 — 框架 / 网络 / 通道",
  "#关机 — 暂停应答",
  "#开机 — 恢复应答",
  "#重启 — 重启",
  "#更新 — 更新框架与系统插件并重启",
  "#更新插件 — 同上",
  "#菜单 — 功能菜单",
].join("\n");

export function parseHashCommand(
  raw: string,
  ctx: HashCommandContext,
): HashCommandResult {
  const text = raw.trim();
  if (!text.startsWith("#")) {
    return { handled: false, replies: [] };
  }

  const cmd = resolveAdminHash(text);
  if (!cmd) {
    return { handled: false, replies: [] };
  }

  const allowed = ctx.isMaster || ctx.isAdminConsole;

  if (!allowed) {
    return {
      handled: true,
      replies: ["无权限"],
    };
  }

  if (
    ctx.powerOff &&
    cmd !== "#开机" &&
    cmd !== "#帮助" &&
    cmd !== "#help" &&
    cmd !== "#重启" &&
    cmd !== "#更新" &&
    cmd !== "#更新插件" &&
    cmd !== "#update"
  ) {
    return {
      handled: true,
      replies: ["已关机，发送 #开机"],
    };
  }

  switch (cmd) {
    case "#帮助":
    case "#help":
      return { handled: true, replies: [HELP] };
    case "#关机":
      return {
        handled: true,
        replies: ["已关机"],
        powerOff: true,
      };
    case "#开机":
      return {
        handled: true,
        replies: ["已开机"],
        powerOff: false,
      };
    case "#重启":
      return {
        handled: true,
        replies: [],
        powerOff: false,
        systemRestart: true,
      };
    case "#更新":
    case "#更新插件":
    case "#update":
      return {
        handled: true,
        replies: [],
        powerOff: false,
        systemUpdate: true,
      };
    default:
      return { handled: false, replies: [] };
  }
}
