import { createServer, type Server } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { OneBot11Channel, type Ob11MessageEvent } from "@fengyun/nexus-channel";
import type { NexusMessage } from "@fengyun/nexus-shared";
import { log } from "./log.js";

/** NapCat 吃不稳中文路径的 file://，也不认 SVG；本地图改 base64:// */
function rewriteCqImagesForOneBot(text: string): string {
  return text.replace(/\[CQ:image,file=([^\]]+)\]/gi, (_all, raw: string) => {
    const src = String(raw || "").trim();
    if (!src) return "[CQ:image,file=]";
    if (/^(base64|https?):\/\//i.test(src)) return `[CQ:image,file=${src}]`;
    let filePath = src;
    try {
      if (/^file:/i.test(src)) filePath = fileURLToPath(src);
    } catch {
      return "（图片路径无效）";
    }
    if (!existsSync(filePath)) return "（图片文件不存在）";
    if (/\.svg$/i.test(filePath)) {
      return "（未装浏览器运行时，菜单图未能发给 QQ。可在控制台「环境配置」安装 Chromium，或网页对话里查看。）";
    }
    if (!/\.(png|jpe?g|gif|webp|bmp)$/i.test(filePath)) {
      return "（不支持的图片格式）";
    }
    try {
      const b64 = readFileSync(filePath).toString("base64");
      return `[CQ:image,file=base64://${b64}]`;
    } catch (e) {
      log.warn(`OneBot 读图失败：${e instanceof Error ? e.message : String(e)}`);
      return "（读图失败）";
    }
  });
}

export type OneBotBotConfig = {
  /** 机器人 QQ；空则连上后再认 */
  selfId?: string;
  label?: string;
  /** 这个号反向连到咱们网关的端口。例如后台填 3000，就在 3000 上接它 */
  listenPort?: number;
  /** 仅在反向连不上时才用的 NapCat HTTP。不要填咱们自己的端口 */
  apiBase?: string;
  accessToken?: string;
};

export type OneBotConfig = {
  enabled: boolean;
  accessToken: string;
  reverseWsPath: string;
  httpPath: string;
  docsUrl: string;
  /** 多 QQ 号：各号可指定 HTTP API 端口；反向 WS 仍可共用一条 path */
  bots: OneBotBotConfig[];
};

export type OneBotStatus = {
  enabled: boolean;
  connected: boolean;
  clients: number;
  selfId: string;
  reverseWsPath: string;
  httpPath: string;
  docsUrl: string;
  accessTokenSet: boolean;
  lastEventAt?: string;
  bots: Array<{
    selfId: string;
    label: string;
    connected: boolean;
    apiBase: string;
    listenPort: number;
  }>;
};

export type Ob11CallResult = {
  ok: boolean;
  data?: unknown;
  retcode?: number;
  message?: string;
};

export type Ob11NoticeEvent = Record<string, unknown> & {
  post_type?: string;
  notice_type?: string;
  sub_type?: string;
  group_id?: number | string;
  user_id?: number | string;
  operator_id?: number | string;
  duration?: number;
  self_id?: number | string;
};

type InboundHandler = (msg: NexusMessage) => Promise<string[]>;
type NoticeHandler = (ev: Ob11NoticeEvent) => Promise<string[]>;

type Pending = {
  resolve: (r: Ob11CallResult) => void;
  timer: ReturnType<typeof setTimeout>;
  action: string;
};

type SockMeta = { selfId: string; listenPort: number };

/**
 * OneBot 11 bridge for NapCat / go-cqhttp.
 * - Reverse WS: NapCat「WS 客户端」连到本框架（可多号同 path）
 * - HTTP: NapCat「HTTP 客户端」上报事件
 * - callAction：WS echo 或按 bot.apiBase 走 HTTP（多端口）
 */
