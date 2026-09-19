/**
 * 本机前台可见窗口 / 进程摘要。给 AI 回答「开了什么软件」用。
 * Windows 优先读有窗口标题的进程；其它平台退回常见进程名列表。
 */
import { execFile } from "node:child_process";
import { statfsSync } from "node:fs";
import {
  arch,
  cpus,
  freemem,
  hostname,
  platform as osPlatform,
  release,
  totalmem,
  uptime as osUptime,
} from "node:os";
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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const parts: string[] = [];
  if (days) parts.push(`${days} 天`);
  if (hours || days) parts.push(`${hours} 小时`);
  parts.push(`${minutes} 分钟`);
  return parts.join(" ");
}

/** 整台电脑自开机起的时长，不是框架进程时长。 */
export function hostUptime(): {
  ok: boolean;
  platform: string;
  hostname: string;
  uptimeSeconds: number;
  bootAt: string;
  message: string;
} {
  const uptimeSeconds = Math.max(0, Math.floor(osUptime()));
  const boot = new Date(Date.now() - uptimeSeconds * 1000);
  const bootAt = `${boot.getFullYear()}-${pad2(boot.getMonth() + 1)}-${pad2(boot.getDate())} ${pad2(boot.getHours())}:${pad2(boot.getMinutes())}`;
  return {
    ok: true,
    platform: osPlatform(),
    hostname: hostname(),
    uptimeSeconds,
    bootAt,
    message: `这台电脑已运行 ${formatDuration(uptimeSeconds)}，大约 ${bootAt} 开机`,
  };
}

