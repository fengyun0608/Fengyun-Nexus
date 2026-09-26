/**
 * 抖音登录（对齐 douyin-spark/extract_cookie.py）：
 * Playwright 弹出真实 Chromium → 打开 www.douyin.com → 手机扫码 → 检测到 sessionid 后导出 Cookie。
 * 无图形界面时退回「粘贴 Cookie」。
 */
import { createServer, type Server } from "node:http";
import { networkInterfaces } from "node:os";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { findRepoRoot, mediaDataDir } from "./paths.js";

type SessionStatus =
  | "idle"
  | "launching"
  | "waiting"
  | "confirmed"
  | "expired"
  | "error";

type LoginSession = {
  id: string;
  status: SessionStatus;
  cookie: string;
  nickname?: string;
  error?: string;
  createdAt: number;
  mode: "browser" | "paste";
};

type PwCookie = { name: string; value: string; domain?: string };

type PageLike = {
  goto: (url: string, opts?: Record<string, unknown>) => Promise<unknown>;
  evaluate: <T>(fn: () => T | Promise<T>) => Promise<T>;
};

type PlaywrightMod = {
  chromium: {
    launch: (opts?: Record<string, unknown>) => Promise<{
      newContext: (opts?: Record<string, unknown>) => Promise<{
        newPage: () => Promise<PageLike>;
        cookies: () => Promise<PwCookie[]>;
        storageState: (opts: { path: string }) => Promise<unknown>;
      }>;
      close: () => Promise<void>;
    }>;
  };
};

