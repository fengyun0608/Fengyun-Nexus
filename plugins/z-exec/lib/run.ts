import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { spawn, ensureWorkDir, resolveBin, type ExecLang } from "./env-gate.js";

export type RunResult = {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
};

const MAX_OUT = 3500;
const DEFAULT_TIMEOUT_MS = 30_000;

function clip(s: string): string {
  const t = s.replace(/\r\n/g, "\n");
  if (t.length <= MAX_OUT) return t;
  return `${t.slice(0, MAX_OUT)}\n…（已截断）`;
}

function runProcess(
  bin: string,
  args: string[],
  opts?: { cwd?: string; timeoutMs?: number },
): Promise<RunResult> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd: opts?.cwd,
      windowsHide: true,
      env: { ...process.env },
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }, timeoutMs);
    child.stdout?.on("data", (b) => {
      stdout += String(b);
      if (stdout.length > MAX_OUT * 2) stdout = stdout.slice(0, MAX_OUT * 2);
    });
    child.stderr?.on("data", (b) => {
      stderr += String(b);
      if (stderr.length > MAX_OUT * 2) stderr = stderr.slice(0, MAX_OUT * 2);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, code: null, stdout: "", stderr: err.message, timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        ok: !timedOut && code === 0,
        code,
        stdout: clip(stdout),
        stderr: clip(stderr),
        timedOut,
      });
    });
  });
}

function cleanupDir(dir: string) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

export async function runLangCode(lang: ExecLang, code: string): Promise<RunResult> {
  const work = ensureWorkDir();
  const id = randomBytes(4).toString("hex");

  if (lang === "shell") {
    if (process.platform === "win32") {
      const ps = resolveBin("shell") || "powershell.exe";
      if (/powershell/i.test(ps)) {
        return runProcess(ps, ["-NoProfile", "-NonInteractive", "-Command", code], { cwd: work });
      }
      return runProcess(ps, ["/d", "/s", "/c", code], { cwd: work });
    }
    const sh = resolveBin("shell") || "/bin/sh";
    return runProcess(sh, ["-lc", code], { cwd: work });
  }

  if (lang === "python") {
    const py = resolveBin("python");
    if (!py) return { ok: false, code: null, stdout: "", stderr: "找不到 python" };
    return runProcess(py, ["-c", code], { cwd: work });
  }

  if (lang === "node") {
    const node = resolveBin("node");
    if (!node) return { ok: false, code: null, stdout: "", stderr: "找不到 node" };
    return runProcess(node, ["-e", code], { cwd: work });
  }

  if (lang === "typescript") {
    const node = resolveBin("node");
    if (!node) return { ok: false, code: null, stdout: "", stderr: "找不到 node" };
    const file = join(work, `exec-${id}.ts`);
    writeFileSync(file, code, "utf8");
    try {
      const r1 = await runProcess(node, ["--experimental-strip-types", file], { cwd: work });
      if (!/Unknown option|experimental-strip-types|ERR_UNKNOWN|bad option/i.test(r1.stderr + r1.stdout)) {
        return r1;
      }
      const npx = process.platform === "win32" ? "npx.cmd" : "npx";
      return await runProcess(npx, ["--yes", "tsx", file], { cwd: work });
    } finally {
      try {
        if (existsSync(file)) unlinkSync(file);
      } catch {
        /* ignore */
      }
    }
  }

  if (lang === "php") {
    const php = resolveBin("php");
    if (!php) return { ok: false, code: null, stdout: "", stderr: "找不到 php" };
    return runProcess(php, ["-r", code], { cwd: work });
  }

  if (lang === "ruby") {
    const ruby = resolveBin("ruby");
    if (!ruby) return { ok: false, code: null, stdout: "", stderr: "找不到 ruby" };
    return runProcess(ruby, ["-e", code], { cwd: work });
  }

  if (lang === "go") {
    const go = resolveBin("go");
    if (!go) return { ok: false, code: null, stdout: "", stderr: "找不到 go" };
    const dir = join(work, `go-${id}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "main.go");
    writeFileSync(
      file,
      /package\s+main/.test(code)
        ? code
        : `package main\n\nfunc main() {\n${code}\n}\n`,
      "utf8",
    );
    try {
      return await runProcess(go, ["run", "."], { cwd: dir });
    } finally {
      cleanupDir(dir);
    }
  }

  if (lang === "rust") {
    const rustc = resolveBin("rust");
    if (!rustc) return { ok: false, code: null, stdout: "", stderr: "找不到 rustc" };
    const dir = join(work, `rs-${id}`);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "main.rs");
    const bin = join(dir, process.platform === "win32" ? "main.exe" : "main");
    writeFileSync(
      file,
      /fn\s+main\s*\(/.test(code) ? code : `fn main() {\n${code}\n}\n`,
      "utf8",
    );
    try {
      const c = await runProcess(rustc, [file, "-O", "-o", bin], { cwd: dir });
      if (!c.ok) return c;
      return await runProcess(bin, [], { cwd: dir });
    } finally {
      cleanupDir(dir);
    }
  }

  return { ok: false, code: null, stdout: "", stderr: `未实现语言 ${lang}` };
}

export function formatRunResult(r: RunResult): string {
  const lines: string[] = [];
  if (r.timedOut) lines.push("状态：超时已杀掉");
  else lines.push(`状态：${r.ok ? "成功" : "失败"}  exit=${r.code ?? "?"}`);
  if (r.stdout.trim()) lines.push("—— stdout ——", r.stdout.trimEnd());
  if (r.stderr.trim()) lines.push("—— stderr ——", r.stderr.trimEnd());
  if (!r.stdout.trim() && !r.stderr.trim()) lines.push("（无输出）");
  return lines.join("\n");
}
