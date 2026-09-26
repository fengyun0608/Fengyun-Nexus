import { execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type ExecLang =
  | "python"
  | "shell"
  | "go"
  | "node"
  | "typescript"
  | "rust"
  | "php"
  | "ruby";

/** 指令前缀 → 语言 → 环境运行时 id */
export const LANG_BY_CMD: Record<string, { lang: ExecLang; runtimeId: string; label: string }> = {
  py: { lang: "python", runtimeId: "python", label: "Python" },
  python: { lang: "python", runtimeId: "python", label: "Python" },
  sh: { lang: "shell", runtimeId: "shell", label: "Shell" },
  bash: { lang: "shell", runtimeId: "shell", label: "Shell" },
  cmd: { lang: "shell", runtimeId: "shell", label: "Shell" },
  ps: { lang: "shell", runtimeId: "shell", label: "Shell" },
  go: { lang: "go", runtimeId: "go", label: "Go" },
  js: { lang: "node", runtimeId: "node", label: "Node.js" },
  node: { lang: "node", runtimeId: "node", label: "Node.js" },
  ts: { lang: "typescript", runtimeId: "node", label: "TypeScript(Node)" },
  rs: { lang: "rust", runtimeId: "rust", label: "Rust" },
  rust: { lang: "rust", runtimeId: "rust", label: "Rust" },
  php: { lang: "php", runtimeId: "php", label: "PHP" },
  rb: { lang: "ruby", runtimeId: "ruby", label: "Ruby" },
  ruby: { lang: "ruby", runtimeId: "ruby", label: "Ruby" },
};

function which(bin: string): string | null {
  try {
    const out = execSync(process.platform === "win32" ? `where ${bin}` : `command -v ${bin}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 8_000,
      windowsHide: true,
    })
      .trim()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!out.length) return null;
    if (process.platform === "win32") {
      const preferred =
        out.find((p) => /\.cmd$/i.test(p)) ||
        out.find((p) => /\.exe$/i.test(p)) ||
        out.find((p) => /\.bat$/i.test(p)) ||
        out[0];
      if (!preferred || /WindowsApps/i.test(preferred)) return null;
      return preferred;
    }
    return out[0] || null;
  } catch {
    return null;
  }
}

export function findRepoRoot(): string {
  let d = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (
      existsSync(join(d, "pnpm-workspace.yaml")) ||
      existsSync(join(d, "apps", "gateway"))
    ) {
      return d;
    }
    const parent = join(d, "..");
    if (parent === d) break;
    d = parent;
  }
  return process.cwd();
}

function markerInstalled(runtimeId: string): boolean {
  const marker = join(findRepoRoot(), "data", "runtimes", runtimeId, "installed.json");
  if (!existsSync(marker)) return false;
  try {
    JSON.parse(readFileSync(marker, "utf8"));
    return true;
  } catch {
    return false;
  }
}

function detectReady(runtimeId: string): boolean {
  if (markerInstalled(runtimeId)) return true;
  switch (runtimeId) {
    case "python":
      return Boolean(which("python3") || which("python"));
    case "go":
      return Boolean(which("go"));
    case "node":
      return Boolean(which("node.exe") || which("node") || process.execPath);
    case "shell":
      return true;
    case "rust":
      return Boolean(which("rustc"));
    case "php":
      return Boolean(which("php"));
    case "ruby":
      return Boolean(which("ruby"));
    default:
      return false;
  }
}

export function assertLangReady(cmd: string): { ok: true; meta: (typeof LANG_BY_CMD)[string] } | { ok: false; message: string } {
  const key = cmd.toLowerCase();
  const meta = LANG_BY_CMD[key];
  if (!meta) return { ok: false, message: `不支持的指令 #${cmd}` };
  if (!detectReady(meta.runtimeId)) {
    return {
      ok: false,
      message: `${meta.label} 未在环境配置里就绪。请到控制台「环境配置」安装/登记 ${meta.runtimeId} 后再用 #${key}`,
    };
  }
  return { ok: true, meta };
}

export function resolveBin(runtimeId: string): string | null {
  switch (runtimeId) {
    case "python":
      return which("python3") || which("python");
    case "go":
      return which("go");
    case "node":
      return which("node.exe") || which("node") || process.execPath;
    case "rust":
      return which("rustc");
    case "php":
      return which("php");
    case "ruby":
      return which("ruby");
    case "shell":
      return process.platform === "win32"
        ? which("powershell.exe") || which("cmd.exe")
        : which("bash") || which("sh");
    default:
      return null;
  }
}

export function ensureWorkDir(): string {
  const dir = join(findRepoRoot(), "data", "exec-workspace");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export { which, spawn };
