import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";

type Meta = {
  messageType?: string;
  groupId?: string;
  selfId?: string;
  botId?: string;
  atQqs?: unknown;
  senderName?: string;
};

type Ob11 = NonNullable<PluginContext["ob11"]>;

const OWNER_DEFAULT =
  [
    "你现在替主人在群里随手回一句。",
    "要求：口语、简短（不超过40字），像本人刚看到消息顺手一回；语气自然、有点人情味，别端着、别像客服或销售。",
    "对方吐槽穷、服务器卡、买不起好机器时：可以调侃两句或安慰一句，禁止说『凑合用』『能跑通就行』『将就』这类冷漠甩锅。",
    "不要出现『我是AI』『代回』『机器人』；不要@任何人；不要加括号动作或表情描述。",
    "拿不准就短短带过一句，宁可含糊也别乱承诺、别编事实、别替主人答应办事。",
  ].join("");

function findConfigsDir(): string | null {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "configs", "llm.local.json"))) return join(dir, "configs");
    dir = dirname(dir);
  }
  return null;
}

let cfgDirCache: string | null | undefined;
function cfgDir(): string | null {
  if (cfgDirCache !== undefined) return cfgDirCache;
  cfgDirCache = findConfigsDir();
  return cfgDirCache;
}

function activeModel(): { baseUrl: string; model: string; apiKey: string } | null {
  const base = cfgDir();
  if (!base) return null;
  try {
    const file = JSON.parse(readFileSync(join(base, "llm.local.json"), "utf8")) as {
      activeId?: string;
      providers?: Array<Record<string, unknown>>;
    };
    const list = Array.isArray(file.providers) ? file.providers : [];
    const ap = list.find((p) => p.id === file.activeId) || list[0];
    const baseUrl = String(ap?.baseUrl || "");
    const apiKey = String(ap?.apiKey || "");
    if (!baseUrl || !apiKey) return null;
    return { baseUrl, model: String(ap?.model || ""), apiKey };
  } catch {
    return null;
  }
}

function stripAts(text: string): string {
  return String(text || "")
    .replace(/\[CQ:at,[^\]]*\]/gi, " ")
    .replace(/@\d{5,}\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function askLlm(
  messages: Array<{ role: string; content: string }>,
  timeoutMs = 12000,
): Promise<string | null> {
  const m = activeModel();
  if (!m) return null;
  try {
    const url = `${m.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${m.apiKey}` },
      body: JSON.stringify({ model: m.model, messages, temperature: 0.8 }),
      signal: ctl.signal,
    });
    clearTimeout(t);
    if (!resp.ok) return null;
    const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const txt = data?.choices?.[0]?.message?.content;
    return typeof txt === "string" ? txt.trim() : null;
  } catch {
    return null;
  }
}

function segText(message: unknown): string {
  if (typeof message === "string") return message;
  if (Array.isArray(message)) {
    return message
      .map((s) => {
        const seg = s as { type?: string; data?: Record<string, unknown> };
        if (seg.type === "text") return String(seg.data?.text ?? "");
        if (seg.type === "at") return `@${seg.data?.qq ?? ""}`;
        return "";
      })
      .join("");
  }
  return "";
}

async function recentTexts(
  ob11: Ob11,
  gid: string,
  botId: string | undefined,
  count: number,
): Promise<Array<{ who: string; qq: string; text: string }>> {
  try {
    const res = await ob11.call("get_group_msg_history", { group_id: gid, count }, { botId });
    const arr = ((res.data as { messages?: unknown })?.messages || []) as Array<Record<string, unknown>>;
    const out: Array<{ who: string; qq: string; text: string }> = [];
    for (const it of arr) {
      const qq = String(it.user_id ?? "");
      const sender = (it.sender || {}) as Record<string, unknown>;
      const who = String(sender.card || sender.nickname || qq || "未知");
      const clean = stripAts(segText(it.message));
      if (clean) out.push({ who, qq, text: clean.slice(0, 120) });
    }
    return out;
  } catch {
    return [];
  }
}