function pickLanIp(): string {
  const nets = networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const n of list || []) {
      if (n.family === "IPv4" && !n.internal) return n.address;
    }
  }
  return "127.0.0.1";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function cookiesToHeader(cookies: PwCookie[]): string {
  const prefer = new Map<string, string>();
  for (const c of cookies) {
    const domain = String(c.domain || "");
    if (domain && !/douyin|amemv|snssdk|bytedance/i.test(domain)) continue;
    prefer.set(c.name, c.value);
  }
  if (!prefer.size) {
    for (const c of cookies) prefer.set(c.name, c.value);
  }
  return [...prefer.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

/** 从已登录页面或接口尽量取昵称 */
async function resolveNickname(page: PageLike | null, cookieHeader: string): Promise<string> {
  if (page) {
    try {
      const fromDom = await page.evaluate(() => {
        const pick = (sel: string) =>
          (document.querySelector(sel)?.textContent || "").replace(/\s+/g, " ").trim();
        const list = [
          pick('[data-e2e="user-info"]'),
          pick('[class*="nickname"]'),
          pick('[class*="Nickname"]'),
          pick('button[aria-label*="用户"]'),
        ].filter(Boolean);
        for (const t of list) {
          if (t && t.length >= 1 && t.length <= 40 && !/登录|下载|搜索|首页/.test(t)) return t;
        }
        return "";
      });
      if (fromDom) return fromDom;
    } catch {
      /* ignore */
    }
  }

  try {
    const res = await fetch(
      "https://www.douyin.com/passport/account/info/v2/?aid=6383&account_sdk_source=sso&sdk_version=2.2.7",
      {
        headers: {
          Cookie: cookieHeader,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Referer: "https://www.douyin.com/",
        },
        signal: AbortSignal.timeout(12_000),
      },
    );
    const data = (await res.json()) as {
      data?: { user?: { nickname?: string; name?: string }; account?: { name?: string } };
    };
    const name =
      data?.data?.user?.nickname ||
      data?.data?.user?.name ||
      data?.data?.account?.name ||
      "";
    if (name) return String(name).trim();
  } catch {
    /* ignore */
  }

  try {
    const res = await fetch(
      "https://www.douyin.com/aweme/v1/web/user/profile/self/?device_platform=webapp&aid=6383&channel=channel_pc_web&publish_video_strategy_type=2&source=channel_pc_web&personal_center_strategy=1&pc_client_type=1&version_code=170400&version_name=17.4.0&cookie_enabled=true&platform=PC",
      {
        headers: {
          Cookie: cookieHeader,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Referer: "https://www.douyin.com/",
        },
        signal: AbortSignal.timeout(12_000),
      },
    );
    const data = (await res.json()) as { user?: { nickname?: string } };
    if (data?.user?.nickname) return String(data.user.nickname).trim();
  } catch {
    /* ignore */
  }

  return "";
}

async function loadPlaywright(): Promise<PlaywrightMod | null> {
  const root = findRepoRoot();
  const tryPaths = [
    join(root, "packages/browser-shot/package.json"),
    join(root, "package.json"),
    join(root, "plugins/z-draw/package.json"),
  ];
  for (const pkgJson of tryPaths) {
    if (!existsSync(pkgJson)) continue;
    try {
      const req = createRequire(pkgJson);
      const mod = req("playwright") as PlaywrightMod;
      if (mod?.chromium) return mod;
    } catch {
      /* next */
    }
  }
  try {
    const mod = (await import("playwright")) as unknown as PlaywrightMod;
    if (mod?.chromium) return mod;
  } catch {
    /* ignore */
  }
  return null;
}

export type DouyinLoginHub = {
  port: number;
  lanUrl: string;
  localUrl: string;
  getSession: () => LoginSession;
  startBrowserLogin: () => Promise<LoginSession>;
  close: () => Promise<void>;
};

export type LoginSuccessInfo = {
  cookie: string;
  nickname: string;
  mode: "browser" | "paste";
};

export async function startDouyinLoginHub(opts: {
  port: number;
  onSuccess: (info: LoginSuccessInfo) => void | Promise<void>;
}): Promise<DouyinLoginHub> {
  let session: LoginSession = {
    id: randomBytes(4).toString("hex"),
    status: "idle",
    cookie: "",
    nickname: "",
    createdAt: Date.now(),
    mode: "browser",
  };
  let browserJob: Promise<void> | null = null;
  let browserAbort = false;

  const setSession = (patch: Partial<LoginSession>) => {
    session = { ...session, ...patch };
  };

  async function finishSuccess(cookie: string, nickname: string, mode: "browser" | "paste") {
    const name = nickname || "抖音账号";
    setSession({
      status: "confirmed",
      cookie,
      nickname: name,
      error: undefined,
      mode,
    });
    await opts.onSuccess({ cookie, nickname: name, mode });
  }

  async function runBrowserLogin(): Promise<void> {
    browserAbort = false;
    setSession({
      id: randomBytes(4).toString("hex"),
      status: "launching",
      cookie: "",
      nickname: "",
      error: undefined,
      createdAt: Date.now(),
      mode: "browser",
    });

    const pw = await loadPlaywright();
    if (!pw?.chromium) {
      setSession({
        status: "error",
        error:
          "未找到 Playwright。请到控制台「环境配置」安装浏览器，或本机执行：pnpm exec playwright install chromium",
      });
      return;
    }

    let browser: Awaited<ReturnType<PlaywrightMod["chromium"]["launch"]>> | null = null;
    try {
      browser = await pw.chromium.launch({
        headless: false,
        args: ["--disable-dev-shm-usage"],
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSession({
        status: "error",
        error: `无法弹出图形浏览器（${msg.slice(0, 120)}）。服务器无桌面时请用下方粘贴 Cookie。`,
      });
      return;
    }

    try {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        locale: "zh-CN",
      });
      const page = await context.newPage();
      setSession({ status: "waiting" });
      await page.goto("https://www.douyin.com/", {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });

      const deadline = Date.now() + 5 * 60_000;
      while (Date.now() < deadline && !browserAbort) {
        const cookies = await context.cookies();
        if (cookies.some((c) => String(c.name).startsWith("sessionid"))) {
          await sleep(2000);
          const fresh = await context.cookies();
          const header = cookiesToHeader(fresh);
          const dir = mediaDataDir();
          mkdirSync(dir, { recursive: true });
          try {
            await context.storageState({ path: join(dir, "douyin-state.json") });
          } catch {
            /* ignore */
          }
          writeFileSync(join(dir, "douyin.cookie.txt"), header, "utf8");
          const nickname = await resolveNickname(page, header);
          await finishSuccess(header, nickname, "browser");
          return;
        }
        await sleep(2000);
      }

      if (!browserAbort) {
        setSession({
          status: "expired",
          error: "5 分钟内未完成扫码，请点「打开抖音网页登录」再试",
        });
      }
    } catch (e) {
      setSession({
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
  }

  async function startBrowserLogin(): Promise<LoginSession> {
    if (browserJob) {
      return session;
    }
    browserJob = runBrowserLogin().finally(() => {
      browserJob = null;
    });
    // 稍等让 status 变成 launching/waiting
    await sleep(300);
    return session;
  }

  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://127.0.0.1`);
    const path = url.pathname;

    const json = (code: number, body: unknown) => {
      res.writeHead(code, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(body));
    };

    const readBody = async (): Promise<string> => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
      return Buffer.concat(chunks).toString("utf8");
    };

    try {
      if (path === "/" || path === "/douyin-login") {
        const auto = url.searchParams.get("auto") === "1";
        if (auto && session.status === "idle" && !browserJob) {
          void startBrowserLogin();
        }
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(renderLoginPage(session));
        return;
      }

      if (path === "/api/status") {
        json(200, {
          id: session.id,
          status: session.status,
          error: session.error || "",
          nickname: session.nickname || "",
          cookieReady: session.status === "confirmed" && Boolean(session.cookie),
          mode: session.mode,
          message:
            session.status === "confirmed"
              ? `恭喜，「${session.nickname || "抖音账号"}」登录成功`
              : "",
        });
        return;
      }

      if (path === "/api/browser-login" && (req.method === "POST" || req.method === "GET")) {
        const s = await startBrowserLogin();
        json(200, {
          ok: true,
          id: s.id,
          status: s.status,
          error: s.error || "",
          tip: "已请求弹出抖音网页，请在本机 Chromium 窗口里用手机扫码登录",
        });
        return;
      }

      if (path === "/api/cookie" && req.method === "POST") {
        const raw = await readBody();
        let cookie = "";
        try {
          const j = JSON.parse(raw) as { cookie?: string };
          cookie = String(j.cookie || "").trim();
        } catch {
          cookie = decodeURIComponent(raw.replace(/^cookie=/, "")).trim();
        }
        if (cookie.length < 20) return json(400, { ok: false, message: "Cookie 太短" });
        browserAbort = true;
        const nickname = await resolveNickname(null, cookie);
        await finishSuccess(cookie, nickname, "paste");
        json(200, {
          ok: true,
          message: `恭喜，「${nickname || "抖音账号"}」登录成功`,
          nickname: nickname || "抖音账号",
        });
        return;
      }

      res.writeHead(404);
      res.end("not found");
    } catch (e) {
      json(500, { ok: false, message: e instanceof Error ? e.message : String(e) });
    }
  });

  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(opts.port, "0.0.0.0", () => resolveListen());
  });

  const lan = pickLanIp();
  const hub: DouyinLoginHub = {
    port: opts.port,
    lanUrl: `http://${lan}:${opts.port}/douyin-login`,
    localUrl: `http://127.0.0.1:${opts.port}/douyin-login`,
    getSession: () => session,
    startBrowserLogin,
    close: () =>
      new Promise((resolveClose) => {
        browserAbort = true;
        server.close(() => resolveClose());
      }),
  };

  try {
    const dir = mediaDataDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "login-url.txt"), `${hub.lanUrl}\n${hub.localUrl}\n`, "utf8");
  } catch {
    /* ignore */
  }

  return hub;
}

