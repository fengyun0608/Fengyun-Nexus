import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { spawn, ensureWorkDir, findRepoRoot, resolveBin, type ExecLang } from "./env-gate.js";

export type RunResult = {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
};

export type RunOptions = {
  cwd?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  /** 进程有新输出时回调（未截断的增量），用于边跑边推 */
  onChunk?: (chunk: string, stream: "stdout" | "stderr") => void;
};

const MAX_OUT = 3500;
const DEFAULT_TIMEOUT_MS = 30_000;

function clip(s: string): string {
  const t = s.replace(/\r\n/g, "\n");
  if (t.length <= MAX_OUT) return t;
  return `${t.slice(0, MAX_OUT)}\n…（已截断）`;
}

function bufToText(b: Buffer | string): string {
  if (typeof b === "string") return b;
  return b.toString("utf8");
}

/**
 * Windows PowerShell：用 Out-String -Stream 边跑边出字，
 * 避免整段攒完才一次性吐到 stdout。
 */
function encodePowerShell(code: string): string {
  const codeB64 = Buffer.from(code, "utf8").toString("base64");
  const script = [
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "$OutputEncoding = [Console]::OutputEncoding",
    "$ProgressPreference = 'SilentlyContinue'",
    "$ErrorActionPreference = 'Continue'",
    `$__code = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${codeB64}'))`,
    "$__sb = [scriptblock]::Create($__code)",
    "try {",
    "  & $__sb 2>&1 | Out-String -Stream -Width 200",
    "} catch {",
    "  $_ | Out-String -Stream -Width 200",
    "}",
  ].join("\n");
  return Buffer.from(script, "utf16le").toString("base64");
}

function runProcess(bin: string, args: string[], opts?: RunOptions): Promise<RunResult> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const onChunk = opts?.onChunk;
  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd: opts?.cwd,
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUNBUFFERED: "1",
        ...opts?.env,
      },
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
      const t = bufToText(b);
      stdout += t;
      if (stdout.length > MAX_OUT * 2) stdout = stdout.slice(0, MAX_OUT * 2);
      try {
        onChunk?.(t, "stdout");
      } catch {
        /* ignore */
      }
    });
    child.stderr?.on("data", (b) => {
      const t = bufToText(b);
      stderr += t;
      if (stderr.length > MAX_OUT * 2) stderr = stderr.slice(0, MAX_OUT * 2);
      try {
        onChunk?.(t, "stderr");
      } catch {
        /* ignore */
      }
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

export async function runLangCode(
  lang: ExecLang,
  code: string,
  opts?: Pick<RunOptions, "timeoutMs" | "onChunk">,
): Promise<RunResult> {
  const work = ensureWorkDir();
  const root = findRepoRoot();
  const id = randomBytes(4).toString("hex");
  const base: RunOptions = { timeoutMs: opts?.timeoutMs, onChunk: opts?.onChunk };

  if (lang === "shell") {
    if (process.platform === "win32") {
      const ps = resolveBin("shell") || "powershell.exe";
      if (/powershell/i.test(ps)) {
        return runProcess(ps, ["-NoProfile", "-NonInteractive", "-EncodedCommand", encodePowerShell(code)], {
          ...base,
          cwd: root,
        });
      }
      return runProcess(ps, ["/d", "/s", "/c", code], { ...base, cwd: root });
    }
    const sh = resolveBin("shell") || "/bin/sh";
    return runProcess(sh, ["-lc", code], { ...base, cwd: root });
  }

  if (lang === "python") {
    const py = resolveBin("python");
    if (!py) return { ok: false, code: null, stdout: "", stderr: "找不到 python" };
    return runProcess(py, ["-u", "-c", code], { ...base, cwd: root });
  }

  if (lang === "node") {
    const node = resolveBin("node");
    if (!node) return { ok: false, code: null, stdout: "", stderr: "找不到 node" };
    return runProcess(node, ["-e", code], { ...base, cwd: root });
  }

  if (lang === "typescript") {
    const node = resolveBin("node");
    if (!node) return { ok: false, code: null, stdout: "", stderr: "找不到 node" };
    const file = join(work, `exec-${id}.ts`);
    writeFileSync(file, code, "utf8");
    try {
      const r1 = await runProcess(node, ["--experimental-strip-types", file], { ...base, cwd: work });
      if (!/Unknown option|experimental-strip-types|ERR_UNKNOWN|bad option/i.test(r1.stderr + r1.stdout)) {
        return r1;
      }
      const npx = process.platform === "win32" ? "npx.cmd" : "npx";
      return await runProcess(npx, ["--yes", "tsx", file], { ...base, cwd: work });
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
    return runProcess(php, ["-r", code], { ...base, cwd: root });
  }

  if (lang === "ruby") {
    const ruby = resolveBin("ruby");
    if (!ruby) return { ok: false, code: null, stdout: "", stderr: "找不到 ruby" };
    return runProcess(ruby, ["-e", code], { ...base, cwd: root });
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
      return await runProcess(go, ["run", "."], { ...base, cwd: dir });
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
      const c = await runProcess(rustc, [file, "-O", "-o", bin], { ...base, cwd: dir });
      if (!c.ok) return c;
      return await runProcess(bin, [], { ...base, cwd: dir });
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
