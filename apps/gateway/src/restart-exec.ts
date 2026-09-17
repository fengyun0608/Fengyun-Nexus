import { spawn } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Invoke repo-root restart executable (like Yunzai-style system restart).
 * - Windows: start /min restart.bat in a breakaway console so it survives gateway exit
 * - Unix/Termux: restart.sh backgrounds wait + boot.sh
 */
export function scheduleSystemRestart(root: string): {
  ok: boolean;
  message: string;
  script?: string;
} {
  const isWin = process.platform === "win32";
  const script = join(root, isWin ? "restart.bat" : "restart.sh");
  if (!existsSync(script)) {
    return { ok: false, message: "未找到重启程序" };
  }

  try {
    if (!isWin) {
      try {
        chmodSync(script, 0o755);
      } catch {
        /* ignore */
      }
    }

    if (isWin) {
      // CRITICAL: do NOT use `cmd /c restart.bat` alone — that process exits with the
      // gateway and nested `start /b` children often die with it.
      // `start "title" /min` creates a new console process that outlives us.
      const child = spawn(
        "cmd.exe",
        ["/c", "start", "FengyunNexusRestart", "/min", "cmd.exe", "/c", `call "${script}"`],
        {
          cwd: root,
          detached: true,
          stdio: "ignore",
          windowsHide: true,
          env: {
            ...process.env,
            NEXUS_RESTART_DELAY: process.env.NEXUS_RESTART_DELAY || "4",
          },
        },
      );
      child.unref();
    } else {
      const child = spawn("bash", [script], {
        cwd: root,
        detached: true,
        stdio: "ignore",
        env: {
          ...process.env,
          NEXUS_RESTART_DELAY: process.env.NEXUS_RESTART_DELAY || "4",
        },
      });
      child.unref();
    }

    return { ok: true, message: "正在重启", script };
  } catch {
    return {
      ok: false,
      message: "重启失败",
      script,
    };
  }
}
