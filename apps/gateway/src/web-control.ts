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
  connectOverCDP?: (endpoint: string) => Promise<Browser>;
} | null> {
  const tryPaths = [
    join(repoRoot, "packages/browser-shot/package.json"),
    join(repoRoot, "package.json"),
  ];
  for (const pkgJson of tryPaths) {
    try {
      const req = createRequire(pkgJson);
      const mod = req("playwright") as {
        chromium?: {
          launch: (o?: Record<string, unknown>) => Promise<Browser>;
          connectOverCDP?: (endpoint: string) => Promise<Browser>;
        };
      };
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
        const r = e.getBoundingClientRect();
        let selector = id;
        if (!selector && name) selector = `${tag}[name="${name}"]`;
        if (!selector) selector = `${tag}:nth-of-type(${i + 1})`;
        return {
          index: i,
          tag,
          type,
          text,
          selector: selector.slice(0, 120),
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      });
    }, limit);
    touch(got.session);
    const texts = await got.session.page.evaluate((lim: unknown) => {
      const n = Number(lim) || 40;
      const acc: Element[] = [];
      const walk = (root: ParentNode, depth: number) => {
        if (depth > 5 || acc.length > 500) return;
        let nodes: Element[] = [];
        try {
          nodes = Array.from(root.querySelectorAll("*"));
        } catch {
          nodes = [];
        }
        for (const el of nodes) {
          acc.push(el);
          const shadow = (el as HTMLElement).shadowRoot;
          if (shadow) walk(shadow, depth + 1);
        }
      };
      walk(document, 0);
      const items: Array<Record<string, unknown>> = [];
      for (const el of acc) {
        if (items.length >= n) break;
        const e = el as HTMLElement;
        const r = e.getBoundingClientRect();
        if (r.width < 8 || r.height < 8 || r.bottom < 0 || r.top > window.innerHeight) continue;
        if (r.width > window.innerWidth * 0.92 && r.height > 80) continue;
        const own = Array.from(e.childNodes)
          .filter((node) => node.nodeType === 3)
          .map((node) => (node.textContent || "").replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .join(" ");
        const hint = (
          own ||
          e.getAttribute("placeholder") ||
          e.getAttribute("aria-label") ||
          ""
        )
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 80);
        if (!hint) continue;
        items.push({
          text: hint,
          tag: e.tagName.toLowerCase(),
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      }
      return items;
    }, limit);
    return {
      ok: true,
      title: await got.session.page.title(),
      url: got.session.page.url(),
      controls,
      texts,
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

async function cdpAlive(port: number): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 500);
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

type LivePage = Page & {
  mouse: { click: (x: number, y: number) => Promise<void> };
};

async function pagesOf(browser: Browser): Promise<Page[]> {
  const raw = browser as Browser & { contexts?: () => Array<{ pages: () => Page[] }> };
  const contexts = raw.contexts?.() || [];
  const pages: Page[] = [];
  for (const ctx of contexts) {
    try {
      pages.push(...ctx.pages());
    } catch {
      /* */
    }
  }
  return pages;
}

/** 挂上已开的 Chromium / Electron 调试口，读出页面上的字和控件位置。 */
export async function webAttach(
  repoRoot: string,
  opts: { port?: number; session?: string; hint?: string },
): Promise<Record<string, unknown>> {
  const hint = String(opts.hint || "");
  let port = Number(opts.port) || 0;
  if (!port) {
    if (await cdpAlive(9333)) port = 9333;
    else if (await cdpAlive(9222)) port = 9222;
  }
  if (!port) {
    return { ok: false, message: "这个软件没开网页调试口。改用窗口认字：nexus_window_see" };
  }
  const chromium = await loadChromium(repoRoot);
  if (!chromium?.connectOverCDP) return { ok: false, message: "没有 Playwright" };
  const id = String(opts.session || "desktop-web");
  const old = sessions.get(id);
  if (old) {
    sessions.delete(id);
    try {
      await old.browser.close();
    } catch {
      /* 断开调试连接，不关用户软件 */
    }
  }
  try {
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const pages = await pagesOf(browser);
    let best: Page | null = null;
    let bestScore = -99;
    let bestTitle = "";
    let bestUrl = "";
    for (const page of pages) {
      let title = "";
      let url = "";
      try {
        title = await page.title();
        url = page.url();
      } catch {
        continue;
      }
      const blob = `${title} ${url} ${hint}`;
      let score = 0;
      if (/汽水|qishui|douyin|music/i.test(blob)) score += 6;
      if (hint && (title.includes(hint) || url.includes(hint))) score += 4;
      if (url.startsWith("http")) score += 2;
      if (!url || url === "about:blank") score -= 3;
      if (score > bestScore) {
        bestScore = score;
        best = page;
        bestTitle = title;
        bestUrl = url;
      }
    }
    if (!best) {
      try {
        await browser.close();
      } catch {
        /* */
      }
      return { ok: false, message: "调试口上没有页面" };
    }
    if (port !== 9333 && hint && bestScore < 6) {
      try {
        await browser.close();
      } catch {
        /* */
      }
      return { ok: false, message: "调试口不是这个软件" };
    }
    best.setDefaultTimeout(20_000);
    const session: Session = { id, browser, page: best, lastUsed: Date.now() };
    sessions.set(id, session);
    const snap = await webSnapshot(repoRoot, { session: id, limit: 50 });
    return {
      ok: true,
      session: id,
      port,
      title: bestTitle,
      url: bestUrl,
      controls: snap.controls || [],
      texts: snap.texts || [],
      message: "已挂上页面",
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** 在已挂上的页面里找搜索框或「搜索」二字，填上并回车。 */
export async function webActSearch(
  repoRoot: string,
  opts: { session?: string; query: string },
): Promise<Record<string, unknown>> {
  const query = String(opts.query || "").trim();
  if (!query) return { ok: false, message: "缺少内容" };
  const got = await ensureSession(repoRoot, opts.session || "desktop-web");
  if (!got.ok) return got;
  const page = got.session.page as LivePage;
  try {
    const target = await page.evaluate(() => {
      const acc: Element[] = [];
      const walk = (root: ParentNode, depth: number) => {
        if (depth > 6 || acc.length > 800) return;
        let nodes: Element[] = [];
        try {
          nodes = Array.from(root.querySelectorAll("*"));
        } catch {
          nodes = [];
        }
        for (const el of nodes) {
          acc.push(el);
          const shadow = (el as HTMLElement).shadowRoot;
          if (shadow) walk(shadow, depth + 1);
        }
      };
      walk(document, 0);
      const vis = (el: Element) => {
        const e = el as HTMLElement;
        const r = e.getBoundingClientRect();
        const s = getComputedStyle(e);
        return r.width > 8 && r.height > 8 && s.visibility !== "hidden" && s.display !== "none";
      };
      let best: { x: number; y: number; kind: string; hint: string } | null = null;
      let bestScore = 0;
      for (const el of acc) {
        const e = el as HTMLElement;
        const tag = e.tagName;
        const editable =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          e.getAttribute("contenteditable") === "true" ||
          e.getAttribute("role") === "searchbox" ||
          e.getAttribute("role") === "textbox";
        if (!editable || !vis(e)) continue;
        const hint = `${e.getAttribute("placeholder") || ""} ${e.getAttribute("aria-label") || ""}`;
        const r = e.getBoundingClientRect();
        let score = 1;
        if (/搜索|搜歌|search/i.test(hint)) score += 8;
        if (r.top < 200 && r.width > 50) score += 2;
        if (score > bestScore) {
          bestScore = score;
          best = { x: r.x + r.width / 2, y: r.y + r.height / 2, kind: "input", hint: hint.trim().slice(0, 40) };
        }
      }
      if (best && bestScore >= 8) return best;
      for (const el of acc) {
        const e = el as HTMLElement;
        if (!vis(e)) continue;
        const own = Array.from(e.childNodes)
          .filter((n) => n.nodeType === 3)
          .map((n) => (n.textContent || "").replace(/\s+/g, ""))
          .join("");
        if (!own.includes("搜索") && own !== "搜") continue;
        const r = e.getBoundingClientRect();
        if (r.width > 360) continue;
        return { x: r.x + Math.min(24, r.width / 2), y: r.y + r.height / 2, kind: "text", hint: own.slice(0, 20) };
      }
      return best;
    });
    if (!target) return { ok: false, message: "页面上没找到搜索框" };
    await page.mouse.click(target.x, target.y);
    await page.keyboard.press("Control+A");
    await page.keyboard.type(query);
    await page.keyboard.press("Enter");
    touch(got.session);
    return { ok: true, message: "已在页面搜索", method: "web", target };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function playOnDesktopWeb(
  repoRoot: string,
  opts: { query: string; hint?: string },
): Promise<Record<string, unknown>> {
  const attached = await webAttach(repoRoot, { hint: opts.hint, session: "desktop-web" });
  if (!attached.ok) return attached;
  const acted = await webActSearch(repoRoot, { session: "desktop-web", query: opts.query });
  if (!acted.ok) {
    return {
      ...acted,
      controls: attached.controls,
      texts: attached.texts,
      url: attached.url,
    };
  }
  return { ...acted, title: attached.title, url: attached.url };
}
