/**
 * Agent 编程沙箱：只允许 data/agent-workspace/ 内读写，命令走白名单。
 */
import { execFile } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, normalize, relative, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function agentWorkspaceRoot(repoRoot: string): string {
  const dir = join(repoRoot, "data", "agent-workspace");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function resolveInSandbox(
  repoRoot: string,
  relPath: string,
): { ok: true; abs: string } | { ok: false; message: string } {
  const root = agentWorkspaceRoot(repoRoot);
  const raw = String(relPath || ".").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!raw || raw.split("/").some((p) => p === "..")) {
    return { ok: false, message: "路径非法" };
  }
  const abs = normalize(resolve(root, raw === "." ? "." : raw));
  const rel = relative(root, abs);
  if (rel.startsWith("..") || rel === "..") {
    return { ok: false, message: "只能访问 agent-workspace 沙箱" };
  }
  return { ok: true, abs };
}

export function workspaceList(
  repoRoot: string,
  relPath = ".",
): { ok: boolean; message: string; items?: Array<{ name: string; dir: boolean; size?: number }> } {
  const hit = resolveInSandbox(repoRoot, relPath);
  if (!hit.ok) return { ok: false, message: hit.message };
  if (!existsSync(hit.abs)) return { ok: false, message: "目录不存在" };
  const st = statSync(hit.abs);
  if (!st.isDirectory()) return { ok: false, message: "不是目录" };
  const items = readdirSync(hit.abs).slice(0, 200).map((name) => {
    const p = join(hit.abs, name);
    const s = statSync(p);
    return { name, dir: s.isDirectory(), size: s.isFile() ? s.size : undefined };
  });
  return { ok: true, message: `共 ${items.length} 项`, items };
}

export function workspaceRead(
  repoRoot: string,
  relPath: string,
): { ok: boolean; message: string; content?: string } {
  const hit = resolveInSandbox(repoRoot, relPath);
  if (!hit.ok) return { ok: false, message: hit.message };
  if (!existsSync(hit.abs) || !statSync(hit.abs).isFile()) {
    return { ok: false, message: "文件不存在" };
  }
  if (statSync(hit.abs).size > 400_000) return { ok: false, message: "文件过大" };
  const content = readFileSync(hit.abs, "utf8");
  return { ok: true, message: "已读取", content: content.slice(0, 80_000) };
}

export function workspaceWrite(
  repoRoot: string,
  relPath: string,
  content: string,
): { ok: boolean; message: string } {
  const hit = resolveInSandbox(repoRoot, relPath);
  if (!hit.ok) return { ok: false, message: hit.message };
  mkdirSync(join(hit.abs, ".."), { recursive: true });
  writeFileSync(hit.abs, String(content ?? ""), "utf8");
  return { ok: true, message: "已写入" };
}

export function workspaceDelete(
  repoRoot: string,
  relPath: string,
): { ok: boolean; message: string } {
  const hit = resolveInSandbox(repoRoot, relPath);
  if (!hit.ok) return { ok: false, message: hit.message };
  if (hit.abs === agentWorkspaceRoot(repoRoot)) {
    return { ok: false, message: "不能删除沙箱根目录" };
  }
  if (!existsSync(hit.abs)) return { ok: false, message: "不存在" };
  rmSync(hit.abs, { recursive: true, force: true });
  return { ok: true, message: "已删除" };
}

const ALLOWED: Array<{ bin: string; argsPrefix?: string[] }> = [
  { bin: "node", argsPrefix: [] },
  { bin: "pnpm", argsPrefix: [] },
  { bin: "npm", argsPrefix: ["view", "ls", "run", "test", "pack"] },
  { bin: "git", argsPrefix: ["status", "diff", "log", "show", "branch", "rev-parse"] },
  { bin: "tsc", argsPrefix: [] },
];

export async function runSafeCommand(
  repoRoot: string,
  cmdline: string,
): Promise<{ ok: boolean; message: string; stdout?: string; stderr?: string }> {
  const raw = String(cmdline || "").trim();
  if (!raw) return { ok: false, message: "缺少命令" };
  if (/[|&;<>`$]/.test(raw) || /\n/.test(raw)) {
    return { ok: false, message: "不允许管道、重定向或串联命令" };
  }
  const parts = raw.split(/\s+/).filter(Boolean);
  const bin = parts[0]!;
  const args = parts.slice(1);
  const allow = ALLOWED.find((a) => a.bin === bin);
  if (!allow) return { ok: false, message: `命令不在白名单：${bin}` };
  if (allow.argsPrefix?.length) {
    const head = args[0] || "";
    if (!allow.argsPrefix.includes(head)) {
      return { ok: false, message: `${bin} 只允许：${allow.argsPrefix.join(" / ")}` };
    }
  }
  if (bin === "git" && args.some((a) => /^-/.test(a) && /interactive|exec|upload|push|commit/i.test(a))) {
    return { ok: false, message: "不允许该 git 参数" };
  }
  if (bin === "git" && ["push", "commit", "reset", "clean", "rebase", "checkout"].includes(args[0] || "")) {
    return { ok: false, message: "沙箱里不允许改仓库历史或推送" };
  }
  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      cwd: agentWorkspaceRoot(repoRoot),
      timeout: 60_000,
      windowsHide: true,
      encoding: "utf8",
      maxBuffer: 1.5 * 1024 * 1024,
      shell: false,
    });
    return {
      ok: true,
      message: "已执行",
      stdout: String(stdout || "").slice(0, 12_000),
      stderr: String(stderr || "").slice(0, 4_000),
    };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return {
      ok: false,
      message: err.message?.slice(0, 200) || "执行失败",
      stdout: String(err.stdout || "").slice(0, 8_000),
      stderr: String(err.stderr || "").slice(0, 4_000),
    };
  }
}
