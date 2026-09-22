/**
 * System.Speech 语法表 KWS（Windows 兜底 / P0 主路径）。
 */
const { existsSync } = require("node:fs");
const { join } = require("node:path");
const { spawn } = require("node:child_process");
const { expandWakeWords } = require("../expand-words.cjs");

const ID = "system-speech";

/**
 * @param {{ petDir: string; onLine: (line: string) => void; onExit: (code: number | null) => void }} opts
 */
function createSystemSpeechKws(opts) {
  const { petDir, onLine, onExit } = opts;
  /** @type {import('node:child_process').ChildProcess | null} */
  let child = null;
  let buf = "";

  function available() {
    return process.platform === "win32" && existsSync(join(petDir, "wake-engine.ps1"));
  }

  function stop() {
    const p = child;
    child = null;
    if (!p) return;
    try {
      p.stdin?.write("STOP\n");
    } catch {
      /* ignore */
    }
    try {
      p.kill();
    } catch {
      /* ignore */
    }
  }

  /**
   * @param {{ wakeWords: string[]; aliases?: Record<string, string[]> }} cfg
   */
  function start(cfg) {
    stop();
    if (!available()) {
      onLine("ERR|System.Speech 仅 Windows 可用，或缺少 wake-engine.ps1");
      return false;
    }
    const script = join(petDir, "wake-engine.ps1");
    const expanded = expandWakeWords(cfg.wakeWords, cfg.aliases, petDir);
    const aliasesJson = JSON.stringify(cfg.aliases || {});
    child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        script,
        "-WordsJson",
        JSON.stringify(expanded),
        "-AliasesJson",
        aliasesJson,
      ],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    const me = child;
    const onChunk = (chunk) => {
      buf += chunk.toString("utf8");
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() || "";
      for (const line of lines) {
        const t = line.trim();
        if (t) onLine(t);
      }
    };
    me.stdout?.on("data", onChunk);
    me.stderr?.on("data", (d) => {
      const tip = String(d || "").trim();
      if (tip) onLine(`ERR|${tip.slice(0, 160)}`);
    });
    me.on("exit", (code) => {
      if (child === me) child = null;
      onExit(code ?? null);
    });
    return true;
  }

  /** @param {string} cmd */
  function write(cmd) {
    if (!child?.stdin) return false;
    try {
      child.stdin.write(cmd.endsWith("\n") ? cmd : `${cmd}\n`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * @param {string[]} words
   * @param {Record<string, string[]> | undefined} aliases
   */
  function setWords(words, aliases) {
    const expanded = expandWakeWords(words, aliases, petDir);
    return write(`WORDS|${JSON.stringify(expanded)}`);
  }

  return {
    id: ID,
    available,
    start,
    stop,
    write,
    setWords,
    enterDictate() {
      return write("DICTATE");
    },
    enterWake() {
      return write("WAKE");
    },
  };
}

module.exports = { createSystemSpeechKws, ID };
