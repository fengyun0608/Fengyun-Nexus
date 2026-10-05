import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";

type Meta = {
  messageType?: string;
  groupId?: string;
  selfId?: string;
  botId?: string;
  atQqs?: unknown;
};

type SpeakMsg = {
  id: string;
  timeMs: number;
  dateKey: string;
  clock: string;
  text: string;
};

const MAX_NODES = 90;
const PAGE_SIZE = 40;
const DEFAULT_PAGES = 80;

function groupIdOf(e: NexusEvent): string {
  const meta = (e.raw?.meta || {}) as Meta;
  if (meta.groupId != null) return String(meta.groupId);
  if (String(e.chatId).startsWith("group:")) return String(e.chatId).slice(6);
  return "";
}

function botIdOf(e: NexusEvent): string | undefined {
  const meta = (e.raw?.meta || {}) as Meta;
  const id = meta.botId || meta.selfId;
  return id != null ? String(id) : undefined;
}

function extractAtQqs(e: NexusEvent): string[] {
  const meta = (e.raw?.meta || {}) as Meta;
  const ids: string[] = [];
  const fromMeta = meta.atQqs;
  if (Array.isArray(fromMeta)) {
    for (const x of fromMeta) {
      const s = String(x).trim();
      if (/^\d{5,12}$/.test(s)) ids.push(s);
    }
  }
  if (!ids.length) {
    for (const m of e.msg.matchAll(/\[CQ:at,qq=(\d+)\]/gi)) ids.push(m[1]);
    for (const m of e.msg.matchAll(/@(\d{5,12})\b/g)) ids.push(m[1]);
  }
  return [...new Set(ids)];
}

function parseTarget(e: NexusEvent): string {
  const at = extractAtQqs(e)[0];
  if (at) return at;
  const m = e.msg.match(/^#全部发言\s*(\d{5,12})\b/);
  return m?.[1] || "";
}

function msgTimeMs(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n < 1e12 ? n * 1000 : n;
}

function historyMessages(data: unknown): Array<Record<string, unknown>> {
  if (!data) return [];
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.messages)) return d.messages as Array<Record<string, unknown>>;
  if (Array.isArray(d.message)) return d.message as Array<Record<string, unknown>>;
  return [];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 按东八区标注日期与时刻 */
function shanghaiParts(ms: number): { dateKey: string; clock: string } {
  const d = new Date(ms);
  const fmt = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  const y = parts.year || "0000";
  const mo = parts.month || "01";
  const da = parts.day || "01";
  const h = parts.hour || "00";
  const mi = parts.minute || "00";
  return { dateKey: `${y}-${mo}-${da}`, clock: `${h}:${mi}` };
}

function segText(message: unknown): string {
  if (typeof message === "string") {
    return message
      .replace(/\[CQ:at,qq=(\d+)[^\]]*\]/gi, "@$1")
      .replace(/\[CQ:image[^\]]*\]/gi, "[图片]")
      .replace(/\[CQ:face[^\]]*\]/gi, "[表情]")
      .replace(/\[CQ:record[^\]]*\]/gi, "[语音]")
      .replace(/\[CQ:video[^\]]*\]/gi, "[视频]")
      .replace(/\[CQ:file[^\]]*\]/gi, "[文件]")
      .replace(/\[CQ:reply[^\]]*\]/gi, "")
      .trim();
  }
  if (!Array.isArray(message)) return "";
  const bits: string[] = [];
  for (const s of message) {
    const seg = s as { type?: string; data?: Record<string, unknown> };
    const t = String(seg.type || "");
    const d = seg.data || {};
    if (t === "text") bits.push(String(d.text ?? ""));
    else if (t === "at") bits.push(`@${d.qq ?? d.user_id ?? ""}`);
    else if (t === "image") bits.push("[图片]");
    else if (t === "face" || t === "emoji") bits.push("[表情]");
    else if (t === "record" || t === "voice") bits.push("[语音]");
    else if (t === "video") bits.push("[视频]");
    else if (t === "file") bits.push("[文件]");
    else if (t === "reply") continue;
    else if (t === "json" || t === "xml") bits.push("[卡片]");
    else if (t) bits.push(`[${t}]`);
  }
  return bits.join("").replace(/\s+/g, " ").trim();
}

