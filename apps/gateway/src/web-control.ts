/**
 * 网页控件操控：Playwright 打开页面、点选、填字、按键、扫控件。
 * 会话保存在内存里，超时自动关。
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Page = {
  goto: (url: string, opts?: Record<string, unknown>) => Promise<unknown>;
  click: (sel: string, opts?: Record<string, unknown>) => Promise<unknown>;
  fill: (sel: string, value: string) => Promise<unknown>;
  type: (sel: string, text: string, opts?: Record<string, unknown>) => Promise<unknown>;
  press: (key: string) => Promise<unknown>;
  keyboard: { press: (key: string) => Promise<unknown>; type: (text: string) => Promise<unknown> };
  locator: (sel: string) => {
    count: () => Promise<number>;
    nth: (i: number) => { textContent: () => Promise<string | null>; getAttribute: (n: string) => Promise<string | null> };
    first: () => { textContent: () => Promise<string | null> };
  };
  content: () => Promise<string>;
  title: () => Promise<string>;
  url: () => string;
  screenshot: (opts: Record<string, unknown>) => Promise<unknown>;
  evaluate: <T>(fn: (...args: unknown[]) => T, ...args: unknown[]) => Promise<T>;
  setDefaultTimeout: (ms: number) => void;
  close: () => Promise<void>;
};

type Browser = {
  newPage: () => Promise<Page>;
  close: () => Promise<void>;
};

type Session = {
  id: string;
  browser: Browser;
  page: Page;
  lastUsed: number;
};

const sessions = new Map<string, Session>();
const TTL_MS = 10 * 60_000;

function projectRoot(hint?: string): string {
  if (hint) return hint;
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

async function loadChromium(repoRoot: string): Promise<{
  launch: (opts?: Record<string, unknown>) => Promise<Browser>;
} | null> {
  const tryPaths = [
    join(repoRoot, "packages/browser-shot/package.json"),
    join(repoRoot, "package.json"),
  ];
  for (const pkgJson of tryPaths) {
    try {
      const req = createRequire(pkgJson);
      const mod = req("playwright") as { chromium?: { launch: (o?: Record<string, unknown>) => Promise<Browser> } };
      if (mod?.chromium) return mod.chromium;
    } catch {
      /* next */
    }
  }
  return null;
}

function touch(s: Session): void {
  s.lastUsed = Date.now();
}

async function sweep(): Promise<void> {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.lastUsed > TTL_MS) {
      sessions.delete(id);
      try {
        await s.browser.close();
      } catch {
        /* ignore */
      }
    }
  }
}

