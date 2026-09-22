/**
 * 企业级桌宠语音管线：可插拔 KWS + 本地录音听写（sherpa ASR 优先）。
 * IdleWake → Listening → IdleWake
 */
const { createSystemSpeechKws } = require("./providers/kws-system-speech.cjs");
const { createSherpaKws } = require("./providers/kws-sherpa.cjs");
const { recordAndTranscribe, loadReady } = require("./dictate-local.cjs");

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
  let dictating = false;
  let cfg = {
    wakeWords: ["喵璃", "小璃", "Nexus", "风云"],
    /** @type {Record<string, string[]> | undefined} */
    aliases: undefined,
    /** @type {'auto' | 'sherpa' | 'system-speech'} */
    engine: /** @type {'auto' | 'sherpa' | 'system-speech'} */ ("auto"),
    dictateMs: 5000,
  };

  const speech = createSystemSpeechKws({
    petDir,
    onLine: handleLine,
    onExit: (code) => {
      if (dictating) return;
      active = null;
      state = "idle_wake";
      emitStatus(false, `呼唤引擎退出 code=${code ?? "?"}`);
    },
  });
  const sherpa = createSherpaKws({
    dataRoot,
    petDir,
    onLine: handleLine,
    onExit: (code) => {
      if (dictating) return;
      if (active?.id === "sherpa" && state === "idle_wake") {
        emitStatus(false, `sherpa 退出 code=${code ?? "?"}`);
      }
    },
  });

  function engineLabel(id) {
    if (id === "sherpa") return "sherpa-onnx";
    if (id === "system-speech") return "System.Speech";
    return String(id);
  }

  function emitStatus(ok, message) {
    onEvent({ type: "status", ok, message, engine: lastEngine, state });
  }

  function handleLine(line) {
    if (!line || dictating) return;
    if (line.startsWith("READY|")) {
      const asr = Boolean(loadReady(dataRoot));
      const tip = asr
        ? `本机呼唤已就绪 · ${engineLabel(lastEngine)} · 中文听写OK`
        : `本机呼唤已就绪 · ${engineLabel(lastEngine)} · 听写模型未装`;
      emitStatus(true, tip);
      onEvent({ type: "ready", engine: lastEngine, asrReady: asr });
      return;
    }
    if (line.startsWith("ERR|")) {
      emitStatus(false, line.slice(4));
      return;
    }
    if (line.startsWith("MODE|")) {
      const mode = line.slice(5);
      if (mode === "dictate") return; // 听写改走录音 ASR
      state = "idle_wake";
      emitStatus(true, "听呼唤中…");
      onEvent({ type: "mode", mode, state });
      return;
    }
    if (line.startsWith("WAKE|")) {
      const word = line.slice(5).trim();
      onEvent({ type: "wake", word });
      onEvent({ type: "metric", name: "wake_hit", value: word });
      void enterDictate(cfg.dictateMs || 8000);
      return;
    }
    if (line.startsWith("TEXT|")) {
      const text = line.slice(5).trim();
      if (text) onEvent({ type: "dictate", text });
    }
  }

  function sherpaRunnable() {
    return typeof sherpa.runnable === "function" ? sherpa.runnable() : sherpa.available();
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

  function startWakeOnly() {
    const preferred = cfg.engine || "auto";
    let runner = pickRunner(preferred);
    let degraded = false;
    if (preferred === "sherpa" && runner && runner.id !== "sherpa") degraded = true;
    if (!runner) {
      lastEngine = "none";
      active = null;
      emitStatus(
        false,
        process.platform === "win32" ? "无可用呼唤引擎" : "呼唤监听仅支持 Windows",
      );
      return;
    }
    lastEngine = runner.id;
    active = runner;
    let ok = runner.start({ wakeWords: cfg.wakeWords, aliases: cfg.aliases });
    if (!ok && runner.id === "sherpa" && speech.available()) {
      runner = speech;
      lastEngine = speech.id;
      active = speech;
      ok = speech.start({ wakeWords: cfg.wakeWords, aliases: cfg.aliases });
      degraded = true;
    }
    if (!ok) {
      active = null;
      lastEngine = "none";
      emitStatus(false, "呼唤引擎启动失败");
      return;
    }
    onEvent({ type: "metric", name: "engine", value: lastEngine });
    if (degraded) emitStatus(true, "已降级 System.Speech 呼唤");
    state = "idle_wake";
  }

  function start(next) {
    stop();
    cfg = {
      wakeWords: next.wakeWords?.length ? next.wakeWords : cfg.wakeWords,
      aliases: next.aliases !== undefined ? next.aliases : cfg.aliases,
      engine: next.engine || cfg.engine || "auto",
      dictateMs: next.dictateMs || cfg.dictateMs || 8000,
    };
    startWakeOnly();
    if (active) {
      emitStatus(true, `正在启动 · ${engineLabel(lastEngine)}`);
    }
  }

  function stop() {
    dictating = false;
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

  /**
   * 停呼唤 → 录音 → sherpa ASR → 恢复呼唤
   * @param {number} ms
   */
  async function enterDictate(ms) {
    if (dictating) return;
    dictating = true;
    state = "listening";
    const seconds = Math.min(8, Math.max(4, Math.round((ms || 5000) / 1000)));
    emitStatus(true, `请说内容…（约 ${seconds} 秒，说完稍等）`);
    onEvent({ type: "mode", mode: "dictate", state });

    try {
      active?.stop();
    } catch {
      /* ignore */
    }
    active = null;

    // 不再播「我在」，避免 TTS 录进听写；短延迟让麦切换稳定
    await new Promise((r) => setTimeout(r, 350));
    if (!dictating) return;

    try {
      const result = await recordAndTranscribe({
        petDir,
        dataRoot,
        seconds,
        onStatus: (msg) => emitStatus(true, msg),
      });
      if (result.text) {
        onEvent({ type: "dictate", text: result.text });
        onEvent({ type: "metric", name: "stt_engine", value: result.engine });
      } else {
        emitStatus(false, result.message || "没听清");
        onEvent({ type: "status", ok: false, message: result.message || "没听清", engine: lastEngine, state });
      }
    } catch (e) {
      emitStatus(false, e instanceof Error ? e.message.slice(0, 120) : String(e));
    } finally {
      dictating = false;
      startWakeOnly();
      if (active) emitStatus(true, "听呼唤中…");
      state = "idle_wake";
      onEvent({ type: "mode", mode: "wake", state });
    }
  }

  function setWakeWords(words, aliases) {
    if (words?.length) cfg.wakeWords = words;
    if (aliases !== undefined) cfg.aliases = aliases;
    if (dictating) return true;
    if (active?.setWords(cfg.wakeWords, cfg.aliases)) return true;
    start(cfg);
    return true;
  }

  function listenAgain() {
    void enterDictate(cfg.dictateMs || 5000);
  }

  function getStatus() {
    const asrReady = Boolean(loadReady(dataRoot));
    return {
      engine: lastEngine,
      preferred: cfg.engine || "auto",
      state,
      wakeWords: [...(cfg.wakeWords || [])],
      sherpaReady: sherpa.available() && sherpaRunnable(),
      asrReady,
      systemSpeechReady: speech.available(),
    };
  }

  return { start, stop, setWakeWords, listenAgain, getStatus };
}

module.exports = { createVoicePipeline };
