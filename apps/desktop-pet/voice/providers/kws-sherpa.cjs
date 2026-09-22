/**
 * sherpa-onnx 麦克风关键词点检（Windows）。
 * 唤醒用 sherpa；听写窗口临时切 System.Speech（避免双开抢麦）。
 */
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { spawn } = require("node:child_process");
const { expandWakeWords } = require("../expand-words.cjs");
const { buildKeywordsFile } = require("../ppinyin.cjs");
const { createSystemSpeechKws } = require("./kws-system-speech.cjs");
const { sherpaDir } = require("../paths.cjs");

const ID = "sherpa";

/**
 * @param {{ dataRoot: string; petDir: string; onLine: (line: string) => void; onExit: (code: number | null) => void }} opts
 */
function createSherpaKws(opts) {
  const { dataRoot, petDir, onLine, onExit } = opts;
  const base = sherpaDir(dataRoot);
  const readyJson = join(base, "ready.json");
  const readyMarker = join(base, "ready");

  /** @type {import('node:child_process').ChildProcess | null} */
  let child = null;
  let buf = "";
  let mode = "wake";
  /** @type {{ wakeWords: string[]; aliases?: Record<string, string[]> }} */
  let cfg = { wakeWords: [] };
  /** @type {ReturnType<typeof createSystemSpeechKws> | null} */
  let speech = null;

  function loadReady() {
    const p = existsSync(readyJson) ? readyJson : null;
    if (!p) return null;
    try {
      const j = JSON.parse(readFileSync(p, "utf8"));
      if (
        j?.microphone &&
        j.encoder &&
        j.decoder &&
        j.joiner &&
        j.tokens &&
        existsSync(j.microphone) &&
        existsSync(j.encoder) &&
        existsSync(j.tokens)
      ) {
        return j;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  function available() {
    return Boolean(loadReady()) || existsSync(readyMarker);
  }

  function runnable() {
    return Boolean(loadReady());
  }

  function keywordsPath() {
    mkdirSync(base, { recursive: true });
    return join(base, "keywords.txt");
  }

  function writeKeywords(words, aliases) {
    const expanded = expandWakeWords(words, aliases, petDir);
    const body = buildKeywordsFile(expanded);
    writeFileSync(keywordsPath(), body, "utf8");
    return expanded;
  }

  function stopSherpaOnly() {
    const p = child;
    child = null;
    if (!p) return;
    try {
      p.kill();
    } catch {
      /* ignore */
    }
  }

  function stopSpeechOnly() {
    try {
      speech?.stop();
    } catch {
      /* ignore */
    }
    speech = null;
  }

  function stop() {
    stopSpeechOnly();
    stopSherpaOnly();
  }

  function ensureSpeech() {
    if (speech) return speech;
    speech = createSystemSpeechKws({
      petDir,
      onLine: (line) => {
        if (mode !== "dictate") return;
        onLine(line);
      },
      onExit: () => {
        /* dictate child exit — ignore if we planned stop */
      },
    });
    return speech;
  }

  function parseSherpaLine(raw) {
    const line = String(raw || "").trim();
    if (!line) return;
    // 常见输出：Detected: 喵璃 / {"keyword":"喵璃"...} / keyword=喵璃
    let word = "";
    const m1 = line.match(/Detected[:\s]+([^\s,{]+)/i);
    if (m1) word = m1[1];
    if (!word) {
      const m2 = line.match(/"keyword"\s*:\s*"([^"]+)"/);
      if (m2) word = m2[1];
    }
    if (!word) {
      const m3 = line.match(/@([^\s]+)/);
      if (m3) word = m3[1].replace(/_/g, "");
    }
    if (!word && /[\u4e00-\u9fff]/.test(line) && line.length < 24) {
      word = line.replace(/^.*[:：]\s*/, "").trim();
    }
    if (word && mode === "wake") {
      onLine(`WAKE|${word}`);
    }
  }

  function startSherpaWake() {
    stopSherpaOnly();
    const ready = loadReady();
    if (!ready) {
      onLine("ERR|sherpa 未安装完整（缺 ready.json）");
      return false;
    }
    writeKeywords(cfg.wakeWords, cfg.aliases);
    const kw = keywordsPath();
    const args = [
      `--tokens=${ready.tokens}`,
      `--encoder=${ready.encoder}`,
      `--decoder=${ready.decoder}`,
      `--joiner=${ready.joiner}`,
      `--keywords-file=${kw}`,
      "--num-threads=2",
      "--provider=cpu",
    ];
    const env = {
      ...process.env,
      PATH: `${ready.binDir};${process.env.PATH || ""}`,
    };
    child = spawn(ready.microphone, args, {
      cwd: ready.binDir,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env,
    });
    const me = child;
    const onChunk = (chunk) => {
      buf += chunk.toString("utf8");
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() || "";
      for (const line of lines) parseSherpaLine(line);
    };
    me.stdout?.on("data", onChunk);
    me.stderr?.on("data", onChunk);
    me.on("exit", (code) => {
      if (child === me) child = null;
      if (mode === "wake") onExit(code ?? null);
    });
    mode = "wake";
    onLine("MODE|wake");
    onLine("READY|wake");
    return true;
  }

  /**
   * @param {{ wakeWords: string[]; aliases?: Record<string, string[]> }} next
   */
  function start(next) {
    stop();
    cfg = {
      wakeWords: next.wakeWords || [],
      aliases: next.aliases,
    };
    if (!runnable()) {
      onLine("ERR|sherpa 运行时未就绪");
      return false;
    }
    return startSherpaWake();
  }

  function enterDictate() {
    mode = "dictate";
    stopSherpaOnly();
    onLine("MODE|dictate");
    const s = ensureSpeech();
    s.start({ wakeWords: cfg.wakeWords, aliases: cfg.aliases });
    s.enterDictate();
    return true;
  }

  function enterWake() {
    stopSpeechOnly();
    mode = "wake";
    return startSherpaWake();
  }

  function setWords(words, aliases) {
    cfg.wakeWords = words?.length ? words : cfg.wakeWords;
    if (aliases !== undefined) cfg.aliases = aliases;
    writeKeywords(cfg.wakeWords, cfg.aliases);
    if (mode === "wake" && child) {
      // 麦克风进程一般需重启才能换 keywords
      return startSherpaWake();
    }
    if (mode === "dictate" && speech) {
      return speech.setWords(cfg.wakeWords, cfg.aliases);
    }
    return true;
  }

  function write() {
    return false;
  }

  return {
    id: ID,
    available,
    runnable,
    start,
    stop,
    write,
    setWords,
    enterDictate,
    enterWake,
  };
}

module.exports = { createSherpaKws, ID };
