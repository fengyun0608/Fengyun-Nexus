/**
 * Fengyun Nexus 桌宠 — Electron 主进程
 * 系统麦克风 + System.Speech 呼唤词语法表持续监听（不走网页在线听写）。
 */
const { app, BrowserWindow, screen, ipcMain, shell, session } = require("electron");
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { spawn } = require("node:child_process");

function runtimePathFromArgv() {
  const fromEnv = String(process.env.NEXUS_DESKTOP_PET_RUNTIME || "").trim();
  if (fromEnv) return fromEnv;
  const arg = process.argv.find((a) => a.startsWith("--runtime="));
  if (arg) return arg.slice("--runtime=".length);
  return join(__dirname, "..", "..", "data", "desktop-pet-runtime.json");
}

function loadRuntime() {
  const p = runtimePathFromArgv();
  const fallback = {
    enabled: true,
    gatewayUrl: "http://127.0.0.1:8787",
    token: "",
    wakeWords: ["喵璃", "小璃", "Nexus", "风云"],
    chatId: "desktop-pet",
    userId: "desktop-pet",
  };
  if (!existsSync(p)) return fallback;
  try {
    return { ...fallback, ...JSON.parse(readFileSync(p, "utf8")) };
  } catch {
    return fallback;
  }
}

/** @type {import('electron').BrowserWindow | null} */
let win = null;
/** @type {import('node:child_process').ChildProcess | null} */
let wakeProc = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let dictateTimer = null;
let currentRuntime = loadRuntime();

function sendToRenderer(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function stopWakeEngine() {
  if (dictateTimer) {
    clearTimeout(dictateTimer);
    dictateTimer = null;
  }
  const p = wakeProc;
  wakeProc = null;
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

function startWakeEngine(words) {
  stopWakeEngine();
  if (process.platform !== "win32") {
    sendToRenderer("pet-wake-status", { ok: false, message: "呼唤监听仅支持 Windows" });
    return;
  }
  const script = join(__dirname, "wake-engine.ps1");
  if (!existsSync(script)) {
    sendToRenderer("pet-wake-status", { ok: false, message: "缺少 wake-engine.ps1" });
    return;
  }
  const list = Array.isArray(words) && words.length ? words.map(String) : ["喵璃", "小璃", "Nexus", "风云"];
  const child = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      script,
      "-WordsJson",
      JSON.stringify(list),
    ],
    {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  wakeProc = child;
  let buf = "";
  const onChunk = (chunk) => {
    buf += chunk.toString("utf8");
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() || "";
    for (const line of lines) handleWakeLine(line.trim());
  };
  child.stdout?.on("data", onChunk);
  child.stderr?.on("data", (d) => {
    const tip = String(d || "").trim();
    if (tip) sendToRenderer("pet-wake-status", { ok: false, message: tip.slice(0, 120) });
  });
  child.on("exit", (code) => {
    if (wakeProc === child) wakeProc = null;
    sendToRenderer("pet-wake-status", {
      ok: false,
      message: `呼唤引擎退出 code=${code ?? "?"}`,
    });
  });
  sendToRenderer("pet-wake-status", { ok: true, message: "正在启动本机呼唤引擎…" });
}

function handleWakeLine(line) {
  if (!line) return;
  if (line.startsWith("READY|")) {
    sendToRenderer("pet-wake-status", { ok: true, message: "本机呼唤已就绪，直接喊名字" });
    return;
  }
  if (line.startsWith("ERR|")) {
    sendToRenderer("pet-wake-status", { ok: false, message: line.slice(4) });
    return;
  }
  if (line.startsWith("MODE|")) {
    sendToRenderer("pet-wake-status", {
      ok: true,
      message: line.slice(5) === "dictate" ? "请说内容…" : "听呼唤中…",
      mode: line.slice(5),
    });
    return;
  }
  if (line.startsWith("WAKE|")) {
    const word = line.slice(5).trim();
    sendToRenderer("pet-wake", { word });
    enterDictate(15000);
    return;
  }
  if (line.startsWith("TEXT|")) {
    const text = line.slice(5).trim();
    if (text) sendToRenderer("pet-dictate", { text });
    return;
  }
}

function enterDictate(ms) {
  if (!wakeProc?.stdin) return;
  try {
    wakeProc.stdin.write("DICTATE\n");
  } catch {
    /* ignore */
  }
  if (dictateTimer) clearTimeout(dictateTimer);
  dictateTimer = setTimeout(() => {
    try {
      wakeProc?.stdin?.write("WAKE\n");
    } catch {
      /* ignore */
    }
  }, ms);
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
    if (win) win.webContents.send("pet-runtime", currentRuntime);
    startWakeEngine(currentRuntime.wakeWords || []);
  });
  win.on("closed", () => {
    win = null;
    stopWakeEngine();
  });
}

ipcMain.handle("pet-quit", () => {
  stopWakeEngine();
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
  if (wakeProc?.stdin) {
    try {
      wakeProc.stdin.write(`WORDS|${JSON.stringify(currentRuntime.wakeWords)}\n`);
      return { ok: true };
    } catch {
      /* restart */
    }
  }
  startWakeEngine(currentRuntime.wakeWords);
  return { ok: true };
});

ipcMain.handle("pet-listen-again", () => {
  enterDictate(15000);
  return { ok: true };
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  stopWakeEngine();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopWakeEngine();
});
