/**
 * 本地听写：录音 → sherpa paraformer（优先）→ System.Speech 文件听写（兜底）。
 * 解决自由 DictationGrammar 把「绥中县天气」听成乱码的问题。
 */
const { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } = require("node:fs");
const { join, dirname } = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { sherpaReadyPath, voiceTmpDir } = require("./paths.cjs");

const execFileAsync = promisify(execFile);

function loadReady(dataRoot) {
  const p = sherpaReadyPath(dataRoot);
  if (!existsSync(p)) return null;
  try {
    const j = JSON.parse(readFileSync(p, "utf8"));
    if (j?.offline && j.asrParaformer && j.asrTokens && existsSync(j.offline) && existsSync(j.asrParaformer)) {
      return j;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * @param {{ petDir: string; outPath: string; seconds: number }} opts
 */
async function recordWav(opts) {
  const script = join(opts.petDir, "voice", "record-wav.ps1");
  if (!existsSync(script)) throw new Error("缺少 record-wav.ps1");
  mkdirSync(dirname(opts.outPath), { recursive: true });
  await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      script,
      "-OutPath",
      opts.outPath,
      "-Seconds",
      String(opts.seconds),
    ],
    {
      windowsHide: true,
      timeout: (opts.seconds + 15) * 1000,
      // UTF-8 path: force console UTF-8 so -File resolves under CJK directories
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    },
  );
  if (!existsSync(opts.outPath)) throw new Error("录音失败");
}

/**
 * @param {{ ready: object; wavPath: string }} opts
 */
async function transcribeSherpa(opts) {
  const { ready, wavPath } = opts;
  const args = [
    `--tokens=${ready.asrTokens}`,
    `--paraformer=${ready.asrParaformer}`,
    "--num-threads=2",
    "--decoding-method=greedy_search",
    wavPath,
  ];
  const { stdout, stderr } = await execFileAsync(ready.offline, args, {
    cwd: ready.binDir || undefined,
    windowsHide: true,
    timeout: 120_000,
    env: {
      ...process.env,
      PATH: `${ready.binDir || ""};${process.env.PATH || ""}`,
    },
    maxBuffer: 4 * 1024 * 1024,
  });
  const raw = `${stdout || ""}\n${stderr || ""}`;
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (/^(OK\||err|error|loading|num_|sample|Elapsed|Rtf|Creating|Started|Done|----)/i.test(line)) {
      continue;
    }
    // sherpa-onnx-offline 新版本输出 JSON：{"text":"..."}
    if (line.startsWith("{") && line.includes("text")) {
      try {
        const j = JSON.parse(line);
        if (j && typeof j.text === "string" && j.text.trim()) return String(j.text).trim();
      } catch {
        /* fall through */
      }
    }
    const m = line.match(/(?:text|result)\s*[=:：]\s*(.+)$/i);
    if (m) return m[1].trim();
    if (/[\u4e00-\u9fff]/.test(line) && line.length < 80 && !line.includes("=")) {
      return line.replace(/^["']|["']$/g, "");
    }
  }
  const last = lines[lines.length - 1] || "";
  if (/[\u4e00-\u9fffa-zA-Z0-9]/.test(last) && last.length < 80) return last;
  return "";
}

/**
 * System.Speech 文件听写（兜底，中文质量差）
 * @param {string} wavPath
 */
async function transcribeSystemSpeech(wavPath) {
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$rec = New-Object System.Speech.Recognition.SpeechRecognitionEngine
try {
  $rec.SetInputToWaveFile($env:NEXUS_STT_IN)
  try { $rec.SetInputToWaveFile($env:NEXUS_STT_IN) } catch {}
  $rec.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
  $r = $rec.Recognize()
  if ($null -eq $r -or -not $r.Text) { throw '没有听出文字' }
  $bytes = [System.Text.Encoding]::UTF8.GetBytes([string]$r.Text)
  [Convert]::ToBase64String($bytes)
} finally { $rec.Dispose() }
`.trim();
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
    {
      windowsHide: true,
      timeout: 90_000,
      env: { ...process.env, NEXUS_STT_IN: wavPath },
    },
  );
  const b64 = String(stdout || "").trim().replace(/\s+/g, "");
  if (!b64) return "";
  return Buffer.from(b64, "base64").toString("utf8").trim();
}

/**
 * @param {{ petDir: string; dataRoot: string; seconds?: number; onStatus?: (msg: string) => void }} opts
 * @returns {Promise<{ text: string; engine: string; message: string }>}
 */
async function recordAndTranscribe(opts) {
  const seconds = Math.min(10, Math.max(3, opts.seconds || 6));
  const dir = voiceTmpDir(opts.dataRoot);
  mkdirSync(dir, { recursive: true });
  const wavPath = join(dir, `dictate-${Date.now()}.wav`);
  opts.onStatus?.(`请说…（约 ${seconds} 秒）`);
  try {
    await recordWav({ petDir: opts.petDir, outPath: wavPath, seconds });
    opts.onStatus?.("正在听写…");
    const ready = loadReady(opts.dataRoot);
    if (!ready) {
      return {
        text: "",
        engine: "none",
        message: "未装中文听写模型。请到「环境配置」重装桌宠后再说（不要用系统听写乱码）",
      };
    }
    try {
      const text = (await transcribeSherpa({ ready, wavPath })).trim();
      if (text) return { text, engine: "sherpa-asr", message: "ok" };
      return { text: "", engine: "sherpa-asr", message: "没听清，请靠近麦克风再说一次" };
    } catch (e) {
      return {
        text: "",
        engine: "sherpa-asr",
        message: `听写失败：${e instanceof Error ? e.message.slice(0, 100) : String(e)}`,
      };
    }
  } finally {
    try {
      if (existsSync(wavPath)) unlinkSync(wavPath);
    } catch {
      /* ignore */
    }
  }
}

module.exports = { recordAndTranscribe, loadReady };
