import { createServer, type Server } from "node:http";
import { networkInterfaces } from "node:os";
import { randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { mediaDataDir } from "./paths.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const SSO = "https://sso.douyin.com";
const SERVICE = "https://www.douyin.com";

type SessionStatus = "new" | "scanned" | "confirmed" | "expired" | "error";

type LoginSession = {
  id: string;
  verifyFp: string;
  token: string;
  status: SessionStatus;
  cookie: string;
  qrcodeBase64: string;
  error?: string;
  cookies: Map<string, string>;
  createdAt: number;
};

function genVerifyFp(): string {
  const t = Date.now();
  const table = "0123456789abcdefghijklmnopqrstuvwxyz";
  let n = t;
  let base36 = "";
  while (n > 0) {
    base36 = table[n % 36] + base36;
    n = Math.floor(n / 36);
  }
  const rand = randomBytes(18).toString("base64url").slice(0, 36);
  return `verify_${base36}_${rand}`;
}

function pickLanIp(): string {
  const nets = networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const n of list || []) {
      if (n.family === "IPv4" && !n.internal) return n.address;
    }
  }
  return "127.0.0.1";
}

function cookieHeader(jar: Map<string, string>): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function absorbSetCookie(jar: Map<string, string>, headers: Headers): void {
  const anyHeaders = headers as Headers & { getSetCookie?: () => string[] };
  const list =
    typeof anyHeaders.getSetCookie === "function"
      ? anyHeaders.getSetCookie()
      : String(headers.get("set-cookie") || "")
          .split(/,(?=[^;]+?=)/)
          .map((s) => s.trim())
          .filter(Boolean);
  for (const line of list) {
    const m = /^([^=]+)=([^;]*)/.exec(line);
    if (m) jar.set(m[1].trim(), m[2].trim());
  }
}

async function dyFetch(
  jar: Map<string, string>,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  if (!headers.has("User-Agent")) headers.set("User-Agent", UA);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json, text/plain, */*");
  }
  if (!headers.has("Referer")) headers.set("Referer", `${SERVICE}/`);
  if (!headers.has("Origin")) headers.set("Origin", SERVICE);
  headers.set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8");
  const c = cookieHeader(jar);
  if (c) headers.set("Cookie", c);
  const res = await fetch(url, {
    ...init,
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  absorbSetCookie(jar, res.headers);
  return res;
}

async function readJsonSafe(res: Response): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, message: `空响应 HTTP ${res.status}` };
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html") || trimmed.startsWith("<HTML")) {
    return {
      ok: false,
      message: "抖音返回了网页而不是接口数据（可能被风控）。请打开登录页用「粘贴 Cookie」备用方式。",
    };
  }
  try {
    return { ok: true, data: JSON.parse(trimmed) };
  } catch {
    return { ok: false, message: `响应不是 JSON（HTTP ${res.status}）` };
  }
}

async function followForCookies(jar: Map<string, string>, url: string): Promise<void> {
  let next = url;
  for (let i = 0; i < 8; i++) {
    const res = await dyFetch(jar, next);
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) break;
      next = new URL(loc, next).href;
      continue;
    }
    try {
      await res.arrayBuffer();
    } catch {
      /* ignore */
    }
    break;
  }
}

export type DouyinLoginHub = {
  port: number;
  lanUrl: string;
  localUrl: string;
  ensureSession: () => Promise<LoginSession>;
  getSession: (id?: string) => LoginSession | undefined;
  poll: (id: string) => Promise<LoginSession>;
  close: () => Promise<void>;
};

