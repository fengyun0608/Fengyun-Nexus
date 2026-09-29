import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

/** Parent boot.mjs loops when gateway exits with this code (same window / Termux session). */
export const NEXUS_RESTART_EXIT_CODE = 75;

const FLAG = "nexus-restart.flag";

export function restartFlagPath(root: string): string {
  return join(root, "data", FLAG);
}

/** Mark that the next process exit should be treated as same-window restart. */
export function writeRestartFlag(root: string): void {
  const dir = join(root, "data");
  mkdirSync(dir, { recursive: true });
  writeFileSync(restartFlagPath(root), `${Date.now()}\n`, "utf8");
}

export function consumeRestartFlag(root: string): boolean {
  const p = restartFlagPath(root);
  if (!existsSync(p)) return false;
  try {
    unlinkSync(p);
  } catch {
    /* ignore */
  }
  return true;
}

/** 是否在 PM2 托管的 boot.mjs 之下（网关子进程仍用 exit 75，由 boot 同窗再拉） */
export function underPm2Boot(): boolean {
  return (
    process.env.NEXUS_UNDER_PM2 === "1" ||
    Boolean(process.env.pm_id) ||
    process.env.name === "nexus"
  );
}

/**
 * Same-window restart: write flag + exit 75.
 * PM2 托管时进程是 boot.mjs，exit 75 仍由 boot 循环处理（不与 pm2 restart 打架）。
 * 运维整进程重启请用：nexus restart / pm2 restart nexus
 */
export function scheduleSystemRestart(root: string): {
  ok: boolean;
  message: string;
  exitCode: number;
} {
  try {
    writeRestartFlag(root);
    return {
      ok: true,
      message: underPm2Boot() ? "正在重启（PM2 · boot 同窗）" : "正在重启",
      exitCode: NEXUS_RESTART_EXIT_CODE,
    };
  } catch {
    return {
      ok: false,
      message: "重启失败",
      exitCode: 1,
    };
  }
}
