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

/**
 * Same-window restart: write flag + exit 75.
 * boot.mjs / pnpm boot 父进程检测到后原地再拉网关，不新开终端窗口。
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
      message: "正在重启",
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