export class OneBot11Bridge {
  readonly channel = new OneBot11Channel();
  private wss?: WebSocketServer;
  private sockets = new Set<WebSocket>();
  private sockMeta = new WeakMap<WebSocket, SockMeta>();
  private selfId = "";
  private gatewayPort = 0;
  private lastEventAt?: string;
  private echoSeq = 0;
  private pending = new Map<string, Pending>();
  private onInbound?: InboundHandler;
  private onNotice?: NoticeHandler;
  private onSelfId?: (selfId: string, listenPort?: number) => void;
  private extra = new Map<number, { server: Server; wss: WebSocketServer }>();

  constructor(private cfg: OneBotConfig) {}

  setInboundHandler(fn: InboundHandler): void {
    this.onInbound = fn;
  }

  setNoticeHandler(fn: NoticeHandler): void {
    this.onNotice = fn;
  }

  setSelfIdHandler(fn: (selfId: string, listenPort?: number) => void): void {
    this.onSelfId = fn;
  }

  setGatewayPort(port: number): void {
    this.gatewayPort = Math.floor(Number(port) || 0);
  }

  /** 写成网关自己的端口不算 NapCat 接口，留空走反向连接。 */
  napcatApi(raw?: string): string {
    const s = String(raw || "").trim().replace(/\/$/, "");
    if (!s) return "";
    try {
      const u = new URL(s);
      const port = Number(u.port || (u.protocol === "https:" ? 443 : 80));
      if (this.gatewayPort && port === this.gatewayPort) return "";
    } catch {
      return "";
    }
    return s;
  }

  private noteSelfId(sid: string, listenPort = 0): void {
    if (!sid) return;
    this.selfId = sid;
    try {
      this.onSelfId?.(sid, listenPort);
    } catch {
      /* ignore */
    }
  }

  private bindIdentity(ws: WebSocket, sid: string): void {
    const prev = this.sockMeta.get(ws) || { selfId: "", listenPort: 0 };
    const listenPort = prev.listenPort;
    if (prev.selfId === sid) return;
    this.sockMeta.set(ws, { selfId: sid, listenPort });
    const label =
      (this.cfg.bots || []).find((b) => Number(b.listenPort) === listenPort && listenPort)?.label ||
      (this.cfg.bots || []).find((b) => String(b.selfId || "") === sid)?.label ||
      "新号";
    log.ok(`消息通道已连接  ${label}  QQ=${sid}${listenPort ? `  端口=${listenPort}` : ""}`);
    this.noteSelfId(sid, listenPort);
  }

  updateConfig(next: Partial<OneBotConfig>): void {
    this.cfg = {
      ...this.cfg,
      ...next,
      bots: Array.isArray(next.bots) ? next.bots : this.cfg.bots,
    };
    this.syncListenPorts();
  }

  getConfig(): OneBotConfig {
    return {
      ...this.cfg,
      bots: [...(this.cfg.bots || [])],
    };
  }