export async function startDouyinLoginHub(opts: {
  port: number;
  onCookie: (cookie: string) => void | Promise<void>;
}): Promise<DouyinLoginHub> {
  const sessions = new Map<string, LoginSession>();
  let currentId = "";

  async function createSession(): Promise<LoginSession> {
    const jar = new Map<string, string>();
    const verifyFp = genVerifyFp();
    jar.set("s_v_web_id", verifyFp);
    try {
      await dyFetch(jar, `${SERVICE}/`, {
        headers: { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
      });
    } catch {
      /* ignore */
    }
    try {
      await dyFetch(
        jar,
        `${SERVICE}/passport/general/login_guiding_strategy/?aid=6383`,
      );
    } catch {
      /* ignore */
    }

    const params = new URLSearchParams({
      service: SERVICE,
      need_logo: "false",
      need_short_url: "false",
      passport_jssdk_version: "1.0.22",
      aid: "6383",
      account_sdk_source: "sso",
      sdk_version: "2.2.7",
      language: "zh",
      verifyFp,
      fp: verifyFp,
    });
    const res = await dyFetch(jar, `${SSO}/get_qrcode/?${params}`);
    const parsed = await readJsonSafe(res);
    if (!parsed.ok) {
      // 仍创建空会话，登录页可走粘贴 Cookie
      const id = randomBytes(8).toString("hex");
      const session: LoginSession = {
        id,
        verifyFp,
        token: "",
        status: "error",
        cookie: "",
        qrcodeBase64: "",
        error: parsed.message,
        cookies: jar,
        createdAt: Date.now(),
      };
      sessions.set(id, session);
      currentId = id;
      return session;
    }
    const payload = parsed.data as {
      data?: { token?: string; qrcode?: string };
      message?: string;
    };
    const token = String(payload?.data?.token || "");
    const qrcodeBase64 = String(payload?.data?.qrcode || "");
    const id = randomBytes(8).toString("hex");
    const session: LoginSession = {
      id,
      verifyFp,
      token,
      status: token ? "new" : "error",
      cookie: "",
      qrcodeBase64,
      error: token ? undefined : "抖音未返回扫码 token，请用下方粘贴 Cookie",
      cookies: jar,
      createdAt: Date.now(),
    };
    sessions.set(id, session);
    currentId = id;
    for (const [k, s] of sessions) {
      if (k !== id && Date.now() - s.createdAt > 15 * 60_000) sessions.delete(k);
    }
    return session;
  }

  async function poll(id: string): Promise<LoginSession> {
    const session = sessions.get(id);
    if (!session) throw new Error("登录会话不存在或已过期");
    if (session.status === "confirmed" || session.status === "expired") return session;
    if (!session.token) {
      session.status = "error";
      return session;
    }

    const params = new URLSearchParams({
      service: SERVICE,
      need_logo: "false",
      need_short_url: "false",
      passport_jssdk_version: "1.0.22",
      aid: "6383",
      account_sdk_source: "sso",
      sdk_version: "2.2.7",
      language: "zh",
      verifyFp: session.verifyFp,
      fp: session.verifyFp,
      token: session.token,
    });
    const res = await dyFetch(session.cookies, `${SSO}/check_qrconnect/?${params}`);
    const parsed = await readJsonSafe(res);
    if (!parsed.ok) {
      session.error = parsed.message;
      return session;
    }
    const payload = parsed.data as {
      data?: { status?: string | number; redirect_url?: string };
    };
    const code = String(payload?.data?.status ?? "");
    if (code === "1") session.status = "new";
    else if (code === "2") session.status = "scanned";
    else if (code === "5") session.status = "expired";
    else if (code === "3" || code === "4" || payload?.data?.redirect_url) {
      session.status = "confirmed";
      const redirect = String(payload?.data?.redirect_url || "");
      if (redirect) await followForCookies(session.cookies, redirect);
      try {
        await dyFetch(session.cookies, `${SERVICE}/`);
      } catch {
        /* ignore */
      }
      session.cookie = cookieHeader(session.cookies);
      if (session.cookie) await opts.onCookie(session.cookie);
    }
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
        let session = currentId ? sessions.get(currentId) : undefined;
        const forceRefresh = url.searchParams.has("t") || url.searchParams.get("refresh") === "1";
        if (
          forceRefresh ||
          !session ||
          session.status === "expired" ||
          session.status === "confirmed"
        ) {
          session = await createSession();
        }
        const html = renderLoginPage(session);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        res.end(html);
        return;
      }

      if (path === "/api/session") {
        let session = currentId ? sessions.get(currentId) : undefined;
        if (!session || url.searchParams.get("refresh") === "1") {
          session = await createSession();
        }
        json(200, {
          id: session.id,
          status: session.status,
          hasQr: Boolean(session.qrcodeBase64),
          error: session.error || "",
          qrcodeDataUrl: session.qrcodeBase64
            ? `data:image/png;base64,${session.qrcodeBase64}`
            : "",
        });
        return;
      }

      if (path === "/api/poll") {
        const id = url.searchParams.get("id") || currentId;
        if (!id) return json(400, { ok: false, message: "缺少会话" });
        const session = await poll(id);
        json(200, {
          ok: true,
          id: session.id,
          status: session.status,
          cookieReady: session.status === "confirmed" && Boolean(session.cookie),
          error: session.error || "",
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
        await opts.onCookie(cookie);
        if (currentId && sessions.get(currentId)) {
          const s = sessions.get(currentId)!;
          s.status = "confirmed";
          s.cookie = cookie;
        }
        json(200, { ok: true, message: "已保存 Cookie" });
        return;
      }

      if (path === "/qr.png") {
        const session = currentId ? sessions.get(currentId) : undefined;
        if (!session?.qrcodeBase64) {
          res.writeHead(404);
          res.end("no qr");
          return;
        }
        const buf = Buffer.from(session.qrcodeBase64, "base64");
        res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
        res.end(buf);
        return;
      }

      res.writeHead(404);
      res.end("not found");
    } catch (e) {
      json(500, { ok: false, message: e instanceof Error ? e.message : String(e) });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port, "0.0.0.0", () => resolve());
  });

  const lan = pickLanIp();
  const hub: DouyinLoginHub = {
    port: opts.port,
    lanUrl: `http://${lan}:${opts.port}/douyin-login`,
    localUrl: `http://127.0.0.1:${opts.port}/douyin-login`,
    ensureSession: createSession,
    getSession: (id) => sessions.get(id || currentId),
    poll,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
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
  const hasQr = Boolean(session.qrcodeBase64);
  const img = hasQr
    ? `<img id="qr" alt="抖音登录二维码" src="data:image/png;base64,${session.qrcodeBase64}" />`
    : `<p class="warn">扫码暂时不可用，请用下方粘贴 Cookie。</p>`;
  const err = session.error
    ? `<p class="warn">${escapeHtml(session.error)}</p>`
    : "";
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
    .card { width: min(460px, 92vw); background: rgba(255,255,255,.9); border:1px solid #cfe6db;
      border-radius: 18px; padding: 26px 22px 20px; box-shadow: 0 18px 50px rgba(22,48,42,.08); text-align:center; }
    h1 { margin:0 0 8px; font-size: 1.3rem; }
    p { margin: 0 0 12px; line-height: 1.55; opacity: .88; font-size: .92rem; text-align:left; }
    img { width: 220px; height: 220px; border-radius: 12px; background:#fff; border:1px solid #d9ebe2; }
    .status { margin-top: 12px; font-weight: 600; color: var(--accent); min-height: 1.4em; text-align:center; }
    .warn { color: var(--warn); opacity: 1; }
    textarea { width: 100%; min-height: 88px; box-sizing: border-box; border-radius: 10px; border:1px solid #cfe6db;
      padding: 10px; font-size: .85rem; resize: vertical; }
    .row { display:flex; gap:8px; justify-content:center; flex-wrap:wrap; margin-top: 12px; }
    button { border:0; border-radius: 999px; padding: 10px 16px; background: var(--accent);
      color:#fff; font-weight:600; cursor:pointer; }
    button.ghost { background:#e7f3ee; color: var(--ink); }
    h2 { margin: 18px 0 8px; font-size: 1rem; text-align:left; }
  </style>
</head>
<body>
  <div class="card">
    <h1>抖音登录</h1>
    <p>方式一：抖音 App 扫码并确认（成功后 Cookie 自动写入机器人）。</p>
    ${err}
    ${img}
    <div class="status" id="st">${hasQr ? "等待扫码…" : "请用粘贴 Cookie"}</div>
    <div class="row">
      <button type="button" id="btnRefresh">刷新二维码</button>
    </div>
    <h2>方式二：粘贴 Cookie</h2>
    <p>浏览器打开 <a href="https://www.douyin.com/" target="_blank" rel="noreferrer">www.douyin.com</a> 并登录，用 Cookie-Editor 导出字符串粘贴到下面保存。</p>
    <textarea id="ck" placeholder="odin_tt=...; sessionid=...; ttwid=..."></textarea>
    <div class="row">
      <button type="button" id="btnSave">保存 Cookie</button>
    </div>
  </div>
  <script>
    let id = ${JSON.stringify(session.id)};
    const map = { new: "等待扫码…", scanned: "已扫码，请在手机上确认", confirmed: "登录成功，可以关闭本页", expired: "二维码已过期，请刷新", error: "扫码不可用，请粘贴 Cookie" };
    document.getElementById("btnRefresh").onclick = () => { location.href = "/douyin-login?t=" + Date.now(); };
    document.getElementById("btnSave").onclick = async () => {
      const cookie = document.getElementById("ck").value.trim();
      if (!cookie) { document.getElementById("st").textContent = "请先粘贴 Cookie"; return; }
      const r = await fetch("/api/cookie", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cookie }) });
      const j = await r.json();
      document.getElementById("st").textContent = j.ok ? "Cookie 已保存，可以关闭本页" : (j.message || "保存失败");
    };
    async function tick() {
      if (!${hasQr ? "true" : "false"}) return;
      try {
        const r = await fetch("/api/poll?id=" + encodeURIComponent(id));
        const j = await r.json();
        document.getElementById("st").textContent = j.error || map[j.status] || j.status || "…";
        if (j.status === "confirmed" || j.status === "expired") return;
      } catch (e) {
        document.getElementById("st").textContent = "轮询失败，可改用粘贴 Cookie";
      }
      setTimeout(tick, 2000);
    }
    tick();
  </script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function saveQrPng(session: LoginSession): Promise<string | null> {
  if (!session.qrcodeBase64) return null;
  const dir = mediaDataDir();
  const path = join(dir, `douyin-qr-${session.id}.png`);
  writeFileSync(path, Buffer.from(session.qrcodeBase64, "base64"));
  return path;
}
