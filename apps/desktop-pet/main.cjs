/**
 * Fengyun Nexus 桌宠 — Electron 主进程
 * 企业级语音管线：可插拔 KWS（auto → sherpa 预留 / System.Speech 兜底）
 */
const { app, BrowserWindow, screen, ipcMain, shell, session } = require("electron");
const { existsSync, readFileSync } = require("node:fs");
const { join, resolve, dirname } = require("node:path");
const { createVoicePipeline } = require("./voice/pipeline.cjs");

function runtimePathFromArgv() {
  const fromEnv = String(process.env.NEXUS_DESKTOP_PET_RUNTIME || "").trim();
  if (fromEnv) return fromEnv;
  const arg = process.argv.find((a) => a.startsWith("--runtime="));
  if (arg) return arg.slice("--runtime=".length);
  return join(__dirname, "..", "..", "data", "desktop-pet-runtime.json");
}

function dataRootFromRuntime(runtimeFile) {
  // .../data/desktop-pet-runtime.json → 仓库根（含 data/）
  return resolve(dirname(runtimeFile), "..");
}

function loadRuntime() {
  const p = runtimePathFromArgv();
  const fallback = {
    enabled: true,
    gatewayUrl: "http://127.0.0.1:8787",
    token: "",
    wakeWords: ["喵璃", "小璃", "Nexus", "风云"],
    aliases: undefined,
    engine: "auto",
    chatId: "desktop-pet",
    userId: "desktop-pet",
  };
  if (!existsSync(p)) return { ...fallback, _runtimePath: p };
  try {
    return { ...fallback, ...JSON.parse(readFileSync(p, "utf8")), _runtimePath: p };
  } catch {
    return { ...fallback, _runtimePath: p };
  }
}

/** @type {import('electron').BrowserWindow | null} */
let win = null;
let currentRuntime = loadRuntime();
/** @type {ReturnType<typeof createVoicePipeline> | null} */
let pipeline = null;

function sendToRenderer(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function ensurePipeline() {
  if (pipeline) return pipeline;
  const rtPath = currentRuntime._runtimePath || runtimePathFromArgv();
  pipeline = createVoicePipeline({
    petDir: __dirname,
    dataRoot: dataRootFromRuntime(rtPath),
    onEvent: (ev) => {
      const type = String(ev.type || "");
      if (type === "status") {
        sendToRenderer("pet-wake-status", {
          ok: Boolean(ev.ok),
          message: String(ev.message || ""),
          engine: ev.engine,
          state: ev.state,
        });
        return;
      }
      if (type === "wake") {
        sendToRenderer("pet-wake", { word: ev.word });
        return;
      }
      if (type === "dictate") {
        sendToRenderer("pet-dictate", { text: ev.text });
        return;
      }
      if (type === "ready" || type === "mode" || type === "state" || type === "metric") {
        sendToRenderer("pet-voice-meta", ev);
      }
    },
  });
  return pipeline;
}

function startVoiceFromRuntime() {
  const p = ensurePipeline();
  p.start({
    wakeWords: currentRuntime.wakeWords || [],
    aliases: currentRuntime.aliases,
    engine: currentRuntime.engine || "auto",
    dictateMs: 15000,
  });
}

function stopVoice() {
  try {
    pipeline?.stop();
  } catch {
    /* ignore */
  }
}

function createWindow() {
  currentRuntime = loadRuntime();
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const w = 300;
  const h = 420;

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    if (
      permission === "media" ||
      permission === "microphone" ||
      permission === "audioCapture" ||
      permission === "mediaKeySystem"
    ) {
      callback(true);
      return;
    }
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return (
      permission === "media" ||
      permission === "microphone" ||
      permission === "audioCapture" ||
      permission === "mediaKeySystem"
    );
  });

  win = new BrowserWindow({
    width: w,
    height: h,
    x: Math.max(0, width - w - 24),
    y: Math.max(0, height - h - 24),
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      autoplayPolicy: "no-user-gesture-required",
    },
  });
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(join(__dirname, "renderer", "index.html"));
  win.webContents.on("did-finish-load", () => {
    if (win) {
      win.webContents.send("pet-runtime", currentRuntime);
      const st = ensurePipeline().getStatus();
      win.webContents.send("pet-voice-meta", { type: "status_snapshot", ...st });
    }
    startVoiceFromRuntime();
  });
  win.on("closed", () => {
    win = null;
    stopVoice();
  });
}

ipcMain.handle("pet-quit", () => {
  stopVoice();
  app.quit();
});

ipcMain.handle("pet-open-external", (_e, url) => {
  if (typeof url === "string" && /^https?:\/\//i.test(url)) {
    void shell.openExternal(url);
  }
});

ipcMain.handle("pet-set-wake-words", (_e, words) => {
  const list = Array.isArray(words) ? words.map(String).filter(Boolean) : [];
  currentRuntime.wakeWords = list.length ? list : currentRuntime.wakeWords;
  ensurePipeline().setWakeWords(currentRuntime.wakeWords, currentRuntime.aliases);
  return { ok: true, ...ensurePipeline().getStatus() };
});

ipcMain.handle("pet-listen-again", () => {
  ensurePipeline().listenAgain();
  return { ok: true };
});

ipcMain.handle("pet-voice-status", () => {
  return { ok: true, ...ensurePipeline().getStatus() };
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  stopVoice();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopVoice();
});