async function memberName(ctx: PluginContext, gid: string, qq: string): Promise<string> {
  try {
    const r = await ctx.ob11!.call("get_group_member_info", { group_id: gid, user_id: qq });
    const d = (r.data || {}) as Record<string, unknown>;
    return String(d.card || d.nickname || "");
  } catch {
    return "";
  }
}

export class ZProxyOwnerReplyPlugin extends Plugin {
  manifest = {
    id: "z.proxy.owner.reply",
    name: "代主人回话",
    version: "0.1.1",
    priority: 700,
    category: "standard" as const,
    kind: "channel" as const,
    adapterScope: "channel" as const,
    channels: ["onebot11"],
    permissions: ["channel.send" as const, "onebot.api" as const, "llm.chat" as const, "fs.data" as const],
    description: "群里有人@主人时自动代主人回一句；只@不带话则看最近消息判断是否在对主人说话",
  };

  rule = [{ reg: "^#代答", fnc: "panel", permission: "master" as const, describe: "开/关 代主人回话" }];

  configSchema = [
    { key: "enabled", label: "总开关", type: "boolean" as const, default: true },
    { key: "bareAt", label: "只@不带话也判断", type: "boolean" as const, default: true },
    { key: "historyCount", label: "参考最近条数", type: "number" as const, default: 12 },
    { key: "cooldownSec", label: "同群冷却秒", type: "number" as const, default: 60 },
    { key: "systemPrompt", label: "代回语气", type: "textarea" as const, default: OWNER_DEFAULT },
  ];

  private cfg = { enabled: true, bareAt: true, historyCount: 12, cooldownSec: 60, systemPrompt: OWNER_DEFAULT };
  private lastByGroup = new Map<string, number>();

  getConfig() {
    return { ...this.cfg };
  }

  setConfig(next: Record<string, unknown>) {
    this.cfg = {
      enabled: next.enabled !== false,
      bareAt: next.bareAt !== false,
      historyCount: Math.max(3, Math.min(30, Number(next.historyCount) || 12)),
      cooldownSec: Math.max(0, Number.isFinite(Number(next.cooldownSec)) ? Number(next.cooldownSec) : 60),
      systemPrompt: String(next.systemPrompt || OWNER_DEFAULT),
    };
  }

  async onReady(ctx: PluginContext) {
    ctx.log("代主人回话已就绪：群里 @主人 自动代回，#代答 开关");
  }

  private ownerIds(ctx: PluginContext, e: NexusEvent): string[] {
    const set = new Set<string>();
    const l = ctx.masters?.list(ctx.channelId || e.channel);
    if (l) for (const id of [...l.core, ...l.new, ...l.normal]) if (id) set.add(String(id));
    const me = String((e.raw.meta as Meta)?.selfId || ctx.ob11?.selfId?.() || "");
    if (me) set.delete(me);
    return [...set];
  }

  async accept(e: NexusEvent, ctx: PluginContext): Promise<boolean> {
    if (/^#代答/.test(e.msg.trim())) {
      if (!ctx.isMaster?.(e.userId)) return false;
      return this.panel(e, ctx);
    }
    if (!this.cfg.enabled) return false;
    if (e.channel !== "onebot11") return false;
    const ob = ctx.ob11;
    if (!ob) return false;
    const meta = (e.raw.meta || {}) as Meta;
    if (meta.messageType !== "group") return false;
    const gid = String(meta.groupId || "").trim() || String(e.chatId || "").replace(/^group:/, "");
    if (!gid) return false;
    if (ctx.isMaster?.(e.userId)) return false;

    const owners = this.ownerIds(ctx, e);
    if (!owners.length) return false;
    const atQqs = Array.isArray(meta.atQqs) ? meta.atQqs.map((x) => String(x).trim()) : [];
    const atOwner = owners.find((o) => atQqs.includes(o));
    if (!atOwner) return false;

    const now = Date.now();
    const last = this.lastByGroup.get(gid) || 0;
    if (now - last < this.cfg.cooldownSec * 1000) return true;

    const botId = String(meta.botId || meta.selfId || "") || undefined;
    const asker = String(meta.senderName || e.userId || "有人");
    const body = stripAts(e.msg);
    this.lastByGroup.set(gid, now);

    if (body) {
      await this.relay(e, ctx, gid, atOwner, botId, asker, `【${asker}】对你说：${body}`);
    } else if (this.cfg.bareAt) {
      await this.judgeBareAt(e, ctx, gid, atOwner, botId, asker);
    }
    return true;
  }

