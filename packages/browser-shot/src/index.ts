/**
 * 系统内置网页截图：Playwright Chromium 渲 HTML / 菜单卡片后出 PNG。
 * 插件通过 PluginContext.shot 调用，不要各自再装一套浏览器。
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export type ShotResult =
  | { ok: true; htmlPath: string; pngPath: string }
  | { ok: false; htmlPath: string; message: string; pngPath?: string };

export type ShotMenuOpts = {
  title: string;
  lines: string[];
  outDir?: string;
};

export type ShotHtmlOpts = {
  html: string;
  outDir?: string;
  /** CSS 选择器，默认整页 body */
  selector?: string;
  width?: number;
  height?: number;
};

function projectRoot(): string {
  if (process.env.NEXUS_ROOT) return resolve(process.env.NEXUS_ROOT);
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(join(dirname(fileURLToPath(import.meta.url)), "../../.."));
}

async function loadPlaywright(): Promise<{
  chromium: {
    launch: (opts?: Record<string, unknown>) => Promise<{
      newPage: (opts?: Record<string, unknown>) => Promise<{
        setDefaultTimeout: (ms: number) => void;
        goto: (url: string, opts?: Record<string, unknown>) => Promise<unknown>;
        locator: (sel: string) => {
          screenshot: (opts: Record<string, unknown>) => Promise<unknown>;
        };
        screenshot: (opts: Record<string, unknown>) => Promise<unknown>;
      }>;
      close: () => Promise<void>;
    }>;
  };
} | null> {
  const root = projectRoot();
  const tryPaths = [
    join(root, "packages/browser-shot/package.json"),
    join(root, "package.json"),
  ];
  for (const pkgJson of tryPaths) {
    try {
      const req = createRequire(pkgJson);
      const mod = req("playwright") as { chromium?: unknown };
      if (mod?.chromium) return mod as never;
    } catch {
      /* next */
    }
  }
  try {
    const mod = await import("playwright");
    if (mod?.chromium) return mod as never;
  } catch {
    /* ignore */
  }
  return null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 内置菜单卡片 HTML（无底部旁文） */
export function menuHtml(title: string, lines: string[]): string {
  const items = lines
    .map((l) => `<li><span>${escapeHtml(l)}</span></li>`)
    .join("\n");
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 32px;
    font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    background: linear-gradient(145deg, #1a1f18 0%, #0f1410 55%, #1c2418 100%);
    color: #e8e6df;
  }
  .card {
    width: 720px; margin: 0 auto;
    border: 1px solid rgba(232,165,75,.35);
    border-radius: 18px;
    background: rgba(0,0,0,.35);
    padding: 28px 32px 28px;
    box-shadow: 0 18px 50px rgba(0,0,0,.45);
  }
  .brand {
    font-size: 13px; letter-spacing: .18em; text-transform: uppercase;
    color: #8fad7a; margin-bottom: 8px;
  }
  h1 {
    margin: 0 0 18px; font-size: 28px; font-weight: 700;
    color: #e8a54b;
  }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  li {
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid rgba(232,165,75,.15);
    background: rgba(255,255,255,.03);
    font-size: 16px; line-height: 1.45;
  }
  li span { white-space: pre-wrap; }
</style>
</head>
<body>
  <div class="card" id="shot">
    <div class="brand">Fengyun Nexus</div>
    <h1>${escapeHtml(title)}</h1>
    <ul>${items}</ul>
  </div>
</body>
</html>`;
}

async function captureFile(
  htmlPath: string,
  pngPath: string,
  opts: { selector: string; width: number; height: number },
): Promise<ShotResult> {
  try {
    const pw = await loadPlaywright();
    if (!pw?.chromium) {
      return {
        ok: false,
        htmlPath,
        message:
          "未装浏览器运行时。请在控制台「环境配置」安装，或执行：pnpm --filter @fengyun/browser-shot exec playwright install chromium",
      };
    }
    const browser = await pw.chromium.launch({
      headless: true,
      executablePath: process.env.NEXUS_BROWSER_BIN || undefined,
      timeout: 60_000,
    });
    try {
      const page = await browser.newPage({
        viewport: { width: opts.width, height: opts.height },
        deviceScaleFactor: 2,
      });
      page.setDefaultTimeout(20_000);
      await page.goto(pathToFileURL(htmlPath).href, {
        waitUntil: "domcontentloaded",
        timeout: 20_000,
      });
      if (opts.selector === "body" || opts.selector === "page") {
        await page.screenshot({ path: pngPath, type: "png", fullPage: true, timeout: 15_000 });
      } else {
        const el = page.locator(opts.selector);
        await el.screenshot({ path: pngPath, type: "png", timeout: 15_000 });
      }
    } finally {
      await browser.close();
    }
    if (!existsSync(pngPath)) {
      return { ok: false, htmlPath, message: "截图失败" };
    }
    return { ok: true, htmlPath, pngPath };
  } catch (e) {
    const tip = e instanceof Error ? e.message : String(e);
    const hint = /Executable doesn't exist|browserType\.launch/i.test(tip)
      ? `${tip}\n请执行：pnpm exec playwright install chromium`
      : tip;
    return { ok: false, htmlPath, message: hint };
  }
}

export async function renderMenuShot(opts: ShotMenuOpts): Promise<ShotResult> {
  const root = projectRoot();
  const outDir = opts.outDir ?? join(root, "data", "draw");
  mkdirSync(outDir, { recursive: true });
  const stamp = Date.now();
  const htmlPath = join(outDir, `menu-${stamp}.html`);
  const pngPath = join(outDir, `menu-${stamp}.png`);
  writeFileSync(htmlPath, menuHtml(opts.title, opts.lines), "utf8");
  return captureFile(htmlPath, pngPath, {
    selector: "#shot",
    width: 800,
    height: 1000,
  });
}

export async function renderHtmlShot(opts: ShotHtmlOpts): Promise<ShotResult> {
  const root = projectRoot();
  const outDir = opts.outDir ?? join(root, "data", "draw");
  mkdirSync(outDir, { recursive: true });
  const stamp = Date.now();
  const htmlPath = join(outDir, `html-${stamp}.html`);
  const pngPath = join(outDir, `html-${stamp}.png`);
  writeFileSync(htmlPath, opts.html, "utf8");
  return captureFile(htmlPath, pngPath, {
    selector: opts.selector ?? "#shot",
    width: opts.width ?? 800,
    height: opts.height ?? 1000,
  });
}
