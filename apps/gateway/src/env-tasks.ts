/** Runtime environment install tasks (Go / Python / browser) — in-memory queue. */

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
  createdAt: string;
  updatedAt: string;
  note?: string;
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
    versions: ["chromium-126", "firefox-127"],
    modes: ["binary"],
    installed: false,
  },
];

const tasks: EnvTask[] = [];
let seq = 1;

function now() {
  return new Date().toISOString();
}

export function listRuntimes(): EnvRuntimeDef[] {
  return runtimes.map((r) => ({ ...r }));
}

export function listTasks(): EnvTask[] {
  return [...tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createInstallTask(input: {
  runtime: EnvRuntimeId;
  version: string;
  mode: "compile" | "binary";
}): EnvTask {
  const rt = runtimes.find((r) => r.id === input.runtime);
  if (!rt) throw new Error("未知运行时");
  if (!rt.versions.includes(input.version)) throw new Error("版本不可用");
  if (!rt.modes.includes(input.mode)) throw new Error("安装方式不可用");

  const task: EnvTask = {
    id: `envtask-${seq++}`,
    runtime: input.runtime,
    version: input.version,
    mode: input.mode,
    status: "pending",
    createdAt: now(),
    updatedAt: now(),
    note: `${rt.label} ${input.version} · ${input.mode === "compile" ? "编译安装" : "二进制安装"}`,
  };
  tasks.unshift(task);
  return { ...task };
}

export function setTaskStatus(id: string, status: EnvTaskStatus): EnvTask | null {
  const t = tasks.find((x) => x.id === id);
  if (!t) return null;
  t.status = status;
  t.updatedAt = now();
  if (status === "done") {
    const rt = runtimes.find((r) => r.id === t.runtime);
    if (rt) {
      rt.installed = true;
      rt.activeVersion = t.version;
    }
  }
  return { ...t };
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