async function ensureSession(
  repoRoot: string,
  sessionId = "default",
): Promise<{ ok: true; session: Session } | { ok: false; message: string }> {
  await sweep();
  const id = String(sessionId || "default").trim() || "default";
  const hit = sessions.get(id);
  if (hit) {
    touch(hit);
    return { ok: true, session: hit };
  }
  const chromium = await loadChromium(repoRoot);
  if (!chromium) {
    return {
      ok: false,
      message: "没有 Playwright。请在控制台「环境配置」安装浏览器运行时",
    };
  }
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.setDefaultTimeout(20_000);
    const session: Session = { id, browser, page, lastUsed: Date.now() };
    sessions.set(id, session);
    return { ok: true, session };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function webOpen(
  repoRoot: string,
  opts: { url: string; session?: string; headless?: boolean },
): Promise<Record<string, unknown>> {
  const url = String(opts.url || "").trim();
  if (!url) return { ok: false, message: "缺少 url" };
  // 若要求有头模式，重建会话
  const id = String(opts.session || "default");
  if (opts.headless === false && sessions.has(id)) {
    const old = sessions.get(id)!;
    sessions.delete(id);
    try {
      await old.browser.close();
    } catch {
      /* */
    }
  }
  if (opts.headless === false) {
    const chromium = await loadChromium(repoRoot);
    if (!chromium) return { ok: false, message: "没有 Playwright" };
    try {
      const browser = await chromium.launch({ headless: false });
      const page = await browser.newPage();
      page.setDefaultTimeout(20_000);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      const session: Session = { id, browser, page, lastUsed: Date.now() };
      sessions.set(id, session);
      return { ok: true, session: id, title: await page.title(), url: page.url() };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  }
  const got = await ensureSession(repoRoot, id);
  if (!got.ok) return got;
  try {
    await got.session.page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    touch(got.session);
    return {
      ok: true,
      session: id,
      title: await got.session.page.title(),
      url: got.session.page.url(),
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function webClick(
  repoRoot: string,
  opts: { selector: string; session?: string },
): Promise<Record<string, unknown>> {
  const sel = String(opts.selector || "").trim();
  if (!sel) return { ok: false, message: "缺少 selector" };
  const got = await ensureSession(repoRoot, opts.session);
  if (!got.ok) return got;
  try {
    await got.session.page.click(sel, { timeout: 15_000 });
    touch(got.session);
    return { ok: true, message: "已点击", selector: sel, url: got.session.page.url() };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function webType(
  repoRoot: string,
  opts: { selector: string; text: string; session?: string; clear?: boolean },
): Promise<Record<string, unknown>> {
  const sel = String(opts.selector || "").trim();
  if (!sel) return { ok: false, message: "缺少 selector" };
  const got = await ensureSession(repoRoot, opts.session);
  if (!got.ok) return got;
  try {
    if (opts.clear !== false) await got.session.page.fill(sel, String(opts.text ?? ""));
    else await got.session.page.type(sel, String(opts.text ?? ""));
    touch(got.session);
    return { ok: true, message: "已输入", selector: sel };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function webKeys(
  repoRoot: string,
  opts: { key: string; session?: string },
): Promise<Record<string, unknown>> {
  const key = String(opts.key || "").trim();
  if (!key) return { ok: false, message: "缺少 key，例如 Enter / Control+a" };
  const got = await ensureSession(repoRoot, opts.session);
  if (!got.ok) return got;
  try {
    await got.session.page.keyboard.press(key);
    touch(got.session);
    return { ok: true, message: "已按键", key };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function webSnapshot(
  repoRoot: string,
  opts: { session?: string; limit?: number },
): Promise<Record<string, unknown>> {
  const got = await ensureSession(repoRoot, opts.session);
  if (!got.ok) return got;
  const limit = Math.min(Math.max(Number(opts.limit) || 40, 1), 120);
  try {
    const controls = await got.session.page.evaluate((lim: unknown) => {
      const n = Number(lim) || 40;
      const nodes = Array.from(
        document.querySelectorAll(
          "a,button,input,textarea,select,[role='button'],[role='textbox'],[contenteditable='true']",
        ),
      ).slice(0, n);
      return nodes.map((el, i) => {
        const e = el as HTMLElement;
        const tag = e.tagName.toLowerCase();
        const text = (e.innerText || e.getAttribute("aria-label") || e.getAttribute("placeholder") || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 80);
        const id = e.id ? `#${e.id}` : "";
        const name = e.getAttribute("name");
        const type = e.getAttribute("type") || "";
        let selector = id;
        if (!selector && name) selector = `${tag}[name="${name}"]`;
        if (!selector) selector = `${tag}:nth-of-type(${i + 1})`;
        return { index: i, tag, type, text, selector: selector.slice(0, 120) };
      });
    }, limit);
    touch(got.session);
    return {
      ok: true,
      title: await got.session.page.title(),
      url: got.session.page.url(),
      controls,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function webScreenshot(
  repoRoot: string,
  opts: { session?: string; path?: string },
): Promise<Record<string, unknown>> {
  const got = await ensureSession(repoRoot, opts.session);
  if (!got.ok) return got;
  const outDir = join(projectRoot(repoRoot), "data", "shots");
  mkdirSync(outDir, { recursive: true });
  const path = opts.path || join(outDir, `web-${Date.now()}.png`);
  try {
    await got.session.page.screenshot({ path, fullPage: false, type: "png" });
    touch(got.session);
    return { ok: true, path, url: got.session.page.url() };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function webClose(opts: { session?: string } = {}): Promise<Record<string, unknown>> {
  const id = String(opts.session || "default");
  const hit = sessions.get(id);
  if (!hit) return { ok: true, message: "会话不存在或已关闭" };
  sessions.delete(id);
  try {
    await hit.browser.close();
  } catch {
    /* */
  }
  return { ok: true, message: "已关闭网页会话" };
}
