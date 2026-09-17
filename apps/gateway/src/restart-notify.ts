import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type RestartNotify = {
  channel: string;
  chatId: string;
  userId: string;
  messageType?: string;
  groupId?: string;
  requestedAt: string;
  previousUptime?: string;
};

const FILE = "data/restart-notify.json";

export function restartNotifyPath(root: string): string {
  return join(root, FILE);
}

export function formatUptime(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}天`);
  if (h || d) parts.push(`${h}小时`);
  if (m || h || d) parts.push(`${m}分`);
  parts.push(`${s}秒`);
  return parts.join("");
}

export function saveRestartNotify(root: string, n: RestartNotify): void {
  const p = restartNotifyPath(root);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `${JSON.stringify(n, null, 2)}\n`, "utf8");
}

export function peekRestartNotify(root: string): RestartNotify | null {
  const p = restartNotifyPath(root);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as RestartNotify;
  } catch {
    return null;
  }
}

export function clearRestartNotify(root: string): void {
  const p = restartNotifyPath(root);
  try {
    if (existsSync(p)) unlinkSync(p);
  } catch {
    /* ignore */
  }
}

export function takeRestartNotify(root: string): RestartNotify | null {
  const j = peekRestartNotify(root);
  if (j) clearRestartNotify(root);
  return j;
}

export function buildRestartingMessage(uptime: string): string {
  return ["正在重启，请稍候", `本次运行时间：${uptime}`].join("\n");
}

export function buildRestartOkMessage(
  plugins: Array<{ id: string; name: string; version?: string }>,
  previousUptime?: string,
): string {
  const lines = ["重启成功"];
  if (previousUptime) lines.push(`上次运行时间：${previousUptime}`);
  lines.push("本次加载插件：");
  if (!plugins.length) {
    lines.push("· 无");
  } else {
    for (const p of plugins) {
      const ver = p.version ? `@${p.version}` : "";
      lines.push(`· ${p.name}  ${p.id}${ver}`);
    }
  }
  lines.push(`共 ${plugins.length} 个`);
  return lines.join("\n");
}
