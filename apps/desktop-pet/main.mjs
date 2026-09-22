/**
 * Fengyun Nexus 桌面桌宠 — Electron 主进程
 * 透明置顶无边框窗口，钉在桌面右下角。
 */
import { app, BrowserWindow, screen, ipcMain, shell } from "electron";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function runtimePathFromArgv(): string {
  const fromEnv = String(process.env.NEXUS_DESKTOP_PET_RUNTIME || "").trim();
  if (fromEnv) return fromEnv;
  const arg = process.argv.find((a) => a.startsWith("--runtime="));
  if (arg) return arg.slice("--runtime=".length);
  return join(__dirname, "..", "..", "data", "desktop-pet-runtime.json");
}

function loadRuntime() {
  const p = runtimePathFromArgv();
  if (!existsSync(p)) {
    return {
      enabled: true,
      gatewayUrl: "http://127.0.0.1:8787",
      token: "",
      wakeWords: ["喵璃", "小璃", "Nexus", "风云"],
      chatId: "desktop-pet",
      userId: "desktop-pet",
    };
  }
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return {
      enabled: true,
      gatewayUrl: "http://127.0.0.1:8787",
      token: "",
      wakeWords: ["喵璃", "小璃", "Nexus", "风云"],
      chatId: "desktop-pet",
      userId: "desktop-pet",
    };
  }
}

let win = null;

function createWindow() {
  const runtime = loadRuntime();
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const w = 300;
  const h = 420;
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
    },
  });
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(join(__dirname, "renderer", "index.html"));
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("pet-runtime", runtime);
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