function forwardNode(name: string, uin: string, text: string) {
  const uinNum = Number(uin) || 80000000;
  return {
    type: "node",
    data: {
      name,
      uin: String(uinNum),
      user_id: uinNum,
      nickname: name,
      content: [{ type: "text", data: { text } }],
    },
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export class ZAllSpeakPlugin extends Plugin {
  manifest = {
    id: "z.all.speak",
    name: "全部发言",
    version: "0.1.1",
    priority: 820,
    category: "standard" as const,
    kind: "channel" as const,
    adapterScope: "channel" as const,
    channels: ["onebot11"],
    permissions: ["channel.send" as const, "onebot.api" as const],
    description: "拉取本群某人近段发言，按日标注，用合并转发输出",
  };

  rule = [
    { reg: "^#全部发言菜单$", fnc: "menu", describe: "全部发言菜单" },
    {
      reg: "^#全部发言",
      fnc: "dump",
      permission: "master" as const,
      describe: "汇总某人发言并合并转发",
    },
  ];

  configSchema = [
    {
      key: "maxPages",
      label: "历史翻页上限",
      type: "number" as const,
      default: DEFAULT_PAGES,
      description: "每页约40条群消息，越大拉得越久",
    },
    {
      key: "maxSpeak",
      label: "最多收录发言条数",
      type: "number" as const,
      default: 800,
    },
  ];

  private cfg = { maxPages: DEFAULT_PAGES, maxSpeak: 800 };

  getConfig() {
    return { ...this.cfg };
  }

  setConfig(next: Record<string, unknown>) {
    this.cfg = {
      maxPages: Math.max(5, Math.min(200, Number(next.maxPages) || DEFAULT_PAGES)),
      maxSpeak: Math.max(20, Math.min(2000, Number(next.maxSpeak) || 800)),
    };
  }

  async onReady(ctx: PluginContext) {
    ctx.log("全部发言已就绪：#全部发言 @对方 或 QQ号");
  }

  async menu(e: NexusEvent, ctx: PluginContext) {
    const sections = [
      {
        title: "用法",
        lines: ["#全部发言 @对方", "#全部发言 QQ号"],
      },
      {
        title: "说明",
        lines: [
          "从本群协议历史尽量往前翻",
          "按日期标注后合并转发",
          "仅主人可用",
        ],
      },
    ];
    const shot = await ctx.shot.renderMenu({ title: "全部发言", sections });
    if (!shot.ok) {
      await e.reply(["全部发言", ...sections.flatMap((s) => [s.title, ...s.lines])].join("\n"));
      return;
    }
    await e.replyImage(shot.pngPath);
  }

  async dump(e: NexusEvent, ctx: PluginContext) {
    if (!ctx.ob11) {
      await e.reply("当前通道不支持");
      return;
    }
    const gid = groupIdOf(e);
    if (!gid) {
      await e.reply("请在群里使用");
      return;
    }
    const qq = parseTarget(e);
    if (!qq) {
      await e.reply("用法：#全部发言 @对方 或 #全部发言 QQ号");
      return;
    }

    const botId = botIdOf(e);
    await e.reply(`正在汇总 ${qq} 的本群发言…`);

    const { name, list, scanned, pages } = await this.collectSpeak(ctx, gid, qq, botId);
    if (!list.length) {
      await e.reply(
        `在本群协议历史里没找到 ${name || qq} 的发言（已扫 ${scanned} 条 / ${pages} 页）。本地库不存全群记录，只能拉协议能给的历史。`,
      );
      return;
    }

    const nodes = this.buildNodes(name || qq, qq, list, scanned, pages);
    const packs = chunk(nodes, MAX_NODES);
    let ok = 0;
    for (let i = 0; i < packs.length; i++) {
      if (packs.length > 1) {
        await e.reply(`合并转发 ${i + 1}/${packs.length}…`);
      }
      const r = await ctx.ob11.call(
        "send_group_forward_msg",
        { group_id: String(gid), messages: packs[i] },
        { botId },
      );
      if (r.ok) ok += 1;
      else {
        await e.reply(`合并转发失败：${r.message || "未知"}`);
        break;
      }
      await sleep(400);
    }
    if (ok) {
      await e.reply(
        `已转发 ${list.length} 条发言，覆盖 ${this.countDays(list)} 天（扫历史 ${scanned} 条）。`,
      );
    }
  }

  private countDays(list: SpeakMsg[]): number {
    return new Set(list.map((m) => m.dateKey)).size;
  }

  private buildNodes(
    name: string,
    qq: string,
    list: SpeakMsg[],
    scanned: number,
    pages: number,
  ) {
    const nodes: ReturnType<typeof forwardNode>[] = [];
    const days = this.countDays(list);
    nodes.push(
      forwardNode(
        name,
        qq,
        `${name}（${qq}）本群发言汇总\n共 ${list.length} 条 · ${days} 天\n来源：群协议历史（扫 ${scanned} 条 / ${pages} 页）\n按东八区日期标注`,
      ),
    );

    let lastDay = "";
    for (const m of list) {
      if (m.dateKey !== lastDay) {
        lastDay = m.dateKey;
        nodes.push(forwardNode(name, qq, `—— ${m.dateKey} ——`));
      }
      const body = m.text || "[空消息]";
      nodes.push(forwardNode(name, qq, `${m.clock}\n${body}`));
    }
    return nodes;
  }

  private async collectSpeak(
    ctx: PluginContext,
    gid: string,
    qq: string,
    botId?: string,
  ): Promise<{ name: string; list: SpeakMsg[]; scanned: number; pages: number }> {
    const ob11 = ctx.ob11!;
    let name = qq;
    try {
      const info = await ob11.call(
        "get_group_member_info",
        { group_id: String(gid), user_id: String(qq) },
        { botId },
      );
      if (info.ok) {
        const d = (info.data || {}) as Record<string, unknown>;
        name = String(d.card || d.nickname || qq);
      }
    } catch {
      /* ignore */
    }

    const byId = new Map<string, SpeakMsg>();
    let scanned = 0;
    let pages = 0;
    let messageSeq: number | string | undefined;

    for (let page = 0; page < this.cfg.maxPages; page++) {
      const params: Record<string, unknown> = {
        group_id: String(gid),
        count: PAGE_SIZE,
      };
      if (messageSeq != null) params.message_seq = messageSeq;
      const r = await ob11.call("get_group_msg_history", params, { botId });
      if (!r.ok) {
        ctx.log(`全部发言拉历史失败：${r.message || "未知"}`);
        break;
      }
      const batch = historyMessages(r.data);
      if (!batch.length) break;
      pages += 1;

      let oldestSeq: number | undefined;
      for (const m of batch) {
        scanned += 1;
        const seqRaw = m.message_seq ?? m.real_seq ?? m.real_id;
        if (seqRaw != null && Number.isFinite(Number(seqRaw))) {
          const seq = Number(seqRaw);
          if (oldestSeq == null || seq < oldestSeq) oldestSeq = seq;
        }
        const uid = String(
          m.user_id ?? (m.sender as { user_id?: unknown } | undefined)?.user_id ?? "",
        );
        if (uid !== qq) continue;
        const mid = String(m.message_id ?? m.messageId ?? `${m.time}-${scanned}`);
        const timeMs = msgTimeMs(m.time) || Date.now();
        const { dateKey, clock } = shanghaiParts(timeMs);
        const text = segText(m.message ?? m.raw_message);
        byId.set(mid, { id: mid, timeMs, dateKey, clock, text });
      }

      if (byId.size >= this.cfg.maxSpeak) break;
      if (oldestSeq == null) break;
      if (messageSeq != null && String(oldestSeq) === String(messageSeq)) break;
      messageSeq = oldestSeq;
      await sleep(50);
    }

    const list = [...byId.values()].sort((a, b) => a.timeMs - b.timeMs);
    if (list.length > this.cfg.maxSpeak) {
      return {
        name,
        list: list.slice(list.length - this.cfg.maxSpeak),
        scanned,
        pages,
      };
    }
    return { name, list, scanned, pages };
  }
}

export default new ZAllSpeakPlugin();
