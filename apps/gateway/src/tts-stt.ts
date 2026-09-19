/**
 * 本机语音：文字转语音气泡文件；语音文件尽量听写成文字。
 * Windows 优先 System.Speech；没有引擎就老实报失败，不编结果。
 */
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function psEncoded(script: string): string {
  return Buffer.from(script, "utf16le").toString("base64");
}

function mediaDir(root: string): string {
  const dir = join(root, "data", "agent-media");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** 文字 → wav。成功返回本地路径。 */
export async function textToSpeechFile(
  root: string,
  text: string,
): Promise<{ ok: boolean; path?: string; message: string }> {
  const say = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
  if (!say) return { ok: false, message: "没有可朗读的文字" };
  if (process.platform !== "win32") {
    return { ok: false, message: "当前只在 Windows 上合成语音" };
  }
  const out = join(mediaDir(root), `tts-${Date.now()}.wav`);
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $s.Rate = 0
  $s.SetOutputToWaveFile($env:NEXUS_TTS_OUT)
  $s.Speak([string]$env:NEXUS_TTS_TEXT)
} finally {
  $s.Dispose()
}
`.trim();
  try {
    await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-EncodedCommand", psEncoded(script)],
      {
        timeout: 60_000,
        windowsHide: true,
        encoding: "utf8",
        env: { ...process.env, NEXUS_TTS_OUT: out, NEXUS_TTS_TEXT: say },
      },
    );
    if (!existsSync(out)) return { ok: false, message: "语音文件没有生成" };
    return { ok: true, path: out, message: "已合成语音" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message.slice(0, 160) : String(e) };
  }
}

/** 本地音频 → 文字。听写失败时返回 ok:false，由上层决定怎么说。 */
export async function speechFileToText(
  filePath: string,
): Promise<{ ok: boolean; text?: string; message: string }> {
  const path = String(filePath || "").trim();
  if (!path || !existsSync(path)) return { ok: false, message: "语音文件不存在" };
  if (process.platform !== "win32") {
    return { ok: false, message: "当前只在 Windows 上听写语音" };
  }
  if (!/\.(wav|wave)$/i.test(path)) {
    return { ok: false, message: "暂只听写 wav；请先发文字，或等转码就绪" };
  }
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$rec = New-Object System.Speech.Recognition.SpeechRecognitionEngine
try {
  $rec.SetInputToWaveFile($env:NEXUS_STT_IN)
  $rec.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
  $r = $rec.Recognize()
  if ($null -eq $r -or -not $r.Text) { throw '没有听出文字' }
  $bytes = [System.Text.Encoding]::UTF8.GetBytes([string]$r.Text)
  [Convert]::ToBase64String($bytes)
} finally {
  $rec.Dispose()
}
`.trim();
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-EncodedCommand", psEncoded(script)],
      {
        timeout: 90_000,
        windowsHide: true,
        encoding: "utf8",
        env: { ...process.env, NEXUS_STT_IN: path },
      },
    );
    const b64 = String(stdout || "").trim().replace(/\s+/g, "");
    if (!b64) return { ok: false, message: "没有听出文字" };
    const text = Buffer.from(b64, "base64").toString("utf8").trim();
    if (!text) return { ok: false, message: "没有听出文字" };
    return { ok: true, text, message: "已听写" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message.slice(0, 160) : String(e) };
  }
}

export function writeAgentBytes(root: string, name: string, buf: Buffer): string {
  const safe = name.replace(/[^\w.-]+/g, "_").slice(0, 80) || "bin";
  const path = join(mediaDir(root), `${Date.now()}-${safe}`);
  writeFileSync(path, buf);
  return path;
}
