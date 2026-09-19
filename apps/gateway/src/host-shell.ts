/**
 * 主人在本机执行系统命令。
 * Windows 用 PowerShell；macOS / Linux 桌面与服务器优先 bash，没有就用 sh；Termux 用自带 bash。
 * 不是框架 # 指令，也不关在 agent-workspace 沙箱里。
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type HostShellResult = {
  ok: boolean;
  message: string;
  stdout?: string;
  stderr?: string;
  cwd: string;
  shell: string;
  platform: string;
};

function isTermux(): boolean {
  return Boolean(process.env.PREFIX?.includes("com.termux") || process.env.TERMUX_VERSION);
}

function platformLabel(): string {
  if (isTermux()) return "termux";
  if (process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return "server";
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "macos";
  return process.platform;
}

function pickShell(): { file: string; shell: string; wrap: (cmd: string) => string[] } {
  if (process.platform === "win32") {
    const file = existsSync("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe")
      ? "powershell.exe"
      : "pwsh.exe";
    return {
      file,
      shell: file.startsWith("pwsh") ? "pwsh" : "powershell",
      wrap: (cmd) => [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; $OutputEncoding=[System.Text.Encoding]::UTF8; ${cmd}`,
      ],
    };
  }
  const prefix = process.env.PREFIX || "";
  const candidates = [
    prefix ? join(prefix, "bin/bash") : "",
    "/bin/bash",
    "/usr/bin/bash",
    prefix ? join(prefix, "bin/sh") : "",
    "/bin/sh",
    "/usr/bin/sh",
  ].filter(Boolean);
  const file = candidates.find((p) => existsSync(p)) || "sh";
  const bash = /bash$/i.test(file);
  return {
    file,
    shell: bash ? "bash" : "sh",
    wrap: (cmd) => (bash ? ["-lc", cmd] : ["-c", cmd]),
  };
}

export async function runHostShell(
  command: string,
  opts: { cwd: string },
): Promise<HostShellResult> {
  const cmd = String(command || "").trim();
  const cwd = opts.cwd;
  const platform = platformLabel();
  const picked = pickShell();
  if (!cmd) return { ok: false, message: "缺少命令", cwd, shell: picked.shell, platform };
  if (cmd.length > 8000) return { ok: false, message: "命令过长", cwd, shell: picked.shell, platform };

  try {
    const { stdout, stderr } = await execFileAsync(picked.file, picked.wrap(cmd), {
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
      shell: picked.shell,
      platform,
      stdout: String(stdout || "").slice(0, 12_000),
      stderr: String(stderr || "").slice(0, 4_000),
    };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return {
      ok: false,
      message: (err.message || "执行失败").slice(0, 300),
      cwd,
      shell: picked.shell,
      platform,
      stdout: String(err.stdout || "").slice(0, 8_000),
      stderr: String(err.stderr || "").slice(0, 4_000),
    };
  }
}