  async panel(e: NexusEvent, _ctx: PluginContext) {
    const rest = e.msg.replace(/^#代答\s*/, "").trim().toLowerCase();
    if (rest === "开" || rest === "on" || rest === "") {
      this.cfg.enabled = true;
      await e.reply("代主人回话：开");
    } else if (rest === "关" || rest === "off") {
      this.cfg.enabled = false;
      await e.reply("代主人回话：关");
    } else if (rest === "状态" || rest === "status") {
      await e.reply(
        `代主人回话：${this.cfg.enabled ? "开" : "关"}｜只@判断 ${this.cfg.bareAt ? "开" : "关"}｜冷却 ${this.cfg.cooldownSec}s`,
      );
    } else {
      await e.reply("用法：#代答 开 / #代答 关 / #代答 状态");
    }
    return true;
  }

  private async relay(
    e: NexusEvent,
    ctx: PluginContext,
    gid: string,
    owner: string,
    botId: string | undefined,
    asker: string,
    situation: string,
  ) {
    const name = (await memberName(ctx, gid, owner)) || "本人";
    const recent = await recentTexts(ctx.ob11!, gid, botId, this.cfg.historyCount);
    const conv = recent.slice(-this.cfg.historyCount).map((r) => `${r.who}：${r.text}`).join("\n").slice(-1600);
    const sys = `${this.cfg.systemPrompt}\n（你在群里替「${name}」说话。）`;
    const user = `【群内最近消息】\n${conv || "（无）"}\n\n${situation}\n\n请以 ${name} 的口吻只输出要回的那一句：`;
    const out = await askLlm([
      { role: "system", content: sys },
      { role: "user", content: user },
    ]);
    this.sendClean(e, out);
  }

  private async judgeBareAt(
    e: NexusEvent,
    ctx: PluginContext,
    gid: string,
    owner: string,
    botId: string | undefined,
    asker: string,
  ) {
    const name = (await memberName(ctx, gid, owner)) || "本人";
    const recent = await recentTexts(ctx.ob11!, gid, botId, this.cfg.historyCount);
    const before = recent.filter((r) => !r.text.startsWith(`@${owner}`) && r.text !== "");
    const lastOther = [...before].reverse().find((r) => r.qq !== owner && r.qq !== String(botId || ""));
    if (!lastOther) return;
    const conv = before.slice(-this.cfg.historyCount).map((r) => `${r.who}：${r.text}`).join("\n").slice(-1600);
    const sys = `你在判断群里刚才那几句话是不是在对「${name}」本人说、且值不值得替他回一句。若不是对本人说的、闲聊无关、@错人、或不需要回应，就只输出 SKIP。若确实该替本人回，就只输出要回的那一句（不超过40字，口语自然有人情味，不要@人，不要出现『代回』『我是AI』，不要客服腔，禁止『凑合用』『能跑通就行』这类甩锅话）。`;
    const user = `【群内最近消息】\n${conv || "（无）"}\n\n【情况】${asker} 只@了一下 ${name}，没带正文。请判断。`;
    const out = await askLlm([
      { role: "system", content: sys },
      { role: "user", content: user },
    ]);
    if (!out) return;
    if (/^SKIP\b/i.test(out.trim())) return;
    this.sendClean(e, out);
  }

  private sendClean(e: NexusEvent, raw: string | null) {
    if (!raw) return;
    let t = raw.replace(/[\r\n]+/g, " ").trim();
    t = t.replace(/^["“「『]+|["”」』]+$/g, "").trim();
    t = t.replace(/^(SKIP|无|不回|无需回复)[.。!！]*$/i, "").trim();
    if (t.length > 120) t = t.slice(0, 120);
    // 拦一层明显冷漠/客服甩锅，宁可不回
    if (/凑合用|能跑通就行|将就着用|爱用不用|关我什么事/.test(t)) return;
    if (t) e.reply(t);
  }
}

export default new ZProxyOwnerReplyPlugin();
