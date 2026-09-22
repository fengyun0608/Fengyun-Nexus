/**
 * 企业级桌宠语音管线（P0）：可插拔 KWS + 状态机。
 * IdleWake → Listening；（Thinking / Speaking 预留 P2）
 */
const { createSystemSpeechKws } = require("./providers/kws-system-speech.cjs");
const { createSherpaKws } = require("./providers/kws-sherpa.cjs");

/**
 * @param {{
 *   petDir: string;
 *   dataRoot: string;
 *   onEvent: (ev: Record<string, unknown>) => void;
 * }} opts
 */
function createVoicePipeline(opts) {
  const { petDir, dataRoot, onEvent } = opts;

  /** @type {ReturnType<typeof createSystemSpeechKws> | null} */
  let active = null;
  let state = "idle_wake";
  let lastEngine = "none";
  /** @type {ReturnType<typeof setTimeout> | null} */
  let dictateTimer = null;
  let cfg = {
    wakeWords: ["喵璃", "小璃", "Nexus", "风云"],
    /** @type {Record<string, string[]> | undefined} */
    aliases: undefined,
    /** @type {'auto' | 'sherpa' | 'system-speech'} */
    engine: /** @type {'auto' | 'sherpa' | 'system-speech'} */ ("auto"),
    dictateMs: 15000,
  };

  const speech = createSystemSpeechKws({
    petDir,
    onLine: handleLine,
    onExit: (code) => {
      active = null;
      state = "idle_wake";
      emitStatus(false, `呼唤引擎退出 code=${code ?? "?"}`);
    },
  });
  const sherpa = createSherpaKws({ dataRoot });

  function engineLabel(id) {
    if (id === "sherpa") return "sherpa-onnx";
    if (id === "system-speech") return "System.Speech";
    return String(id);
  }

  function emitStatus(ok, message) {
    onEvent({ type: "status", ok, message, engine: lastEngine, state });
  }

  function handleLine(line) {
    if (!line) return;
    if (line.startsWith("READY|")) {
      emitStatus(true, `本机呼唤已就绪 · ${engineLabel(lastEngine)}`);
      onEvent({ type: "ready", engine: lastEngine });
      return;
    }
    if (line.startsWith("ERR|")) {
      emitStatus(false, line.slice(4));
      return;
    }
    if (line.startsWith("MODE|")) {
      const mode = line.slice(5);
      state = mode === "dictate" ? "listening" : "idle_wake";
      emitStatus(true, mode === "dictate" ? "请说内容…" : "听呼唤中…");
      onEvent({ type: "mode", mode, state });
      return;
    }
    if (line.startsWith("WAKE|")) {
      const word = line.slice(5).trim();
      onEvent({ type: "wake", word });
      onEvent({ type: "metric", name: "wake_hit", value: word });
      enterDictate(cfg.dictateMs || 15000);
      return;
    }
    if (line.startsWith("TEXT|")) {
      const text = line.slice(5).trim();
      if (text) onEvent({ type: "dictate", text });
      return;
    }
  }

  /** P1 真接 sherpa 后改为检测 bin+模型 */
  function sherpaRunnable() {
    return false;
  }

  function pickRunner(pref) {
    if (pref === "system-speech") {
      return speech.available() ? speech : null;
    }
    if (pref === "sherpa") {
      if (sherpa.available() && sherpaRunnable()) return sherpa;
      return speech.available() ? speech : null;
    }
    if (sherpa.available() && sherpaRunnable()) return sherpa;
    return speech.available() ? speech : null;
  }

  function start(next) {
    stop();
    cfg = {
      wakeWords: next.wakeWords?.length ? next.wakeWords : cfg.wakeWords,
      aliases: next.aliases !== undefined ? next.aliases : cfg.aliases,
      engine: next.engine || cfg.engine || "auto",
      dictateMs: next.dictateMs || cfg.dictateMs || 15000,
    };
    const preferred = cfg.engine || "auto";
    let runner = pickRunner(preferred);
    let degraded = false;
    if (preferred === "sherpa" && runner && runner.id !== "sherpa") {
      degraded = true;
    }
    if (preferred === "auto" && (!sherpa.available() || !sherpaRunnable()) && runner) {
      /* normal P0 path */
    }
    if (!runner) {
      lastEngine = "none";
      emitStatus(
        false,
        process.platform === "win32" ? "无可用呼唤引擎" : "呼唤监听仅支持 Windows",
      );
      return;
    }
    lastEngine = runner.id;
    active = runner;
    const ok = runner.start({ wakeWords: cfg.wakeWords, aliases: cfg.aliases });
    if (!ok) {
      active = null;
      lastEngine = "none";
      emitStatus(false, "呼唤引擎启动失败");
      return;
    }
    onEvent({ type: "metric", name: "engine", value: lastEngine });
    if (degraded || (preferred === "sherpa" && lastEngine === "system-speech")) {
      emitStatus(true, "sherpa 未装齐，已降级 System.Speech");
    } else {
      emitStatus(true, `正在启动 · ${engineLabel(lastEngine)}`);
    }
    state = "idle_wake";
  }

  function stop() {
    if (dictateTimer) {
      clearTimeout(dictateTimer);
      dictateTimer = null;
    }
    try {
      active?.stop();
    } catch {
      /* ignore */
    }
    active = null;
    state = "idle_wake";
  }

  function enterDictate(ms) {
    if (!active) return;
    active.enterDictate();
    state = "listening";
    if (dictateTimer) clearTimeout(dictateTimer);
    dictateTimer = setTimeout(() => {
      try {
        active?.enterWake();
      } catch {
        /* ignore */
      }
      state = "idle_wake";
    }, ms);
  }

  function setWakeWords(words, aliases) {
    if (words?.length) cfg.wakeWords = words;
    if (aliases !== undefined) cfg.aliases = aliases;
    if (active?.setWords(cfg.wakeWords, cfg.aliases)) return true;
    start(cfg);
    return true;
  }

  function listenAgain() {
    enterDictate(cfg.dictateMs || 15000);
  }

  function getStatus() {
    return {
      engine: lastEngine,
      preferred: cfg.engine || "auto",
      state,
      wakeWords: [...(cfg.wakeWords || [])],
      sherpaReady: sherpa.available() && sherpaRunnable(),
      systemSpeechReady: speech.available(),
    };
  }

  return { start, stop, setWakeWords, listenAgain, getStatus };
}

module.exports = { createVoicePipeline };
