/**
 * 本机前台可见窗口 / 进程摘要。给 AI 回答「开了什么软件」用。
 * Windows 优先读有窗口标题的进程；其它平台退回常见进程名列表。
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type DesktopApp = {
  name: string;
  title?: string;
  pid?: number;
};

function cleanTitle(s: string): string {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

async function windowsOpenApps(limit: number): Promise<DesktopApp[]> {
  const n = Math.max(1, Math.min(limit, 40));
  const ps = `
$ErrorActionPreference='SilentlyContinue'
$rows = Get-Process | Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle.Trim() -ne '' } |
  Sort-Object -Property CPU -Descending |
  Select-Object -First ${n} ProcessName,Id,MainWindowTitle
$json = ($rows | ConvertTo-Json -Compress)
$bytes = [System.Text.Encoding]::UTF8.GetBytes([string]$json)
[Convert]::ToBase64String($bytes)
`.trim();
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", ps],
    { timeout: 12_000, windowsHide: true, encoding: "utf8", maxBuffer: 2 * 1024 * 1024 },
  );
  const b64 = String(stdout || "").trim().replace(/\s+/g, "");
  if (!b64) return [];
  const raw = Buffer.from(b64, "base64").toString("utf8").trim();
  if (!raw || raw === "null") return [];
  const parsed = JSON.parse(raw) as
    | Array<{ ProcessName?: string; Id?: number; MainWindowTitle?: string }>
    | { ProcessName?: string; Id?: number; MainWindowTitle?: string };
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  const seen = new Set<string>();
  const out: DesktopApp[] = [];
  for (const row of rows) {
    const name = String(row.ProcessName || "").trim();
    const title = cleanTitle(String(row.MainWindowTitle || ""));
    if (!name || !title) continue;
    const key = `${name}|${title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, title, pid: Number(row.Id) || undefined });
  }
  return out;
}

async function unixOpenApps(limit: number): Promise<DesktopApp[]> {
  try {
    const { stdout } = await execFileAsync("ps", ["-eo", "comm=", "--sort=-%cpu"], {
      timeout: 8_000,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
    const skip = new Set([
      "ps",
      "bash",
      "zsh",
      "sh",
      "node",
      "systemd",
      "kthreadd",
      "init",
    ]);
    const seen = new Set<string>();
    const out: DesktopApp[] = [];
    for (const line of String(stdout || "").split(/\r?\n/)) {
      const name = line.trim().split(/[/\\]/).pop() || "";
      if (!name || skip.has(name) || seen.has(name)) continue;
      seen.add(name);
      out.push({ name });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

export async function listOpenDesktopApps(
  opts?: { limit?: number },
): Promise<{ ok: boolean; platform: string; apps: DesktopApp[]; message: string }> {
  const limit = Math.max(1, Math.min(Number(opts?.limit) || 20, 40));
  const platform = process.platform;
  try {
    const apps =
      platform === "win32" ? await windowsOpenApps(limit) : await unixOpenApps(limit);
    if (!apps.length) {
      return {
        ok: true,
        platform,
        apps: [],
        message: "没有读到带窗口的应用（可能都在后台，或当前环境读不到桌面）",
      };
    }
    return {
      ok: true,
      platform,
      apps,
      message: `当前可见约 ${apps.length} 个窗口/应用`,
    };
  } catch (e) {
    return {
      ok: false,
      platform,
      apps: [],
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