  listConnectedSelfIds(): string[] {
    const ids = new Set<string>();
    for (const ws of this.sockets) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const sid = this.sockMeta.get(ws)?.selfId;
      if (sid) ids.add(sid);
    }
    if (this.selfId) ids.add(this.selfId);
    return [...ids];
  }

  status(): OneBotStatus {
    const bots = (this.cfg.bots || []).map((b) => {
      const sid = String(b.selfId || "").trim();
      const listenPort = Math.floor(Number(b.listenPort) || 0);
      return {
        selfId: sid,
        label: b.label || (sid ? `QQ ${sid}` : "未备注"),
        connected: this.botOnline(sid, listenPort),
        apiBase: this.napcatApi(b.apiBase),
        listenPort,
      };
    });
    for (const ws of this.sockets) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const sid = this.sockMeta.get(ws)?.selfId || "";
      if (!sid || bots.some((b) => b.selfId === sid)) continue;
      bots.push({
        selfId: sid,
        label: `QQ ${sid}`,
        connected: true,
        apiBase: "",
        listenPort: this.sockMeta.get(ws)?.listenPort || 0,
      });
    }
    return {
      enabled: this.cfg.enabled,
      connected: this.sockets.size > 0,
      clients: this.sockets.size,
      selfId: this.selfId,
      reverseWsPath: this.cfg.reverseWsPath,
      httpPath: this.cfg.httpPath,
      docsUrl: this.cfg.docsUrl,
      accessTokenSet: Boolean(this.cfg.accessToken),
      lastEventAt: this.lastEventAt,
      bots,
    };
  }

  /** 这个号的反向端口上有连接，或 QQ 已经对上，都算已连接。 */
  private botOnline(selfId: string, listenPort: number): boolean {
    for (const ws of this.sockets) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const meta = this.sockMeta.get(ws);
      if (!meta) continue;
      if (selfId && meta.selfId === selfId) return true;
      if (listenPort > 0 && meta.listenPort === listenPort) return true;
    }
    return false;
  }

  private wireSocket(ws: WebSocket, listenPort: number): void {
    this.sockets.add(ws);
    this.sockMeta.set(ws, { selfId: "", listenPort });
    const label = (this.cfg.bots || []).find((b) => Number(b.listenPort) === listenPort && listenPort)?.label;
    log.ok(
      `OneBot 11 已连接  ${label || "通道"}  端口=${listenPort || this.gatewayPort}  clients=${this.sockets.size}`,
    );
    try {
      ws.send(JSON.stringify({ action: "get_login_info", params: {}, echo: `nx_login_${++this.echoSeq}` }));
    } catch {
      /* 连上再问 QQ */
    }
    ws.on("message", (data) => {
      void this.onSocketMessage(ws, data.toString());
    });
    ws.on("close", () => {
      this.sockets.delete(ws);
      log.warn(`OneBot 11 断开  ${label || "通道"}  clients=${this.sockets.size}`);
    });
    ws.on("error", () => {
      this.sockets.delete(ws);
    });
  }

  /** 按各号填写的端口另开反向入口。3000 这类是咱们听的，不是 NapCat 自己的口。 */
  syncListenPorts(): void {
    const path = this.cfg.reverseWsPath || "/onebot/v11/ws";
    const ports = new Set<number>();
    for (const b of this.cfg.bots || []) {
      const p = Math.floor(Number(b.listenPort) || 0);
      if (p > 0 && p < 65536 && p !== this.gatewayPort) ports.add(p);
    }
    for (const [port, rec] of this.extra) {
      if (ports.has(port)) continue;
      try {
        rec.wss.close();
        rec.server.close();
      } catch {
        /* ignore */
      }
      this.extra.delete(port);
    }
    for (const port of ports) {
      if (this.extra.has(port)) continue;
      const server = createServer();
      const wss = new WebSocketServer({ noServer: true });
      server.on("upgrade", (req, socket, head) => {
        let pathname = "/";
        try {
          pathname = new URL(req.url ?? "/", "http://localhost").pathname;
        } catch {
          socket.destroy();
          return;
        }
        if (pathname !== path && pathname !== `${path}/`) {
          socket.destroy();
          return;
        }
        const url = new URL(req.url ?? "/", "http://localhost");
        if (!this.authOk(req.headers.authorization, url.searchParams.get("access_token"), port)) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
          this.wireSocket(ws, port);
        });
      });
      server.on("error", (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        log.warn(`反向端口 ${port} 没打开：${msg}`);
        this.extra.delete(port);
      });
      server.listen(port, "0.0.0.0", () => {
        log.ok(`反向端口已打开 ${port}  ws://0.0.0.0:${port}${path}`);
      });
      this.extra.set(port, { server, wss });
    }
  }

  attach(server: Server): void {
    if (!this.cfg.enabled) {
      log.info("OneBot 11 未启用");
      return;
    }
    this.wss = new WebSocketServer({ noServer: true });
    server.on("upgrade", (req, socket, head) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname !== this.cfg.reverseWsPath) return;
      if (!this.authOk(req.headers.authorization, url.searchParams.get("access_token"), this.gatewayPort)) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      this.wss!.handleUpgrade(req, socket, head, (ws) => {
        this.wireSocket(ws, this.gatewayPort);
      });
    });
    this.syncListenPorts();
    log.info(`OneBot 11 反向 WS 就绪  path=${this.cfg.reverseWsPath}`);
  }

  private expectedToken(listenPort: number): string {
    const bots = this.cfg.bots || [];
    if (listenPort > 0) {
      const exact = bots.find((b) => Math.floor(Number(b.listenPort) || 0) === listenPort);
      const own = String(exact?.accessToken || "").trim();
      if (own) return own;
    }
    if (!listenPort || listenPort === this.gatewayPort) {
      const shared = bots.find((b) => !Number(b.listenPort) && String(b.accessToken || "").trim());
      const own = String(shared?.accessToken || "").trim();
      if (own) return own;
    }
    return String(this.cfg.accessToken || "").trim();
  }

  private authOk(authorization?: string, queryToken?: string | null, listenPort = 0): boolean {
    const token = this.expectedToken(listenPort);
    if (!token) return true;
    const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    return bearer === token || queryToken === token;
  }

  checkHttpAuth(authorization?: string, queryToken?: string | null): boolean {
    return this.authOk(authorization, queryToken);
  }

  private async onSocketMessage(ws: WebSocket, raw: string): Promise<void> {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }

    if (data.echo != null && (data.status != null || data.retcode != null)) {
      const echo = String(data.echo);
      const pend = this.pending.get(echo);
      if (pend) {
        clearTimeout(pend.timer);
        this.pending.delete(echo);
        const status = String(data.status || "");
        const retcode = Number(data.retcode ?? (status === "ok" || status === "async" ? 0 : -1));
        const message =
          data.message != null
            ? String(data.message)
            : data.wording != null
              ? String(data.wording)
              : undefined;
        const ok = retcode === 0 || status === "ok" || status === "async";
        if (!ok) {
          const tip = (message || "无说明").replace(/\s+/g, " ").slice(0, 180);
          log.warn(`OneBot ${pend.action} 失败 ret=${retcode} ${tip}`);
        }
        pend.resolve({
          ok,
          data: data.data,
          retcode,
          message,
        });
      }
      const payload = data.data;
      if (payload && typeof payload === "object" && "user_id" in payload) {
        const uid = (payload as { user_id?: unknown }).user_id;
        if (uid != null && String(uid)) this.bindIdentity(ws, String(uid));
      }
      return;
    }

    if (data.post_type === "meta_event") {
      if (data.self_id != null) this.bindIdentity(ws, String(data.self_id));
      return;
    }

    if (data.self_id != null) {
      this.bindIdentity(ws, String(data.self_id));
    }

    if (data.post_type === "message_sent") return;

    if (data.post_type === "notice") {
      await this.handleNotice(data as Ob11NoticeEvent, ws);
      return;
    }

    if (data.post_type === "message" || data.message_type) {
      await this.handleEvent(data as Ob11MessageEvent, ws);
    }
  }

  async handleHttpEvent(raw: unknown): Promise<{ ok: boolean; replied: number }> {
    const ev = (raw ?? {}) as Ob11MessageEvent & Ob11NoticeEvent;
    if (ev.post_type === "meta_event") {
      if (ev.self_id != null) this.selfId = String(ev.self_id);
      return { ok: true, replied: 0 };
    }
    if (ev.post_type === "message_sent") {
      return { ok: true, replied: 0 };
    }
    if (ev.post_type === "notice") {
      const texts = await this.handleNotice(ev);
      return { ok: true, replied: texts };
    }
    if (ev.post_type !== "message" && !ev.message_type) {
      return { ok: true, replied: 0 };
    }
    const replies = await this.handleEvent(ev);
    return { ok: true, replied: replies };
  }

  private async handleNotice(ev: Ob11NoticeEvent, prefer?: WebSocket): Promise<number> {
    this.lastEventAt = new Date().toISOString();
    if (ev.self_id != null) this.selfId = String(ev.self_id);
    if (!this.onNotice) return 0;
    const texts = await this.onNotice(ev);
    let n = 0;
    const gid = ev.group_id != null ? String(ev.group_id) : "";
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      if (!text?.trim() || !gid) continue;
      if (i > 0) await sleep(300);
      await this.sendTextToGroup(gid, text, prefer);
      n += 1;
    }
    return n;
  }

  private openSockets(prefer?: WebSocket, botId?: string): WebSocket[] {
    if (prefer && prefer.readyState === WebSocket.OPEN) return [prefer];
    const want = String(botId || "").trim();
    if (want) {
      for (const ws of this.sockets) {
        if (ws.readyState !== WebSocket.OPEN) continue;
        if (this.sockMeta.get(ws)?.selfId === want) return [ws];
      }
    }
    for (const ws of this.sockets) {
      if (ws.readyState === WebSocket.OPEN) return [ws];
    }
    return [];
  }

  private findBotCfg(botId?: string): OneBotBotConfig | undefined {
    const want = String(botId || "").trim();
    const bots = this.cfg.bots || [];
    if (want) {
      const hit = bots.find((b) => String(b.selfId || "").trim() === want);
      if (hit) return hit;
    }
    return bots.find((b) => String(b.apiBase || "").trim()) || bots[0];
  }

  /**
   * 调 OneBot API：优先匹配 botId 的 WS；否则用该号的 apiBase HTTP；再否则任意已连接 WS。
   */
  async callAction(
    action: string,
    params: Record<string, unknown> = {},
    opts?: { botId?: string; timeoutMs?: number; prefer?: WebSocket },
  ): Promise<Ob11CallResult> {
    const echo = `nx_${++this.echoSeq}`;
    const timeoutMs = opts?.timeoutMs ?? 12_000;
    const bot = this.findBotCfg(opts?.botId);
    const targets = this.openSockets(opts?.prefer, opts?.botId || bot?.selfId);

    if (targets.length) {
      return new Promise<Ob11CallResult>((resolve) => {
        const timer = setTimeout(() => {
          this.pending.delete(echo);
          resolve({ ok: false, message: "OneBot 调用超时" });
        }, timeoutMs);
        this.pending.set(echo, { resolve, timer, action });
        try {
          targets[0].send(JSON.stringify({ action, params, echo }));
        } catch (e) {
          clearTimeout(timer);
          this.pending.delete(echo);
          resolve({
            ok: false,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      });
    }

    const apiBase = this.napcatApi(bot?.apiBase);
    if (apiBase) {
      try {
        const token = bot?.accessToken || this.cfg.accessToken || "";
        const headers: Record<string, string> = {
          "content-type": "application/json",
        };
        if (token) headers.authorization = `Bearer ${token}`;
        const res = await fetch(`${apiBase}/${action}`, {
          method: "POST",
          headers,
          body: JSON.stringify(params),
          signal: AbortSignal.timeout(timeoutMs),
        });
        const j = (await res.json()) as Record<string, unknown>;
        const retcode = Number(j.retcode ?? (res.ok ? 0 : -1));
        return {
          ok: retcode === 0,
          data: j.data,
          retcode,
          message: j.message != null ? String(j.message) : j.wording != null ? String(j.wording) : undefined,
        };
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : String(e) };
      }
    }

    return { ok: false, message: "没有可用的 OneBot 连接，请在控制台配置 apiBase 或连上反向 WS" };
  }

  private recentMsgIds = new Set<string>();

  private async handleEvent(ev: Ob11MessageEvent, prefer?: WebSocket): Promise<number> {
    this.lastEventAt = new Date().toISOString();
    if (ev.self_id != null) this.selfId = String(ev.self_id);

    const uid = String(ev.user_id ?? ev.sender?.user_id ?? "");
    const sid = this.selfId || (ev.self_id != null ? String(ev.self_id) : "");
    if (sid && uid && uid === sid) {
      log.debug(`忽略自身消息 user=${uid}`);
      return 0;
    }

    const mid = ev.message_id != null ? String(ev.message_id) : "";
    if (mid) {
      if (this.recentMsgIds.has(mid)) {
        log.debug(`忽略重复消息 id=${mid}`);
        return 0;
      }
      this.recentMsgIds.add(mid);
      if (this.recentMsgIds.size > 400) {
        const first = this.recentMsgIds.values().next().value;
        if (first) this.recentMsgIds.delete(first);
      }
    }

    const msg = this.channel.normalizeInbound(ev);
    if (!msg.content.trim()) return 0;
    if (!this.onInbound) return 0;
    if (sid) {
      msg.meta = { ...msg.meta, botId: sid, selfId: sid };
    }
    log.info(
      `OneBot 入站  ${msg.meta?.messageType ?? "?"}  bot=${sid || "?"}  user=${msg.userId}  ${msg.content.slice(0, 80)}`,
    );
    const texts = await this.onInbound(msg);
    let n = 0;
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      if (!text.trim()) continue;
      if (i > 0) await sleep(380 + Math.floor(Math.random() * 320));
      await this.sendText(text, msg, prefer);
      n += 1;
    }
    return n;
  }

  async sendText(text: string, ctx: NexusMessage, prefer?: WebSocket): Promise<boolean> {
    const payload = rewriteCqImagesForOneBot(text);
    const params = this.channel.toSendParams({
      ...ctx,
      content: payload,
      userId: ctx.userId,
    });
    const botId = String(ctx.meta?.botId || ctx.meta?.selfId || "");
    const r = await this.callAction("send_msg", params as Record<string, unknown>, {
      botId: botId || undefined,
      prefer,
    });
    return r.ok;
  }

  /**
   * 合并转发：多段节点，显示为「匿名用户」。
   */
  async sendForward(
    nodes: string[],
    ctx: NexusMessage,
    opts?: { nickname?: string; userId?: string; prefer?: WebSocket },
  ): Promise<boolean> {
    const texts = nodes.map((n) => String(n).trim()).filter(Boolean);
    if (!texts.length) return false;

    const nickname = opts?.nickname || "匿名用户";
    const uinNum = Number(opts?.userId || "80000000") || 80000000;
    const messages = texts.map((text) => ({
      type: "node",
      data: {
        name: nickname,
        uin: String(uinNum),
        user_id: uinNum,
        nickname,
        content: [{ type: "text", data: { text } }],
      },
    }));

    const mt = (ctx.meta?.messageType as string | undefined) ?? "private";
    let action = "send_private_forward_msg";
    let params: Record<string, unknown> = {
      user_id: Number(ctx.userId) || 0,
      messages,
    };
    if (mt === "group") {
      const gid = Number(ctx.meta?.groupId ?? String(ctx.chatId).replace(/^group:/, ""));
      action = "send_group_forward_msg";
      params = { group_id: gid, messages };
    }

    const botId = String(ctx.meta?.botId || ctx.meta?.selfId || "");
    const r = await this.callAction(action, params, {
      botId: botId || undefined,
      prefer: opts?.prefer,
    });
    return r.ok;
  }

  async sendForwardToGroup(groupId: string, nodes: string[]): Promise<boolean> {
    const ctx: NexusMessage = {
      id: `fwd-${Date.now()}`,
      channel: "onebot11",
      chatId: `group:${groupId}`,
      userId: "80000000",
      type: "text",
      content: "",
      meta: { messageType: "group", groupId: String(groupId) },
      createdAt: new Date().toISOString(),
    };
    return this.sendForward(nodes, ctx);
  }

  async sendTextToGroup(groupId: string, text: string, prefer?: WebSocket): Promise<boolean> {
    const ctx: NexusMessage = {
      id: `txt-${Date.now()}`,
      channel: "onebot11",
      chatId: `group:${groupId}`,
      userId: "0",
      type: "text",
      content: text,
      meta: { messageType: "group", groupId: String(groupId) },
      createdAt: new Date().toISOString(),
    };
    return this.sendText(text, ctx, prefer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
