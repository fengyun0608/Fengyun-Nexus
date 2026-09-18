import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";

type LikeCfg = {
  enabled: boolean;
  maxTimes: number;
  randomMin: number;
  randomMax: number;
  replies: string;
  friendsOnly: boolean;
  mastersOnly: boolean;
  triggerWords: string;
  botId: string;
};

function pickReply(raw: string, times: number): string {
  const lines = String(raw || "")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!lines.length) return `赞了你 ${times} 下～`;
  const line = lines[Math.floor(Math.random() * lines.length)];
  return line.replace(/\{n\}/g, String(times)).replace(/\{times\}/g, String(times));
}

function randInt(min: number, max: number): number {
  const a = Math.min(min, max);
  const b = Math.max(min, max);
  return a + Math.floor(Math.random() * (b - a + 1));
}

/** QQ 点赞：#赞我；也可配触发词 */
export class ZLikePlugin extends Plugin {
  manifest = {
    id: "z.like",
    name: "点赞",
    version: "0.1.0",
    priority: 900,
    category: "basic" as const,
    kind: "channel" as const,
    adapterScope: "channel" as const,
    channels: ["onebot11"],
    permissions: ["channel.send" as const, "onebot.api" as const],
    description: "给自己点赞：#赞我；可配触发词与多号 apiBase",
  };

  rule = [
    {
      reg: "^#赞我\\s*$",
      fnc: "likeMe",
      describe: "给自己点赞",
    },
  ];

  configSchema = [
    { key: "enabled", label: "开启点赞", type: "boolean" as const, default: true },
    {
      key: "maxTimes",
      label: "最大点赞次数",
      type: "number" as const,
      default: 10,
      description: "单次上限，受 QQ 侧限制",
    },
    { key: "randomMin", label: "随机最少", type: "number" as const, default: 1 },
    { key: "randomMax", label: "随机最多", type: "number" as const, default: 10 },
    {
      key: "replies",
      label: "回复语句",
      type: "string" as const,
      default:
        "哼，杂鱼也想被赞吗…勉为其难赞了你 {n} 下。\n好啦好啦，赞你 {n} 下，别得寸进尺哦。",
      description: "多行随机一条；{n} 替换为次数",
    },
    { key: "friendsOnly", label: "仅好友可赞", type: "boolean" as const, default: false },
    { key: "mastersOnly", label: "仅给主人点赞", type: "boolean" as const, default: false },
    {
      key: "triggerWords",
      label: "触发词",
      type: "string" as const,
      default: "赞我,点个赞,给我点赞",
      description: "逗号分隔；消息含这些词也会点赞",
    },
    {
      key: "botId",
      label: "指定机器人 QQ",
      type: "string" as const,
      default: "",
      description: "多号时填 selfId；空=当前连接。各号可在 OneBot 配不同 apiBase 端口",
    },
  ];

  private cfg: LikeCfg = {
    enabled: true,
    maxTimes: 10,
    randomMin: 1,
    randomMax: 10,
    replies:
      "哼，杂鱼也想被赞吗…勉为其难赞了你 {n} 下。\n好啦好啦，赞你 {n} 下，别得寸进尺哦。",
    friendsOnly: false,
    mastersOnly: false,
    triggerWords: "赞我,点个赞,给我点赞",
    botId: "",
  };

  getConfig() {
    return { ...this.cfg };
  }

  setConfig(next: Record<string, unknown>) {
    this.cfg = {
      enabled: next.enabled !== false,
      maxTimes: Math.max(1, Number(next.maxTimes ?? 10) || 10),
      randomMin: Math.max(1, Number(next.randomMin ?? 1) || 1),
      randomMax: Math.max(1, Number(next.randomMax ?? 10) || 10),
      replies: String(next.replies ?? this.cfg.replies),
      friendsOnly: Boolean(next.friendsOnly),
      mastersOnly: Boolean(next.mastersOnly),
      triggerWords: String(next.triggerWords ?? ""),
      botId: String(next.botId ?? "").trim(),
    };
  }

  async onReady(ctx: PluginContext) {
    ctx.log("点赞插件就绪");
  }

  async accept(e: NexusEvent, ctx: PluginContext): Promise<boolean | void> {
    if (await super.accept(e, ctx)) return true;
    if (this.cfg.enabled === false) return false;
    if (e.channel !== "onebot11") return false;
    const text = e.msg.trim();
    if (!text || text.startsWith("#")) return false;
    const words = this.cfg.triggerWords
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!words.some((w) => text.includes(w))) return false;
    await this.doLike(e, ctx);
    return true;
  }

  async likeMe(e: NexusEvent, ctx: PluginContext) {
    await this.doLike(e, ctx);
  }

  private async doLike(e: NexusEvent, ctx: PluginContext) {
    if (this.cfg.enabled === false) {
      await e.reply("点赞已关闭");
      return;
    }
    if (!ctx.ob11) {
      await e.reply("当前通道不支持点赞");
      return;
    }
    if (this.cfg.mastersOnly && !ctx.isMaster?.(e.userId)) {
      await e.reply("只给主人点赞哦");
      return;
    }

    const botId =
      this.cfg.botId ||
      String((e.raw?.meta as { botId?: string } | undefined)?.botId || "") ||
      undefined;

    if (this.cfg.friendsOnly) {
      const fl = await ctx.ob11.call("get_friend_list", {}, { botId });
      const list = Array.isArray(fl.data) ? fl.data : [];
      const ok = list.some(
        (x) => String((x as { user_id?: unknown }).user_id) === String(e.userId),
      );
      if (!ok) {
        await e.reply("还不是好友，赞不了你啦");
        return;
      }
    }

    const times = Math.min(
      this.cfg.maxTimes,
      randInt(this.cfg.randomMin, this.cfg.randomMax),
    );
    const r = await ctx.ob11.call(
      "send_like",
      { user_id: Number(e.userId) || e.userId, times },
      { botId },
    );
    if (!r.ok) {
      await e.reply(r.message || "点赞失败，可能今日已达上限");
      return;
    }
    await e.reply(pickReply(this.cfg.replies, times));
  }
}

export default new ZLikePlugin();
