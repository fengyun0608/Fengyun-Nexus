import { spawn } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Invoke repo-root restart executable (like Yunzai-style system restart).
 * - Windows: restart.bat
 * - Unix/Termux: restart.sh → boot.sh
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

    const child = isWin
      ? spawn("cmd.exe", ["/c", script], {
          cwd: root,
          detached: true,
          stdio: "ignore",
          windowsHide: true,
          env: { ...process.env },
        })
      : spawn("bash", [script], {
          cwd: root,
          detached: true,
          stdio: "ignore",
          env: { ...process.env },
        });

    child.unref();
    return { ok: true, message: "正在重启", script };
  } catch (e) {
    return {
      ok: false,
      message: "重启失败",
      script,
    };
  }
}