function renderLoginPage(session: LoginSession): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>抖音登录 · 影链解析</title>
  <style>
    :root { color-scheme: light; --bg:#eef7f2; --ink:#16302a; --accent:#1f8a6e; --warn:#b45309; }
    body { margin:0; min-height:100vh; display:grid; place-items:center;
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      background: radial-gradient(1200px 600px at 20% 0%, #d7f3e7, transparent),
                  linear-gradient(160deg, #f7fffb, var(--bg)); color: var(--ink); }
    .card { width: min(480px, 92vw); background: rgba(255,255,255,.92); border:1px solid #cfe6db;
      border-radius: 18px; padding: 26px 22px 20px; box-shadow: 0 18px 50px rgba(22,48,42,.08); }
    h1 { margin:0 0 8px; font-size: 1.3rem; text-align:center; }
    p { margin: 0 0 12px; line-height: 1.55; opacity: .9; font-size: .92rem; }
    .status { margin: 14px 0; font-weight: 700; color: var(--accent); text-align:center; min-height: 1.5em; }
    .warn { color: var(--warn); font-weight: 600; }
    textarea { width: 100%; min-height: 88px; box-sizing: border-box; border-radius: 10px; border:1px solid #cfe6db;
      padding: 10px; font-size: .85rem; resize: vertical; }
    .row { display:flex; gap:8px; justify-content:center; flex-wrap:wrap; margin-top: 12px; }
    button { border:0; border-radius: 999px; padding: 11px 18px; background: var(--accent);
      color:#fff; font-weight:600; cursor:pointer; }
    button.ghost { background:#e7f3ee; color: var(--ink); }
    h2 { margin: 20px 0 8px; font-size: 1rem; }
    .hint { font-size: .85rem; opacity: .75; }
  </style>
</head>
<body>
  <div class="card">
    <h1>抖音登录</h1>
    <p>与续火花助手相同：本机会弹出<strong>真实抖音网页</strong>，用手机抖音 App 扫码登录。登录成功后 Cookie 自动写入机器人。</p>
    <div class="status" id="st">准备中…</div>
    <p class="hint" id="err"></p>
    <div class="row">
      <button type="button" id="btnOpen">打开抖音网页登录</button>
    </div>
    <h2>备用：粘贴 Cookie</h2>
    <p class="hint">仅当本机无法弹窗（例如无桌面的服务器）时使用。浏览器打开 <a href="https://www.douyin.com/" target="_blank" rel="noreferrer">www.douyin.com</a> 登录后，用 Cookie-Editor 导出字符串。</p>
    <textarea id="ck" placeholder="odin_tt=...; sessionid=...; ttwid=..."></textarea>
    <div class="row">
      <button type="button" class="ghost" id="btnSave">保存 Cookie</button>
    </div>
  </div>
  <script>
    const map = {
      idle: "点击下方按钮，打开真实抖音网页",
      launching: "正在启动浏览器…",
      waiting: "请在弹出的抖音窗口里扫码并确认",
      confirmed: "登录成功",
      expired: "已超时，请重新打开抖音登录",
      error: "出错了，可重试或改用粘贴 Cookie",
    };
    async function refresh() {
      try {
        const r = await fetch("/api/status");
        const j = await r.json();
        if (j.status === "confirmed") {
          document.getElementById("st").textContent =
            j.message || ("恭喜，「" + (j.nickname || "抖音账号") + "」登录成功");
          document.getElementById("err").textContent = "可以关闭本页了";
          return;
        }
        document.getElementById("st").textContent = map[j.status] || j.status;
        document.getElementById("err").textContent = j.error || "";
        document.getElementById("err").className = j.error ? "hint warn" : "hint";
      } catch (e) {
        document.getElementById("st").textContent = "状态读取失败";
      }
      setTimeout(refresh, 1500);
    }
    document.getElementById("btnOpen").onclick = async () => {
      document.getElementById("st").textContent = "正在启动浏览器…";
      await fetch("/api/browser-login", { method: "POST" });
      refresh();
    };
    document.getElementById("btnSave").onclick = async () => {
      const cookie = document.getElementById("ck").value.trim();
      if (!cookie) { document.getElementById("st").textContent = "请先粘贴 Cookie"; return; }
      const r = await fetch("/api/cookie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie }),
      });
      const j = await r.json();
      document.getElementById("st").textContent = j.ok
        ? (j.message || "登录成功")
        : (j.message || "保存失败");
      if (j.ok) document.getElementById("err").textContent = "可以关闭本页了";
    };
    refresh();
  </script>
</body>
</html>`;
}
