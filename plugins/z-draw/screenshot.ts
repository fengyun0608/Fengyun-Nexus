/**
 * Render HTML with the framework browser runtime and take a screenshot.
 * Prefer Playwright Chromium when installed via 环境配置 → 浏览器.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export type ShotResult =
  | { ok: true; htmlPath: string; pngPath: string }
  | { ok: false; htmlPath: string; message: string };

function projectRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // plugins/z-draw → repo root
  return resolve(join(here, "..", ".."));
}

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
    padding: 28px 32px 24px;
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
  .foot {
    margin-top: 18px; font-size: 12px; color: #8a8f84;
  }
</style>
</head>
<body>
  <div class="card" id="shot">
    <div class="brand">Fengyun Nexus</div>
    <h1>${escapeHtml(title)}</h1>
    <ul>${items}</ul>
    <div class="foot">菜单图 · 浏览器截图</div>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function renderMenuShot(opts: {
  title: string;
  lines: string[];
  outDir?: string;
}): Promise<ShotResult> {
  const root = projectRoot();
  const outDir = opts.outDir ?? join(root, "data", "draw");
  mkdirSync(outDir, { recursive: true });
  const stamp = Date.now();
  const htmlPath = join(outDir, `menu-${stamp}.html`);
  const pngPath = join(outDir, `menu-${stamp}.png`);
  writeFileSync(htmlPath, menuHtml(opts.title, opts.lines), "utf8");

  try {
    // Optional dependency — install via 环境配置 / npm i playwright
    const pw = await import("playwright").catch(() => null);
    if (!pw?.chromium) {
      return {
        ok: false,
        htmlPath,
        message: "未装浏览器运行时。请在「环境配置」安装浏览器，或 npm i playwright",
      };
    }
    const browser = await pw.chromium.launch({
      headless: true,
      executablePath: process.env.NEXUS_BROWSER_BIN || undefined,
      timeout: 20_000,
    });
    try {
      const page = await browser.newPage({
        viewport: { width: 800, height: 1000 },
        deviceScaleFactor: 2,
      });
      page.setDefaultTimeout(15_000);
      await page.goto(pathToFileURL(htmlPath).href, {
        waitUntil: "domcontentloaded",
        timeout: 15_000,
      });
      const el = page.locator("#shot");
      await el.screenshot({ path: pngPath, type: "png", timeout: 10_000 });
    } finally {
      await browser.close();
    }
    if (!existsSync(pngPath)) {
      return { ok: false, htmlPath, message: "截图失败" };
    }
    return { ok: true, htmlPath, pngPath };
  } catch (e) {
    return {
      ok: false,
      htmlPath,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
