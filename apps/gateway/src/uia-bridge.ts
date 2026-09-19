/**
 * 调用 workers/python-tools/uia/uia_cli.py，操控本机已开窗口的 UIA 控件。
 * 仅 Windows；需本机 Python + pywinauto。
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function whichPython(): string | null {
  const cands = process.platform === "win32" ? ["python", "py", "python3"] : ["python3", "python"];
  for (const bin of cands) {
    try {
      // 只确认能启动；真正检测在下面 run 时
      return bin;
    } catch {
      /* next */
    }
  }
  return cands[0] || null;
}

function cliPath(repoRoot: string): string {
  return join(repoRoot, "workers", "python-tools", "uia", "uia_cli.py");
}

export async function runUiaCli(
  repoRoot: string,
  argv: string[],
): Promise<Record<string, unknown>> {
  if (process.platform !== "win32") {
    return { ok: false, message: "桌面 UIA 仅支持 Windows。网页操控请用 nexus.web_*" };
  }
  const script = cliPath(repoRoot);
  if (!existsSync(script)) {
    return { ok: false, message: `找不到 UIA 工人：${script}` };
  }
  const bins = ["python", "py", "python3"];
  let lastErr = "未找到 Python";
  for (const bin of bins) {
    try {
      const args = bin === "py" ? ["-3", script, ...argv] : [script, ...argv];
      const { stdout, stderr } = await execFileAsync(bin, args, {
        cwd: repoRoot,
        timeout: 30_000,
        windowsHide: true,
        encoding: "utf8",
        maxBuffer: 2 * 1024 * 1024,
      });
      const text = String(stdout || "").trim() || String(stderr || "").trim();
      if (!text) return { ok: false, message: "UIA 无输出" };
      try {
        return JSON.parse(text) as Record<string, unknown>;
      } catch {
        // 可能多行，取最后一行 JSON
        const lines = text.split(/\r?\n/).filter(Boolean);
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            return JSON.parse(lines[i]!) as Record<string, unknown>;
          } catch {
            /* next */
          }
        }
        return { ok: false, message: "UIA 输出不是 JSON", raw: text.slice(0, 500) };
      }
    } catch (e) {
      const err = e as { message?: string; stderr?: string; stdout?: string };
      lastErr = err.stderr || err.message || String(e);
      // 若是 JSON 错误结果
      const raw = String(err.stdout || "").trim();
      if (raw.startsWith("{")) {
        try {
          return JSON.parse(raw) as Record<string, unknown>;
        } catch {
          /* continue */
        }
      }
      if (/找不到|不是内部|not found|ENOENT/i.test(lastErr) && bin !== bins[bins.length - 1]) {
        continue;
      }
    }
  }
  return {
    ok: false,
    message: lastErr.slice(0, 400),
    hint: "可先：python -m pip install -r workers/python-tools/uia/requirements.txt",
  };
}

export function uiaWindows(repoRoot: string) {
  return runUiaCli(repoRoot, ["windows"]);
}

export function uiaTree(
  repoRoot: string,
  opts: { title?: string; handle?: number; depth?: number; limit?: number },
) {
  const argv = ["tree"];
  if (opts.title) argv.push("--title", opts.title);
  if (opts.handle) argv.push("--handle", String(opts.handle));
  if (opts.depth) argv.push("--depth", String(opts.depth));
  if (opts.limit) argv.push("--limit", String(opts.limit));
  return runUiaCli(repoRoot, argv);
}

export function uiaFocus(repoRoot: string, opts: { title?: string; handle?: number }) {
  const argv = ["focus"];
  if (opts.title) argv.push("--title", opts.title);
  if (opts.handle) argv.push("--handle", String(opts.handle));
  return runUiaCli(repoRoot, argv);
}

export function uiaClick(
  repoRoot: string,
  opts: {
    title?: string;
    handle?: number;
    name?: string;
    auto_id?: string;
    control_type?: string;
  },
) {
  const argv = ["click"];
  if (opts.title) argv.push("--title", opts.title);
  if (opts.handle) argv.push("--handle", String(opts.handle));
  if (opts.name) argv.push("--name", opts.name);
  if (opts.auto_id) argv.push("--auto_id", opts.auto_id);
  if (opts.control_type) argv.push("--control_type", opts.control_type);
  return runUiaCli(repoRoot, argv);
}

export function uiaSetText(
  repoRoot: string,
  opts: {
    title?: string;
    handle?: number;
    name?: string;
    auto_id?: string;
    control_type?: string;
    text?: string;
  },
) {
  const argv = ["set_text"];
  if (opts.title) argv.push("--title", opts.title);
  if (opts.handle) argv.push("--handle", String(opts.handle));
  if (opts.name) argv.push("--name", opts.name);
  if (opts.auto_id) argv.push("--auto_id", opts.auto_id);
  if (opts.control_type) argv.push("--control_type", opts.control_type);
  if (opts.text != null) argv.push("--text", opts.text);
  return runUiaCli(repoRoot, argv);
}

export function uiaKeys(
  repoRoot: string,
  opts: {
    title?: string;
    handle?: number;
    name?: string;
    auto_id?: string;
    control_type?: string;
    keys?: string;
  },
) {
  const argv = ["keys"];
  if (opts.title) argv.push("--title", opts.title);
  if (opts.handle) argv.push("--handle", String(opts.handle));
  if (opts.name) argv.push("--name", opts.name);
  if (opts.auto_id) argv.push("--auto_id", opts.auto_id);
  if (opts.control_type) argv.push("--control_type", opts.control_type);
  if (opts.keys) argv.push("--keys", opts.keys);
  return runUiaCli(repoRoot, argv);
}

void whichPython;
