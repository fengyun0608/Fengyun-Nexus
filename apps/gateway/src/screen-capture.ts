/**
 * 截本机屏幕，不是渲状态卡片。
 * Windows / macOS / Linux 桌面 / Termux 各走系统命令；无显示器的服务器直接说明截不了。
 */
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ScreenShot = {
  ok: boolean;
  message: string;
  path?: string;
  platform: string;
};

function isTermux(): boolean {
  return Boolean(process.env.PREFIX?.includes("com.termux") || process.env.TERMUX_VERSION);
}

function hostKind(): string {
  if (isTermux()) return "termux";
  if (process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return "server";
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "macos";
  if (process.platform === "linux") return "linux";
  return process.platform;
}

function hasDesktop(): boolean {
  if (process.platform === "win32" || process.platform === "darwin" || isTermux()) return true;
  return Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
}

async function commandExists(name: string): Promise<boolean> {
  try {
    await execFileAsync("sh", ["-c", `command -v ${name}`], { timeout: 4_000, encoding: "utf8" });
    return true;
  } catch {
    return false;
  }
}

function psQuote(p: string): string {
  return `'${p.replace(/'/g, "''")}'`;
}

async function captureWindows(file: string): Promise<void> {
  const dest = psQuote(file);
  const ps = `
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$b = [System.Windows.Forms.SystemInformation]::VirtualScreen
if ($b.Width -lt 2 -or $b.Height -lt 2) { throw '没有可见桌面' }
$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.X, $b.Y, 0, 0, $bmp.Size)
$g.Dispose()
$maxW = 1600
if ($bmp.Width -gt $maxW) {
  $nh = [Math]::Max(1, [int]($bmp.Height * $maxW / $bmp.Width))
  $small = New-Object System.Drawing.Bitmap $maxW, $nh
  $sg = [System.Drawing.Graphics]::FromImage($small)
  $sg.DrawImage($bmp, 0, 0, $maxW, $nh)
  $sg.Dispose(); $bmp.Dispose(); $bmp = $small
}
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
if (-not $codec) { throw '没有 JPEG 编码器' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]72)
$bmp.Save(${dest}, $codec, $ep)
$bmp.Dispose()
`.trim();
  await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-STA", "-NonInteractive", "-Command", ps],
    { timeout: 25_000, windowsHide: true, encoding: "utf8", maxBuffer: 1024 * 1024 },
  );
}

async function captureMac(file: string): Promise<void> {
  await execFileAsync("screencapture", ["-x", "-t", "jpg", file], {
    timeout: 20_000,
    encoding: "utf8",
  });
}

async function captureTermux(file: string): Promise<void> {
  if (!(await commandExists("termux-screenshot"))) {
    throw new Error("Termux 需安装 termux-api 后才能截屏");
  }
  await execFileAsync("termux-screenshot", [file], { timeout: 20_000, encoding: "utf8" });
}

async function captureLinux(png: string, jpg: string): Promise<string> {
  if (process.env.WAYLAND_DISPLAY && (await commandExists("grim"))) {
    await execFileAsync("grim", [png], { timeout: 20_000 });
  } else if (await commandExists("gnome-screenshot")) {
    await execFileAsync("gnome-screenshot", ["-f", png], { timeout: 20_000 });
  } else if (await commandExists("scrot")) {
    await execFileAsync("scrot", ["-o", png], { timeout: 20_000 });
  } else if (await commandExists("import")) {
    await execFileAsync("import", ["-window", "root", png], { timeout: 20_000 });
  } else if (process.env.DISPLAY && (await commandExists("ffmpeg"))) {
    await execFileAsync(
      "ffmpeg",
      ["-y", "-f", "x11grab", "-video_size", "1920x1080", "-i", process.env.DISPLAY, "-frames:v", "1", jpg],
      { timeout: 20_000 },
    );
    return jpg;
  } else {
    throw new Error("有显示器，但没找到 grim、gnome-screenshot、scrot 或 ImageMagick");
  }
  if (await commandExists("convert")) {
    await execFileAsync("convert", [png, "-resize", "1600x1600>", "-quality", "72", jpg], {
      timeout: 20_000,
    });
    return jpg;
  }
  return png;
}

export async function captureDesktop(outDir: string): Promise<ScreenShot> {
  mkdirSync(outDir, { recursive: true });
  const platform = hostKind();
  if (!hasDesktop()) {
    return {
      ok: false,
      platform,
      message: "这台没有显示器，截不了电脑屏幕",
    };
  }
  const stamp = Date.now();
  const jpg = join(outDir, `screen-${stamp}.jpg`);
  const png = join(outDir, `screen-${stamp}.png`);
  try {
    let path = jpg;
    if (process.platform === "win32") await captureWindows(jpg);
    else if (process.platform === "darwin") await captureMac(jpg);
    else if (isTermux()) {
      await captureTermux(png);
      path = existsSync(png) ? png : jpg;
    } else {
      path = await captureLinux(png, jpg);
    }
    if (!existsSync(path) || statSync(path).size < 32) {
      return { ok: false, platform, message: "截屏没有生成图片" };
    }
    return { ok: true, platform, path, message: "已截取电脑屏幕" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, platform, message: msg.replace(/\s+/g, " ").slice(0, 240) || "截屏失败" };
  }
}
