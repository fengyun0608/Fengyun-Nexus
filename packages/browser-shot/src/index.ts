/**
 * 系统内置网页截图：Playwright Chromium 渲 HTML / 菜单卡片后出 PNG。
 * 插件通过 PluginContext.shot 调用，不要各自再装一套浏览器。
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { escapeShotHtml, nexusShotCss } from "./shot-ui.js";

export {
  escapeShotHtml,
  meterBarHtml,
  nexusShotCss,
  tileHtml,
} from "./shot-ui.js";

export type ShotResult =
  | { ok: true; htmlPath: string; pngPath: string }
  | { ok: false; htmlPath: string; message: string; pngPath?: string };

export type ShotMenuSection = { title: string; lines: string[] };

export type ShotMenuOpts = {
  title: string;
  lines?: string[];
  sections?: ShotMenuSection[];
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

function menuBody(title: string, lines: string[], sections?: ShotMenuSection[]): string {
  if (sections?.length) {
    return sections
      .map((s) => {
        const items = s.lines
          .map((l) => `<li><span>${escapeShotHtml(l)}</span></li>`)
          .join("\n");
        return `<div class="sec">${escapeShotHtml(s.title)}</div><ul class="menu-list">${items}</ul>`;
      })
      .join("\n");
  }
  const items = (lines.length ? lines : ["（空）"])
    .map((l) => `<li><span>${escapeShotHtml(l)}</span></li>`)
    .join("\n");
  return `<ul class="menu-list" style="margin-top:18px">${items}</ul>`;
}

function flatMenuLines(lines: string[] | undefined, sections?: ShotMenuSection[]): string[] {
  if (sections?.length) {
    const out: string[] = [];
    for (const s of sections) {
      out.push(s.title);
      out.push(...s.lines);
    }
    return out.length ? out : ["（空）"];
  }
  return lines?.length ? lines : ["（空）"];
}

/** 内置菜单卡片 HTML（无底部旁文） */
export function menuHtml(title: string, lines: string[] = [], sections?: ShotMenuSection[]): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeShotHtml(title)}</title>
<style>${nexusShotCss()}</style>
</head>
<body>
  <div class="card" id="shot">
    <div class="brand">Fengyun Nexus</div>
    <div class="head"><h1>${escapeShotHtml(title)}</h1></div>
    ${menuBody(title, lines, sections)}
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

function menuSvg(title: string, lines: string[]): string {
  const rowH = 34;
  const height = 108 + Math.max(1, lines.length) * rowH + 28;
  const rows = (lines.length ? lines : ["（空）"])
    .map((line, i) => {
      const y = 96 + i * rowH;
      return `<rect x="28" y="${y}" width="724" height="28" rx="8" fill="#f3faf6" stroke="rgba(45,140,110,.16)"/>
  <text x="42" y="${y + 19}" font-size="15" fill="#1c322c" font-family="Segoe UI, Microsoft YaHei, sans-serif">${escapeShotHtml(line)}</text>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="780" height="${height}">
  <rect width="100%" height="100%" fill="#eef8f3"/>
  <text x="32" y="40" font-size="12" letter-spacing="3" fill="#4caf8a" font-family="Segoe UI, sans-serif">FENGYUN NEXUS</text>
  <text x="32" y="74" font-size="28" fill="#247a5e" font-family="Segoe UI, Microsoft YaHei, sans-serif">${escapeShotHtml(title)}</text>
  ${rows}
</svg>`;
}

export async function renderMenuShot(opts: ShotMenuOpts): Promise<ShotResult> {
  const root = projectRoot();
  const outDir = opts.outDir ?? join(root, "data", "draw");
  mkdirSync(outDir, { recursive: true });
  const stamp = Date.now();
  const htmlPath = join(outDir, `menu-${stamp}.html`);
  const pngPath = join(outDir, `menu-${stamp}.png`);
  writeFileSync(htmlPath, menuHtml(opts.title, opts.lines || [], opts.sections), "utf8");
  const shot = await captureFile(htmlPath, pngPath, {
    selector: "#shot",
    width: 800,
    height: 1000,
  });
  if (shot.ok) return shot;
  console.warn(`[browser-shot] 菜单 PNG 未生成，改出 SVG：${shot.message}`);
  const svgPath = join(outDir, `menu-${stamp}.svg`);
  writeFileSync(svgPath, menuSvg(opts.title, flatMenuLines(opts.lines, opts.sections)), "utf8");
  return { ok: true, htmlPath, pngPath: svgPath };
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
