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
    if (ev.post_type !== "message" && !ev.message_type) {
      return { ok: true, replied: 0 };
    }
    const replies = await this.handleEvent(ev);
    return { ok: true, replied: replies };
  }

  private async handleEvent(ev: Ob11MessageEvent, prefer?: WebSocket): Promise<number> {
    this.lastEventAt = new Date().toISOString();
    if (ev.self_id != null) this.selfId = String(ev.self_id);
    const msg = this.channel.normalizeInbound(ev);
    if (!msg.content.trim()) return 0;
    if (!this.onInbound) return 0;
    const texts = await this.onInbound(msg);
    let n = 0;
    for (const text of texts) {
      if (!text.trim()) continue;
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
    const targets = prefer ? [prefer] : [...this.sockets];
    let sent = false;
    for (const ws of targets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
        sent = true;
      }
    }
    return sent;
  }
}
