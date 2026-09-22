/**
 * Go / Python / browser / NapCat / desktop-pet install queue.
 * 通道类（NapCat、桌宠）不进一键排队，需手动点安装。
 */
import { spawn, execSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import {
  installNapCat,
  readNapCatMarker,
  resolveFlavor,
  type NapCatFlavor,
} from "./napcat-setup.js";
import { installSherpaVoice } from "./desktop-pet-voice-setup.js";

const requireFrom = createRequire(import.meta.url);

export type EnvRuntimeId = "go" | "python" | "browser" | "napcat" | "desktop-pet";
export type EnvTaskStatus = "pending" | "running" | "paused" | "done" | "failed" | "cancelled";

export type EnvRuntimeDef = {
  id: EnvRuntimeId;
  label: string;
  versions: string[];
  modes: Array<"compile" | "binary">;
  installed?: boolean;
  activeVersion?: string;
  hint?: string;
  /** false 时前端只展示，不允许点安装 */
  deployable?: boolean;
  unavailableReason?: string;
};

export type EnvTask = {
  id: string;
  runtime: EnvRuntimeId;
  version: string;
  mode: "compile" | "binary";
  status: EnvTaskStatus;
  progress: number;
  logs: string[];
  createdAt: string;
  updatedAt: string;
  note?: string;
  error?: string;
};

const runtimes: EnvRuntimeDef[] = [
  {
    id: "go",
    label: "Go",
    versions: ["1.22.5", "1.21.12", "1.20.14"],
    modes: ["compile", "binary"],
    installed: false,
  },
  {
    id: "python",
    label: "Python",
    versions: ["3.12.4", "3.11.9", "3.10.14"],
    modes: ["compile", "binary"],
    installed: false,
  },
  {
    id: "browser",
    label: "浏览器运行时",
    versions: ["chromium", "firefox"],
    modes: ["binary"],
    installed: false,
  },
  {
    id: "napcat",
    label: "NapCat（QQ）",
    versions: ["auto", "shell", "linux", "termux", "docker"],
    modes: ["binary"],
    installed: false,
    hint: "一键装适配器，扫码后自动连 Nexus",
  },
  {
    id: "desktop-pet",
    label: "桌宠（消息通道）",
    versions: ["electron", "electron+sherpa"],
    modes: ["binary"],
    installed: false,
    hint: "本机桌面猫娘通道：Electron + 可选 sherpa 本机呼唤；仅电脑端可部署",
  },
];

/** 安装完成后把反向 WS 地址注入 NapCat；由网关注入 */
let napcatWire:
  | (() => { reverseWsUrl: string; token: string })
  | null = null;
let napcatAfterInstall: (() => void) | null = null;

export function setNapCatWireProvider(
  fn: () => { reverseWsUrl: string; token: string },
): void {
  napcatWire = fn;
}

export function setNapCatAfterInstall(fn: () => void): void {
  napcatAfterInstall = fn;
}

const tasks: EnvTask[] = [];
let seq = 1;
let rootDir = process.cwd();
let nexusEnvId = String(process.env.NEXUS_ENV || "desktop").toLowerCase();
let workerBusy = false;
let kickTimer: ReturnType<typeof setTimeout> | null = null;
/** Print install lines to the backend terminal (not only web). */
let consoleSink: ((line: string) => void) | null = null;
const taskAborts = new Map<string, AbortController>();
const taskChildren = new Map<string, ChildProcess>();

function now() {
  return new Date().toISOString();
}

function stamp() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function which(bin: string): string | null {
  try {
    const out = execSync(process.platform === "win32" ? `where ${bin}` : `command -v ${bin}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 8_000,
      windowsHide: true,
    })
      .trim()
      .split(/\r?\n/)[0];
    if (!out) return null;
    if (process.platform === "win32" && /WindowsApps/i.test(out)) return null;
    return out;
  } catch {
    return null;
  }
}

function isTermux(): boolean {
  return Boolean(
    process.env.TERMUX_VERSION ||
      process.env.PREFIX?.includes("com.termux") ||
      process.env.NEXUS_FORCE_TERMUX === "1",
  );
}

function runtimeHome(id: EnvRuntimeId): string {
  return join(rootDir, "data", "runtimes", id);
}

function markerPath(id: EnvRuntimeId): string {
  return join(runtimeHome(id), "installed.json");
}

function refreshInstalledFlags(): void {
  for (const rt of runtimes) {
    const marker = markerPath(rt.id);
    if (existsSync(marker)) {
      try {
        const j = JSON.parse(readFileSync(marker, "utf8")) as { version?: string };
        rt.installed = true;
        rt.activeVersion = j.version || rt.activeVersion;
        continue;
      } catch {
        /* fall through */
      }
    }
    if (rt.id === "go" && which("go")) {
      rt.installed = true;
      try {
        rt.activeVersion = execSync("go version", {
          encoding: "utf8",
          timeout: 8_000,
          windowsHide: true,
        })
          .trim()
          .slice(0, 40);
      } catch {
        rt.activeVersion = "system";
      }
      continue;
    }
    if (rt.id === "python" && (which("python3") || which("python"))) {
      rt.installed = true;
      const py = which("python3") || which("python")!;
      try {
        rt.activeVersion = execSync(`"${py}" --version`, {
          encoding: "utf8",
          timeout: 8_000,
          windowsHide: true,
        }).trim();
      } catch {
        rt.activeVersion = "system";
      }
      continue;
    }
    if (rt.id === "browser") {
      const chrome =
        which("chromium") ||
        which("chromium-browser") ||
        which("google-chrome") ||
        process.env.NEXUS_BROWSER_BIN;
      if (chrome || existsSync(join(runtimeHome("browser"), "ready"))) {
        rt.installed = true;
        rt.activeVersion = rt.activeVersion || "chromium";
      }
      continue;
    }
    if (rt.id === "napcat") {
      const m = readNapCatMarker(rootDir);
      if (m) {
        rt.installed = true;
        rt.activeVersion = m.version || m.flavor || "installed";
      }
      continue;
    }
    if (rt.id === "desktop-pet") {
      const marker = markerPath("desktop-pet");
      if (existsSync(marker)) {
        try {
          const j = JSON.parse(readFileSync(marker, "utf8")) as { version?: string };
          rt.installed = true;
          rt.activeVersion = j.version || "electron";
          continue;
        } catch {
          /* fall through */
        }
      }
      const electronOk = resolveDesktopPetElectron(rootDir);
      if (electronOk) {
        rt.installed = true;
        rt.activeVersion = "electron";
      }
    }
  }
}

function resolveDesktopPetElectron(root: string): string | null {
  try {
    const petPkg = join(root, "apps", "desktop-pet", "package.json");
    if (!existsSync(petPkg)) return null;
    const req = createRequire(petPkg);
    const bin = req("electron") as string;
    if (bin && existsSync(bin)) return bin;
  } catch {
    /* ignore */
  }
  try {
    const bin = requireFrom("electron") as string;
    if (bin && existsSync(bin)) return bin;
  } catch {
    /* ignore */
  }
  return null;
}

export function isDesktopPetDeployable(envId?: string): boolean {
  const id = String(envId || nexusEnvId || process.env.NEXUS_ENV || "desktop")
    .trim()
    .toLowerCase();
  return id === "desktop";
}

export function desktopPetUnavailableReason(envId?: string): string {
  if (isDesktopPetDeployable(envId)) return "";
  return "当前环境无法部署";
}

function applyDesktopPetDeployGate(): void {
  const rt = runtimes.find((r) => r.id === "desktop-pet");
  if (!rt) return;
  const ok = isDesktopPetDeployable();
  rt.deployable = ok;
  rt.unavailableReason = ok ? "" : "当前环境无法部署";
  if (!ok) {
    rt.hint = "桌宠仅支持电脑端部署；当前环境只展示，不能安装或启用";
  } else {
    rt.hint =
      "本机桌面猫娘通道，需下载 Electron；装完到「消息通道 → 桌面桌宠」开关启用";
  }
}

export function initEnvTasks(
  root: string,
  opts?: { onLog?: (line: string) => void; envId?: string },
): void {
  rootDir = root;
  if (opts?.envId) nexusEnvId = String(opts.envId).trim().toLowerCase() || nexusEnvId;
  consoleSink = opts?.onLog ?? null;
  mkdirSync(join(rootDir, "data", "runtimes"), { recursive: true });
  refreshInstalledFlags();
  applyDesktopPetDeployGate();
  kickWorker();
}

export function listRuntimes(): EnvRuntimeDef[] {
  refreshInstalledFlags();
  applyDesktopPetDeployGate();
  return runtimes.map((r) => ({ ...r }));
}

export function listTasks(): EnvTask[] {
  return [...tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getTask(id: string): EnvTask | null {
  const t = tasks.find((x) => x.id === id);
  return t ? { ...t, logs: [...t.logs] } : null;
}

function appendLog(task: EnvTask, line: string): void {
  const row = `[${stamp()}] ${line}`;
  task.logs.push(row);
  if (task.logs.length > 800) task.logs.splice(0, task.logs.length - 800);
  task.updatedAt = now();
  consoleSink?.(`[环境/${task.runtime}] ${line}`);
  try {
    const logFile = join(runtimeHome(task.runtime), "install.log");
    mkdirSync(runtimeHome(task.runtime), { recursive: true });
    appendFileSync(logFile, `${row}\n`, "utf8");
  } catch {
    /* ignore */
  }
}

function setProgress(task: EnvTask, n: number): void {
  task.progress = Math.max(0, Math.min(100, Math.round(n)));
  task.updatedAt = now();
}

export function createInstallTask(input: {
  runtime: EnvRuntimeId;
  version?: string;
  mode?: "compile" | "binary";
  auto?: boolean;
}): EnvTask {
  const rt = runtimes.find((r) => r.id === input.runtime);
  if (!rt) throw new Error("未知运行时");
  applyDesktopPetDeployGate();
  if (rt.id === "desktop-pet" && rt.deployable === false) {
    throw new Error(rt.unavailableReason || "当前环境无法部署");
  }
  const version = input.version || rt.versions[0]!;
  const mode = input.mode || (rt.modes.includes("binary") ? "binary" : rt.modes[0]!)!;
  if (!rt.versions.includes(version) && !rt.versions.some((v) => version.startsWith(v))) {
    // allow chromium alias / napcat flavors
    if (
      !(rt.id === "browser" && (version === "chromium" || version === "firefox")) &&
      !(rt.id === "napcat") &&
      !(rt.id === "desktop-pet")
    ) {
      throw new Error("版本不可用");
    }
  }
  if (!rt.modes.includes(mode)) throw new Error("安装方式不可用");

  const existing = tasks.find(
    (t) =>
      t.runtime === input.runtime &&
      (t.status === "pending" || t.status === "running" || t.status === "paused"),
  );
  if (existing) return { ...existing, logs: [...existing.logs] };

  const task: EnvTask = {
    id: `envtask-${seq++}`,
    runtime: input.runtime,
    version,
    mode,
    status: "pending",
    progress: 0,
    logs: [],
    createdAt: now(),
    updatedAt: now(),
    note: `${rt.label} ${version} · ${mode === "compile" ? "编译安装" : "二进制安装"}${input.auto ? " · 自动排队" : ""}`,
  };
  appendLog(task, `已加入队列：${task.note}`);
  tasks.unshift(task);
  kickWorker();
  return { ...task, logs: [...task.logs] };
}

/** 注释：仅控制台「一键排队缺失项」调用；开机不再自动装。NapCat 仍跳过，需单独点装。 */
export function autoQueueMissing(): { queued: EnvTask[]; skipped: string[] } {
  refreshInstalledFlags();
  const queued: EnvTask[] = [];
  const skipped: string[] = [];
  for (const rt of runtimes) {
    if (rt.id === "napcat" || rt.id === "desktop-pet") {
      skipped.push(rt.id);
      continue;
    }
    if (rt.installed) {
      skipped.push(rt.id);
      continue;
    }
    const t = createInstallTask({
      runtime: rt.id,
      version: rt.versions[0],
      mode: rt.modes.includes("binary") ? "binary" : "compile",
      auto: true,
    });
    queued.push(t);
  }
  kickWorker();
  return { queued, skipped };
}

export function setTaskStatus(id: string, status: EnvTaskStatus): EnvTask | null {
  const t = tasks.find((x) => x.id === id);
  if (!t) return null;
  if (status === "cancelled") {
    abortTaskProcess(t);
    t.status = "cancelled";
    t.updatedAt = now();
    appendLog(t, "已取消");
    workerBusy = false;
    kickWorker();
    return { ...t, logs: [...t.logs] };
  }
  t.status = status;
  t.updatedAt = now();
  appendLog(t, `状态 → ${status}`);
  if (status === "done") {
    markInstalled(t);
    setProgress(t, 100);
  }
  if (status === "pending" || status === "running") kickWorker();
  return { ...t, logs: [...t.logs] };
}

/** 取消进行中的下载/子进程 */
function abortTaskProcess(task: EnvTask): void {
  const ac = taskAborts.get(task.id);
  if (ac && !ac.signal.aborted) ac.abort();
  const child = taskChildren.get(task.id);
  if (child && !child.killed) {
    try {
      child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  taskAborts.delete(task.id);
  taskChildren.delete(task.id);
}

/**
 * 删除任务：队列中直接移除；安装中先中止再移除；完成/失败也可清掉。
 */
export function removeTask(id: string): { ok: boolean; message: string } {
  const idx = tasks.findIndex((x) => x.id === id);
  if (idx < 0) return { ok: false, message: "任务未找到" };
  const t = tasks[idx]!;
  const wasRunning = t.status === "running";
  if (t.status === "pending" || t.status === "running" || t.status === "paused") {
    abortTaskProcess(t);
    appendLog(t, "已取消并删除");
  }
  tasks.splice(idx, 1);
  if (wasRunning) {
    workerBusy = false;
    kickWorker();
  }
  return { ok: true, message: "已删除" };
}

function markInstalled(task: EnvTask): void {
  const rt = runtimes.find((r) => r.id === task.runtime);
  if (!rt) return;
  rt.installed = true;
  rt.activeVersion = task.version;
  mkdirSync(runtimeHome(task.runtime), { recursive: true });
  writeFileSync(
    markerPath(task.runtime),
    `${JSON.stringify({ version: task.version, mode: task.mode, at: now() }, null, 2)}\n`,
    "utf8",
  );
  if (task.runtime === "browser") {
    writeFileSync(join(runtimeHome("browser"), "ready"), `${now()}\n`, "utf8");
  }
}

export function taskCounts() {
  const all = listTasks();
  return {
    pending: all.filter((t) => t.status === "pending").length,
    running: all.filter((t) => t.status === "running").length,
    paused: all.filter((t) => t.status === "paused").length,
    done: all.filter((t) => t.status === "done").length,
    failed: all.filter((t) => t.status === "failed").length,
    cancelled: all.filter((t) => t.status === "cancelled").length,
  };
}

function kickWorker(): void {
  if (kickTimer) clearTimeout(kickTimer);
  kickTimer = setTimeout(() => {
    void runWorker();
  }, 200);
}

async function runWorker(): Promise<void> {
  if (workerBusy) return;
  if (tasks.some((t) => t.status === "running")) return;
  const next = [...tasks].reverse().find((t) => t.status === "pending");
  if (!next) return;

  workerBusy = true;
  next.status = "running";
  setProgress(next, 2);
  appendLog(next, "开始安装…");
  const ac = new AbortController();
  taskAborts.set(next.id, ac);

  try {
    await executeInstall(next, ac.signal);
    if (!tasks.includes(next)) return;
    if (ac.signal.aborted || (next.status as EnvTaskStatus) === "cancelled") {
      next.status = "cancelled";
      appendLog(next, "已取消");
      return;
    }
    if ((next.status as EnvTaskStatus) === "paused") {
      appendLog(next, "已暂停");
    } else {
      next.status = "done";
      setProgress(next, 100);
      markInstalled(next);
      appendLog(next, "安装完成");
    }
  } catch (e) {
    if (!tasks.includes(next)) return;
    if (ac.signal.aborted || (next.status as EnvTaskStatus) === "cancelled") {
      next.status = "cancelled";
      appendLog(next, "已取消");
      return;
    }
    next.status = "failed";
    next.error = e instanceof Error ? e.message : String(e);
    appendLog(next, `失败：${next.error}`);
  } finally {
    taskAborts.delete(next.id);
    taskChildren.delete(next.id);
    workerBusy = false;
    if (tasks.includes(next)) next.updatedAt = now();
    kickWorker();
  }
}

function runCmd(
  task: EnvTask,
  command: string,
  args: string[],
  opts?: { cwd?: string; env?: NodeJS.ProcessEnv },
): Promise<number> {
  return new Promise((resolve, reject) => {
    appendLog(task, `$ ${command} ${args.join(" ")}`);
    const win = process.platform === "win32";
    // Windows：不要手写 "path" 再塞进 cmd /c（会双重转义成 \"…\"，带空格路径直接炸）。
    // .cmd/.bat 走 shell；.exe 用参数数组直调。
    const isBatch = win && /\.(cmd|bat)$/i.test(command);
    const child = spawn(command, args, {
      cwd: opts?.cwd || rootDir,
      env: { ...process.env, ...opts?.env },
      windowsHide: true,
      shell: isBatch,
    });
    taskChildren.set(task.id, child);
    const onAbort = () => {
      try {
        child.kill("SIGTERM");
      } catch {
        /* ignore */
      }
    };
    const ac = taskAborts.get(task.id);
    ac?.signal.addEventListener("abort", onAbort, { once: true });
    child.stdout?.on("data", (buf: Buffer) => {
      for (const line of buf.toString("utf8").split(/\r?\n/)) {
        if (line.trim()) appendLog(task, line);
      }
    });
    child.stderr?.on("data", (buf: Buffer) => {
      for (const line of buf.toString("utf8").split(/\r?\n/)) {
        if (line.trim()) appendLog(task, line);
      }
    });
    child.on("error", (err) => {
      ac?.signal.removeEventListener("abort", onAbort);
      taskChildren.delete(task.id);
      reject(err);
    });
    child.on("close", (code) => {
      ac?.signal.removeEventListener("abort", onAbort);
      taskChildren.delete(task.id);
      if (ac?.signal.aborted) {
        reject(new Error("已取消"));
        return;
      }
      resolve(code ?? 1);
    });
  });
}

async function executeInstall(task: EnvTask, signal?: AbortSignal): Promise<void> {
  mkdirSync(runtimeHome(task.runtime), { recursive: true });
  setProgress(task, 8);
  appendLog(task, `目标目录 ${runtimeHome(task.runtime)}`);
  if (signal?.aborted) throw new Error("已取消");

  if (task.runtime === "browser") {
    await installBrowser(task);
    return;
  }
  if (task.runtime === "go") {
    await installGo(task);
    return;
  }
  if (task.runtime === "python") {
    await installPython(task);
    return;
  }
  if (task.runtime === "napcat") {
    await installNapCatTask(task, signal);
    return;
  }
  if (task.runtime === "desktop-pet") {
    await installDesktopPetTask(task);
    return;
  }
  throw new Error("未知运行时");
}

async function installDesktopPetTask(task: EnvTask): Promise<void> {
  if (!isDesktopPetDeployable()) {
    throw new Error("当前环境无法部署");
  }
  setProgress(task, 10);
  appendLog(task, "桌宠消息通道：安装 Electron 运行时");
  const petDir = join(rootDir, "apps", "desktop-pet");
  if (!existsSync(join(petDir, "package.json"))) {
    throw new Error("缺少 apps/desktop-pet，请先更新框架");
  }
  const pnpmBin = which("pnpm") || which("pnpm.cmd");
  const nodeBin = which("node") || which("node.exe") || process.execPath;
  const mirror = process.env.ELECTRON_MIRROR || "https://npmmirror.com/mirrors/electron/";

  setProgress(task, 25);
  // 优先用当前网关同一份 node，避免 which() 指到带空格的 Program Files 路径踩坑
  const nodeForInstall = process.execPath || nodeBin;
  if (pnpmBin) {
    appendLog(task, "安装 @fengyun/nexus-desktop-pet 依赖");
    const code = await runCmd(
      task,
      pnpmBin,
      ["--filter", "@fengyun/nexus-desktop-pet", "install"],
      {
        cwd: rootDir,
        env: { ...process.env, ELECTRON_MIRROR: mirror },
      },
    );
    if (code !== 0) appendLog(task, "pnpm install 返回非零，继续尝试下载 Electron");
  } else {
    appendLog(task, "未找到 pnpm，跳过依赖安装步骤");
  }

  setProgress(task, 55);
  appendLog(task, `下载 Electron（镜像 ${mirror}）`);
  const installJsCandidates = [
    join(petDir, "node_modules", "electron", "install.js"),
    join(rootDir, "node_modules", "electron", "install.js"),
  ];
  const installJs = installJsCandidates.find((p) => existsSync(p));
  if (installJs && nodeForInstall) {
    const code = await runCmd(task, nodeForInstall, [installJs], {
      cwd: petDir,
      env: { ...process.env, ELECTRON_MIRROR: mirror },
    });
    if (code !== 0) {
      const existing = resolveDesktopPetElectron(rootDir);
      if (existing) {
        appendLog(task, `Electron 下载命令失败，但本机已有可用二进制，继续：${existing}`);
      } else {
        throw new Error("Electron 下载失败。可开梯子后重试，或设置 ELECTRON_MIRROR");
      }
    }
  } else if (!installJs) {
    const existing = resolveDesktopPetElectron(rootDir);
    if (!existing) {
      throw new Error("未找到 electron/install.js，请先保证 apps/desktop-pet 依赖已安装");
    }
    appendLog(task, `跳过下载脚本，使用已有 Electron：${existing}`);
  }

  setProgress(task, 85);
  const bin = resolveDesktopPetElectron(rootDir);
  if (!bin) {
    throw new Error(
      "未检测到 electron.exe。请开网络后重装，或手动：pnpm --filter @fengyun/nexus-desktop-pet install",
    );
  }
  appendLog(task, `Electron 已就绪：${bin}`);
  mkdirSync(runtimeHome("desktop-pet"), { recursive: true });
  writeFileSync(
    join(runtimeHome("desktop-pet"), "ready"),
    `${now()}\n${bin}\n`,
    "utf8",
  );

  setProgress(task, 88);
  if (process.platform === "win32") {
    appendLog(task, "安装 sherpa-onnx 本机呼唤（KWS 模型 + 麦克风引擎）…");
    try {
      const ready = await installSherpaVoice({
        root: rootDir,
        onLog: (m) => appendLog(task, m),
        onProgress: (n) => setProgress(task, 88 + Math.floor(n * 0.07)),
      });
      appendLog(task, `sherpa 呼唤就绪：${ready.microphone}`);
      task.note = `Electron + sherpa · ${ready.at}`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendLog(task, `sherpa 安装跳过（可稍后重装桌宠）：${msg}`);
      appendLog(task, "未装 sherpa 时桌宠会自动降级 System.Speech");
    }
  } else {
    appendLog(task, "非 Windows：跳过 sherpa，仅 Electron");
  }

  appendLog(task, "下一步：消息通道 → 桌面桌宠 → 打开开关");
  setProgress(task, 95);
}

async function installNapCatTask(task: EnvTask, signal?: AbortSignal): Promise<void> {
  setProgress(task, 10);
  const wire = napcatWire?.() || {
    reverseWsUrl: "ws://127.0.0.1:8787/onebot/v11/ws",
    token: "",
  };
  const flavor = resolveFlavor((task.version as NapCatFlavor) || "auto");
  appendLog(task, `NapCat 一键安装 · ${flavor}`);
  appendLog(task, `官方说明 https://napneko.github.io/guide/boot/Shell`);
  const result = await installNapCat({
    root: rootDir,
    flavor,
    reverseWsUrl: wire.reverseWsUrl,
    token: wire.token,
    signal,
    onLog: (line) => appendLog(task, line),
    onProgress: (n) => setProgress(task, n),
  });
  appendLog(task, `安装目录 ${result.home}`);
  appendLog(task, `启动：${result.launchCmd}`);
  appendLog(task, "下一步：运行启动脚本 → 扫码登录 → 回控制台 OneBot 看是否已连接");
  task.note = `NapCat ${result.version} · ${result.home}`;
  try {
    napcatAfterInstall?.();
    appendLog(task, "已自动启用本机 OneBot 通道");
  } catch (e) {
    appendLog(task, `启用 OneBot 跳过：${e instanceof Error ? e.message : String(e)}`);
  }
}

async function installBrowser(task: EnvTask): Promise<void> {
  setProgress(task, 12);
  appendLog(task, "准备 Playwright Chromium（生图 / 截菜单用）");
  mkdirSync(runtimeHome("browser"), { recursive: true });

  const pnpmBin = which("pnpm") || which("pnpm.cmd");
  const nodeBin = which("node") || which("node.exe") || process.execPath;

  // 1) 确保工作区装有 playwright 包（挂在 z-draw）
  if (pnpmBin) {
    setProgress(task, 28);
    appendLog(task, "安装 npm 包 playwright（@fengyun/z-draw）");
    const addCode = await runCmd(
      task,
      pnpmBin,
      ["--filter", "@fengyun/z-draw", "add", "playwright@^1.49.0"],
      { cwd: rootDir },
    );
    if (addCode !== 0) {
      appendLog(task, "pnpm add playwright 失败，继续尝试已有包");
    }
  }

  // 2) 下载 Chromium 浏览器本体
  setProgress(task, 45);
  let code = 1;
  if (pnpmBin) {
    appendLog(task, "下载 Chromium：pnpm exec playwright install chromium");
    code = await runCmd(
      task,
      pnpmBin,
      ["exec", "playwright", "install", "chromium"],
      { cwd: rootDir },
    );
  }
  if (code !== 0) {
    // 回退：node node_modules/playwright/cli.js
    const cli = [
      join(rootDir, "node_modules", "playwright", "cli.js"),
      join(rootDir, "plugins", "z-draw", "node_modules", "playwright", "cli.js"),
    ].find((p) => existsSync(p));
    if (cli && nodeBin) {
      appendLog(task, `回退：node ${cli} install chromium`);
      code = await runCmd(task, nodeBin, [cli, "install", "chromium"], {
        cwd: rootDir,
      });
    }
  }

  setProgress(task, 88);
  if (code !== 0) {
    throw new Error(
      "playwright install chromium 失败。可手动：pnpm exec playwright install chromium",
    );
  }

  writeFileSync(join(runtimeHome("browser"), "ready"), `${now()}\n`, "utf8");
  appendLog(task, "Chromium 已就绪");
  setProgress(task, 95);
}

async function installGo(task: EnvTask): Promise<void> {
  setProgress(task, 12);
  if (which("go")) {
    appendLog(task, "系统已有 go，跳过下载");
    setProgress(task, 90);
    return;
  }
  if (isTermux() && which("pkg")) {
    setProgress(task, 30);
    appendLog(task, "Termux：pkg install golang");
    const code = await runCmd(task, "pkg", ["install", "-y", "golang"]);
    setProgress(task, 90);
    if (code !== 0) throw new Error("pkg install golang 失败");
    return;
  }
  if (task.mode === "compile") {
    appendLog(task, "编译安装需要本机已有 Go 工具链；当前改为标记二进制占位");
  }
  setProgress(task, 40);
  appendLog(task, `记录目标版本 ${task.version}（完整离线包可后续放入 data/runtimes/go）`);
  writeFileSync(
    join(runtimeHome("go"), "VERSION"),
    `${task.version}\nmode=${task.mode}\n`,
    "utf8",
  );
  setProgress(task, 75);
  appendLog(task, "若需系统级 Go：Windows 用官方安装包；Linux 用发行版包管理器");
  setProgress(task, 92);
}

async function installPython(task: EnvTask): Promise<void> {
  setProgress(task, 12);
  if (which("python3") || which("python")) {
    appendLog(task, "系统已有 Python，跳过下载");
    setProgress(task, 90);
    return;
  }
  if (isTermux() && which("pkg")) {
    setProgress(task, 30);
    appendLog(task, "Termux：pkg install python");
    const code = await runCmd(task, "pkg", ["install", "-y", "python"]);
    setProgress(task, 90);
    if (code !== 0) throw new Error("pkg install python 失败");
    return;
  }
  setProgress(task, 40);
  appendLog(task, `记录目标版本 ${task.version}`);
  writeFileSync(
    join(runtimeHome("python"), "VERSION"),
    `${task.version}\nmode=${task.mode}\n`,
    "utf8",
  );
  setProgress(task, 75);
  appendLog(task, "若需系统级 Python：请用官方安装包或包管理器");
  setProgress(task, 92);
}
