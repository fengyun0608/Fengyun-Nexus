import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { OneBot11Channel, type Ob11MessageEvent } from "@fengyun/nexus-channel";
import type { NexusMessage } from "@fengyun/nexus-shared";
import { log } from "./log.js";

export type OneBotConfig = {
  enabled: boolean;
  accessToken: string;
  reverseWsPath: string;
  httpPath: string;
  docsUrl: string;
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
};

type InboundHandler = (msg: NexusMessage) => Promise<string[]>;

/**
 * OneBot 11 bridge for NapCat / go-cqhttp.
 * - Reverse WS: NapCat「WS 客户端」连到本框架
 * - HTTP: NapCat「HTTP 客户端」上报事件
 */
export class OneBot11Bridge {
  readonly channel = new OneBot11Channel();
  private wss?: WebSocketServer;
  private sockets = new Set<WebSocket>();
  private selfId = "";
  private lastEventAt?: string;
  private echoSeq = 0;
  private onInbound?: InboundHandler;

  constructor(private cfg: OneBotConfig) {}

  setInboundHandler(fn: InboundHandler): void {
    this.onInbound = fn;
  }

  updateConfig(next: Partial<OneBotConfig>): void {
    this.cfg = { ...this.cfg, ...next };
  }

  getConfig(): OneBotConfig {
    return { ...this.cfg };
  }

  status(): OneBotStatus {
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
    };
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
      if (!this.authOk(req.headers.authorization, url.searchParams.get("access_token"))) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      this.wss!.handleUpgrade(req, socket, head, (ws) => {
        this.wss!.emit("connection", ws, req);
      });
    });

    this.wss.on("connection", (ws) => {
      this.sockets.add(ws);
      log.ok(`OneBot 11 已连接  clients=${this.sockets.size}`);
      ws.on("message", (data) => {
        void this.onSocketMessage(ws, data.toString());
      });
      ws.on("close", () => {
        this.sockets.delete(ws);
        log.warn(`OneBot 11 断开  clients=${this.sockets.size}`);
      });
      ws.on("error", () => {
        this.sockets.delete(ws);
      });
    });
    log.info(`OneBot 11 反向 WS 就绪  path=${this.cfg.reverseWsPath}`);
  }

  private authOk(authorization?: string, queryToken?: string | null): boolean {
    if (!this.cfg.accessToken) return true;
    const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    return bearer === this.cfg.accessToken || queryToken === this.cfg.accessToken;
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
    // API response from bot
    if (data.echo != null && data.status != null) return;
    if (data.post_type === "meta_event") {
      if (data.meta_event_type === "lifecycle" && data.self_id != null) {
        this.selfId = String(data.self_id);
      }
      return;
    }
    // 自己发出的消息回传（NapCat message_sent）→ 绝不能再当入站，否则会 AI 复读刷屏
    if (data.post_type === "message_sent" || data.post_type === "notice") {
      return;
    }
    if (data.post_type === "message" || data.message_type) {
      await this.handleEvent(data as Ob11MessageEvent, ws);
    }
  }

  async handleHttpEvent(raw: unknown): Promise<{ ok: boolean; replied: number }> {
    const ev = (raw ?? {}) as Ob11MessageEvent;
    if (ev.post_type === "meta_event") {
      if (ev.self_id != null) this.selfId = String(ev.self_id);
      return { ok: true, replied: 0 };
    }
    if (ev.post_type === "message_sent" || ev.post_type === "notice") {
      return { ok: true, replied: 0 };
    }
    if (ev.post_type !== "message" && !ev.message_type) {
      return { ok: true, replied: 0 };
    }
    const replies = await this.handleEvent(ev);
    return { ok: true, replied: replies };
  }

  private openSockets(prefer?: WebSocket): WebSocket[] {
    if (prefer && prefer.readyState === WebSocket.OPEN) return [prefer];
    for (const ws of this.sockets) {
      if (ws.readyState === WebSocket.OPEN) return [ws];
    }
    return [];
  }

  private recentMsgIds = new Set<string>();

  private async handleEvent(ev: Ob11MessageEvent, prefer?: WebSocket): Promise<number> {
    this.lastEventAt = new Date().toISOString();
    if (ev.self_id != null) this.selfId = String(ev.self_id);

    const uid = String(ev.user_id ?? ev.sender?.user_id ?? "");
    const sid = this.selfId || (ev.self_id != null ? String(ev.self_id) : "");
    // 机器人自己的号发的内容（含群里回显）一律忽略
    if (sid && uid && uid === sid) {
      log.debug(`忽略自身消息 user=${uid}`);
      return 0;
    }

    // 同 message_id 短时去重，防止 WS/HTTP 双推
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
    log.info(
      `OneBot 入站  ${msg.meta?.messageType ?? "?"}  user=${msg.userId}  ${msg.content.slice(0, 80)}`,
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
    const params = this.channel.toSendParams({
      ...ctx,
      content: text,
      userId: ctx.userId,
    });
    const echo = `nx_${++this.echoSeq}`;
    const payload = JSON.stringify({ action: "send_msg", params, echo });
    // 只发一个连接，避免多 WS 客户端时同一条刷 N 遍
    const targets = this.openSockets(prefer);
    if (!targets.length) return false;
    targets[0].send(payload);
    return true;
  }

  /**
   * 合并转发：多段节点，显示为「匿名用户」。
   * NapCat：content 必须是消息段数组，传纯字符串会乱码/空白。
   * @see https://napneko.github.io/develop/msg
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
    const targets = this.openSockets(opts?.prefer);
    if (!targets.length) return false;

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

    const echo = `nx_fwd_${++this.echoSeq}`;
    const payload = JSON.stringify({ action, params, echo });
    targets[0].send(payload);
    return true;
  }

  /** 向指定群发送合并转发（更新/重启多群通报） */
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

  async sendTextToGroup(groupId: string, text: string): Promise<boolean> {
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
    return this.sendText(text, ctx);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