function gb(bytes: number): string {
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function diskLines(): string[] {
  const roots = process.platform === "win32" ? ["C:\\", "D:\\", "E:\\", "F:\\"] : ["/"];
  const out: string[] = [];
  for (const root of roots) {
    try {
      const stat = statfsSync(root);
      const total = Number(stat.blocks) * Number(stat.bsize);
      const free = Number(stat.bavail) * Number(stat.bsize);
      if (!Number.isFinite(total) || total <= 0) continue;
      const label = root.replace(/[\\/]+$/, "") || root;
      out.push(`${label} 共 ${gb(total)}，剩余 ${gb(free)}`);
    } catch {
      /* 没有这块盘 */
    }
  }
  return out;
}

/** 本机系统概况：开机时长、系统、处理器、内存、磁盘。 */
export function hostInfo(): {
  ok: boolean;
  hostname: string;
  platform: string;
  release: string;
  arch: string;
  cpu: string;
  threads: number;
  memoryTotal: string;
  memoryFree: string;
  disks: string[];
  uptime: string;
  message: string;
} {
  const up = hostUptime();
  const cores = cpus();
  const cpu = cores[0]?.model.replace(/\s+/g, " ").trim() || "未知";
  const disks = diskLines();
  const memoryTotal = gb(totalmem());
  const memoryFree = gb(freemem());
  const sys = `${osPlatform()} ${release()} ${arch()}`;
  const message = [
    up.message,
    `系统 ${sys}`,
    `处理器 ${cpu}，${cores.length} 线程`,
    `内存共 ${memoryTotal}，可用 ${memoryFree}`,
    disks.length ? disks.join("；") : "磁盘未读到",
  ].join("。");
  return {
    ok: true,
    hostname: hostname(),
    platform: osPlatform(),
    release: release(),
    arch: arch(),
    cpu,
    threads: cores.length,
    memoryTotal,
    memoryFree,
    disks,
    uptime: up.message,
    message,
  };
}

function safeAppName(raw: string): string | null {
  const name = String(raw || "").trim();
  if (!/^[\p{L}\p{N} ._+-]{1,40}$/u.test(name)) return null;
  return name;
}

function psEncoded(script: string): string {
  return Buffer.from(script, "utf16le").toString("base64");
}

const LAUNCH_PS = `
$ErrorActionPreference = 'Continue'
$q = ([string]$env:NEXUS_LAUNCH_NAME).Trim()
$dry = [string]$env:NEXUS_LAUNCH_DRY -eq '1'
$result = @{ ok = $false; message = '缺少软件名'; name = ''; path = '' }
if ($q) {
  function Test-Hit([string]$base) {
    if (-not $base) { return 9 }
    if ($base.Equals($q, [StringComparison]::OrdinalIgnoreCase)) { return 0 }
    if ($base.StartsWith($q, [StringComparison]::OrdinalIgnoreCase)) { return 1 }
    if ($base.IndexOf($q, [StringComparison]::OrdinalIgnoreCase) -ge 0) { return 2 }
    return 9
  }
  $cands = New-Object System.Collections.Generic.List[object]
  function Add-Hit($score, $path, $name, $kind) {
    if ($score -ge 9 -or -not $path) { return }
    $cands.Add([pscustomobject]@{ Score = [int]$score; Path = [string]$path; Name = [string]$name; Kind = [string]$kind })
  }
  function Walk([string]$root, [int]$depth) {
    if ($depth -lt 0 -or -not $root) { return }
    if (-not (Test-Path -LiteralPath $root)) { return }
    $items = @(Get-ChildItem -LiteralPath $root -Force -ErrorAction SilentlyContinue)
    foreach ($item in $items) {
      if ($null -eq $item) { continue }
      if ($item.PSIsContainer) { Walk $item.FullName ($depth - 1); continue }
      $ext = ([string]$item.Extension).ToLowerInvariant()
      if ($ext -ne '.lnk' -and $ext -ne '.exe') { continue }
      Add-Hit (Test-Hit ([string]$item.BaseName)) $item.FullName $item.BaseName 'file'
    }
  }
  $startMenu = Join-Path $env:ProgramData 'Microsoft\\Windows\\Start Menu\\Programs'
  $userMenu = Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs'
  Walk $startMenu 6
  Walk $userMenu 6
  Walk (Join-Path $env:USERPROFILE 'Desktop') 2
  Walk (Join-Path $env:PUBLIC 'Desktop') 2
  $exact = @($cands | Where-Object { $_.Score -eq 0 })
  if ($exact.Count -eq 0) {
    Walk $env:ProgramFiles 3
    $pf86 = (Get-ChildItem Env: -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'ProgramFiles(x86)' } | Select-Object -First 1).Value
    if ($pf86) { Walk ([string]$pf86) 3 }
    Walk (Join-Path $env:LOCALAPPDATA 'Programs') 3
    $uninst = @(
      'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
      'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
      'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
    )
    foreach ($row in @(Get-ItemProperty -Path $uninst -ErrorAction SilentlyContinue)) {
      if ($null -eq $row) { continue }
      $dn = [string]$row.DisplayName
      $score = Test-Hit $dn
      if ($score -ge 9) { continue }
      $icon = [string]$row.DisplayIcon
      if ($icon -match '^"([^"]+)"') { $icon = $Matches[1] }
      $icon = (($icon -split ',')[0]).Trim().Trim('"')
      if ($icon -and (Test-Path -LiteralPath $icon)) { Add-Hit $score $icon $dn 'file' }
    }
  }
  try {
    foreach ($app in @(Get-StartApps -ErrorAction SilentlyContinue)) {
      Add-Hit (Test-Hit ([string]$app.Name)) ([string]$app.AppID) ([string]$app.Name) 'startapp'
    }
  } catch {}
  $best = $null
  if ($cands.Count -gt 0) {
    $best = $cands | Sort-Object Score, Name | Select-Object -First 1
  }
  if (-not $best) {
    $result.message = "没找到：$q"
  } elseif ($dry) {
    $result.ok = $true
    $result.name = [string]$best.Name
    $result.path = [string]$best.Path
    $result.message = "找到了 " + $best.Name
  } else {
    try {
      if ($best.Kind -eq 'startapp') {
        $arg = 'shell:AppsFolder\\' + [string]$best.Path
        Start-Process -FilePath (Join-Path $env:SystemRoot 'explorer.exe') -ArgumentList $arg
      } else {
        Start-Process -FilePath ([string]$best.Path)
      }
      $result.ok = $true
      $result.name = [string]$best.Name
      $result.path = [string]$best.Path
      $result.message = "已启动 " + $best.Name
    } catch {
      $result.name = [string]$best.Name
      $result.path = [string]$best.Path
      $result.message = "找到了但没打开"
    }
  }
}
$json = $result | ConvertTo-Json -Compress
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes([string]$json))
`.trim();

function decodeLaunch(stdout: string): { ok: boolean; message: string; name?: string; path?: string } | null {
  const b64 = String(stdout || "")
    .trim()
    .split(/\s+/)
    .pop();
  if (!b64) return null;
  try {
    const parsed = JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as {
      ok?: boolean;
      message?: string;
      name?: string;
      path?: string;
    };
    return {
      ok: Boolean(parsed.ok),
      message: String(parsed.message || "已尝试启动"),
      name: parsed.name || undefined,
      path: parsed.path || undefined,
    };
  } catch {
    return null;
  }
}

/** 按软件名启动已安装应用。只接受名字，不接受命令行。 */
export async function launchDesktopApp(
  rawName: string,
  opts?: { dry?: boolean },
): Promise<{ ok: boolean; message: string; name?: string; path?: string }> {
  const name = safeAppName(rawName);
  if (!name) return { ok: false, message: "软件名不合法，只写应用名，例如 ToDesk" };
  if (process.platform !== "win32") {
    return { ok: false, message: "当前只在 Windows 上打开本机软件" };
  }
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-EncodedCommand", psEncoded(LAUNCH_PS)],
      {
        timeout: 40_000,
        windowsHide: true,
        encoding: "utf8",
        maxBuffer: 2 * 1024 * 1024,
        env: {
          ...process.env,
          NEXUS_LAUNCH_NAME: name,
          NEXUS_LAUNCH_DRY: opts?.dry ? "1" : "",
        },
      },
    );
    return decodeLaunch(stdout) ?? { ok: false, message: "启动没有返回结果" };
  } catch (e) {
    const err = e as { stderr?: string; stdout?: string; message?: string };
    const parsed = decodeLaunch(String(err.stdout || ""));
    if (parsed) return parsed;
    const stderr = String(err.stderr || "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .pop();
    return { ok: false, message: stderr ? `启动失败：${stderr.slice(0, 160)}` : "启动失败" };
  }
}
