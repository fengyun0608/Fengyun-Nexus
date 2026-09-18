/**
 * Go / Python / browser install queue.
 * Uninstalled runtimes auto-enqueue; worker runs one-by-one with live logs.
 */
import { spawn, execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type EnvRuntimeId = "go" | "python" | "browser";
export type EnvTaskStatus = "pending" | "running" | "paused" | "done" | "failed";

export type EnvRuntimeDef = {
  id: EnvRuntimeId;
  label: string;
  versions: string[];
  modes: Array<"compile" | "binary">;
  installed?: boolean;
  activeVersion?: string;
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
];

const tasks: EnvTask[] = [];
let seq = 1;
let rootDir = process.cwd();
let workerBusy = false;
let kickTimer: ReturnType<typeof setTimeout> | null = null;
/** Print install lines to the backend terminal (not only web). */
let consoleSink: ((line: string) => void) | null = null;

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
    })
      .trim()
      .split(/\r?\n/)[0];
    return out || null;
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
        rt.activeVersion = execSync("go version", { encoding: "utf8" }).trim().slice(0, 40);
      } catch {
        rt.activeVersion = "system";
      }
      continue;
    }
    if (rt.id === "python" && (which("python3") || which("python"))) {
      rt.installed = true;
      const py = which("python3") || which("python")!;
      try {
        rt.activeVersion = execSync(`"${py}" --version`, { encoding: "utf8" }).trim();
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
    }
  }
}

export function initEnvTasks(
  root: string,
  opts?: { onLog?: (line: string) => void },
): void {
  rootDir = root;
  consoleSink = opts?.onLog ?? null;
  mkdirSync(join(rootDir, "data", "runtimes"), { recursive: true });
  refreshInstalledFlags();
  kickWorker();
}

export function listRuntimes(): EnvRuntimeDef[] {
  refreshInstalledFlags();
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
  const version = input.version || rt.versions[0]!;
  const mode = input.mode || (rt.modes.includes("binary") ? "binary" : rt.modes[0]!)!;
  if (!rt.versions.includes(version) && !rt.versions.some((v) => version.startsWith(v))) {
    // allow chromium alias
    if (!(rt.id === "browser" && (version === "chromium" || version === "firefox"))) {
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

/** Auto-queue every runtime that is not installed. */
export function autoQueueMissing(): { queued: EnvTask[]; skipped: string[] } {
  refreshInstalledFlags();
  const queued: EnvTask[] = [];
  const skipped: string[] = [];
  for (const rt of runtimes) {
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

  try {
    await executeInstall(next);
    // executeInstall 可能把状态改成 paused
    if ((next.status as EnvTaskStatus) === "paused") {
      appendLog(next, "已暂停");
    } else {
      next.status = "done";
      setProgress(next, 100);
      markInstalled(next);
      appendLog(next, "安装完成");
    }
  } catch (e) {
    next.status = "failed";
    next.error = e instanceof Error ? e.message : String(e);
    appendLog(next, `失败：${next.error}`);
  } finally {
    workerBusy = false;
    next.updatedAt = now();
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
    // Windows：路径含空格时 shell:true 会把 D:\Program Files\... 拆断；
    // 对 .cmd 走 cmd.exe /d /s /c，并给参数加引号。
    const win = process.platform === "win32";
    let child;
    if (win) {
      const q = (s: string) => (`"${String(s).replace(/"/g, '\\"')}"`);
      const line = [q(command), ...args.map(q)].join(" ");
      child = spawn("cmd.exe", ["/d", "/s", "/c", line], {
        cwd: opts?.cwd || rootDir,
        env: { ...process.env, ...opts?.env },
        windowsHide: true,
      });
    } else {
      child = spawn(command, args, {
        cwd: opts?.cwd || rootDir,
        env: { ...process.env, ...opts?.env },
      });
    }
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
    child.on("error", (err) => reject(err));
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function executeInstall(task: EnvTask): Promise<void> {
  mkdirSync(runtimeHome(task.runtime), { recursive: true });
  setProgress(task, 8);
  appendLog(task, `目标目录 ${runtimeHome(task.runtime)}`);

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
  throw new Error("未知运行时");
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
