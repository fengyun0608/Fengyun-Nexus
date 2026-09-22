/**
 * Fengyun Nexus 桌面桌宠 — Electron 主进程
 * 透明置顶无边框窗口，钉在桌面右下角。
 */
const { app, BrowserWindow, screen, ipcMain, shell, session } = require("electron");
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

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
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}

/** @type {import('electron').BrowserWindow | null} */
let win = null;

function createWindow() {
  const runtime = loadRuntime();
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
    if (win) win.webContents.send("pet-runtime", runtime);
  });
}

ipcMain.handle("pet-quit", () => {
  app.quit();
});

ipcMain.handle("pet-open-external", (_e, url) => {
  if (typeof url === "string" && /^https?:\/\//i.test(url)) {
    void shell.openExternal(url);
  }
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
