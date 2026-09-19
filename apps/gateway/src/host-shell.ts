/**
 * 主人在本机执行系统命令。Windows 走 PowerShell，其它系统走 bash。
 * 不是框架 # 指令，也不关在 agent-workspace 沙箱里。
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function runHostShell(
  command: string,
  opts: { cwd: string },
): Promise<{ ok: boolean; message: string; stdout?: string; stderr?: string; cwd: string }> {
  const cmd = String(command || "").trim();
  const cwd = opts.cwd;
  if (!cmd) return { ok: false, message: "缺少命令", cwd };
  if (cmd.length > 8000) return { ok: false, message: "命令过长", cwd };

  const isWin = process.platform === "win32";
  const file = isWin ? "powershell.exe" : "bash";
  const args = isWin
    ? [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; $OutputEncoding=[System.Text.Encoding]::UTF8; ${cmd}`,
      ]
    : ["-lc", cmd];

  try {
    const { stdout, stderr } = await execFileAsync(file, args, {
      cwd,
      timeout: 45_000,
      windowsHide: true,
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
    });
    return {
      ok: true,
      message: "已执行",
      cwd,
      stdout: String(stdout || "").slice(0, 12_000),
      stderr: String(stderr || "").slice(0, 4_000),
    };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return {
      ok: false,
      message: (err.message || "执行失败").slice(0, 300),
      cwd,
      stdout: String(err.stdout || "").slice(0, 8_000),
      stderr: String(err.stderr || "").slice(0, 4_000),
    };
  }
}
