import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";

type LikeCfg = {
  enabled: boolean;
  maxTimes: number;
  randomMin: number;
  randomMax: number;
  /** 点赞成功；一行一句，每次随机 */
  repliesOk: string;
  /** 点赞失败（接口报错等） */
  repliesFail: string;
  /** 今日已达上限 */
  repliesLimit: string;
  friendsOnly: boolean;
  mastersOnly: boolean;
  triggerWords: string;
  botId: string;
};

const DEFAULT_OK = [
  "哼，杂鱼也想被赞吗…勉为其难赞了你 {n} 下。",
  "好啦好啦，赞你 {n} 下，别得寸进尺哦。",
  "杂鱼大叔伸手要赞？行吧，给你 {n} 下，记着谢我。",
  "才、才不是想夸你呢…顺手赞了 {n} 下而已！",
  "啧，这么粘人。赞了 {n} 下，够了吧杂鱼。",
  "摸摸头——不对，是点赞。给你 {n} 下，乖一点。",
  "杂鱼的请求也要认真对待嘛…赞了你 {n} 下。",
  "今天心情好，破例给杂鱼大叔 {n} 个赞。",
  "嗯…算你识相。赞了 {n} 下，下次记得带零食。",
  "杂鱼浓度过高警告——仍旧赞了你 {n} 下。",
  "别笑得那么傻，只是赞了 {n} 下而已啦。",
  "大叔也要被夸吗？那赞你 {n} 下，开心了没。",
  "哼哼，被赞的感觉怎么样？一共 {n} 下哦。",
  "杂鱼专用赞到账：{n}。去炫耀吧。",
  "行行行，赞了。{n} 下，别再刷屏要了。",
  "轻轻赞了你 {n} 下…再吵就把你拉黑哦，骗人的啦。",
  "杂鱼大叔今日份夸奖：赞 ×{n}。收下吧。",
  "本来想无视的…算了，赞你 {n} 下。",
  "哇，居然主动要赞。给你 {n} 下，别飘。",
  "点赞完毕。杂鱼指数 +{n}。",
].join("\n");

const DEFAULT_FAIL = [
  "点赞失败了…杂鱼今天运气不太好呢。",
  "唔，没赞上。可能是接口不开心，稍后再试。",
  "失败了啦。不是我不想赞你，是 QQ 不让。",
  "啧，赞飞了。杂鱼大叔等会儿再来一次？",
  "这次没成。先摸摸你的头安慰一下…口头的。",
  "点赞卡住了。不是嫌弃你，是网络抽风。",
  "失败！杂鱼计划搁浅。过会儿再喊我。",
  "哎，没赞上。你先自己开心一下？",
  "接口说不行。我也没办法呀，杂鱼。",
  "赞丢了…下次一定！大概。",
  "失败了。今天风太大，赞被吹走了。",
  "没成。可能对方设置太严，杂鱼也救不了。",
].join("\n");

const DEFAULT_LIMIT = [
  "今日点赞已达上限啦，杂鱼大叔明天再来。",
  "赞满了满了！明天再宠你，好不好。",
  "今天的赞额度用光了。杂鱼也要懂得节制哦。",
  "上限到了。明日再战，杂鱼加油。",
  "已经赞不动了…QQ 说停。明天见。",
  "今日份夸奖售罄。杂鱼大叔请明日再来排队。",
  "赞库存清空。先去喝口水，明天继续。",
  "到上限啦。不是不爱赞你，是没次数了。",
  "今日额度耗尽。明天再给你当夸夸机。",
  "满了哦。杂鱼先忍一忍，太阳下山再…不，明天。",
  "点赞条数见底。回见，大叔。",
  "上限警告：今天不能再赞了。乖乖等明天。",
].join("\n");

function pickLine(raw: string, fallback: string, times?: number): string {
  const lines = String(raw || "")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const pool = lines.length ? lines : [fallback];
  let line = pool[Math.floor(Math.random() * pool.length)];
  if (times != null) {
    line = line.replace(/\{n\}/g, String(times)).replace(/\{times\}/g, String(times));
  }
  return line;
}

function randInt(min: number, max: number): number {
  const a = Math.min(min, max);
  const b = Math.max(min, max);
  return a + Math.floor(Math.random() * (b - a + 1));
}

function looksLikeLimit(msg: string): boolean {
  const s = String(msg || "").toLowerCase();
  return /上限|次数|limit|too many|已达|用完|售罄|明日|明天再/.test(s);
}

/** QQ 点赞：#赞我；也可配触发词。成功/失败/上限词库各一行一句，控制台可改。 */
export class ZLikePlugin extends Plugin {
  manifest = {
    id: "z.like",
    name: "点赞",
    version: "0.2.0",
    priority: 900,
    category: "basic" as const,
    kind: "channel" as const,
    adapterScope: "channel" as const,
    channels: ["onebot11"],
    permissions: ["channel.send" as const, "onebot.api" as const],
    description: "给自己点赞：#赞我；成功/失败/上限词库可在控制台改，一行一句随机",
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
      key: "repliesOk",
      label: "成功词库",
      type: "textarea" as const,
      default: DEFAULT_OK,
      description: "一行一句；每次随机。可用 {n} 表示次数",
    },
    {
      key: "repliesFail",
      label: "失败词库",
      type: "textarea" as const,
      default: DEFAULT_FAIL,
      description: "一行一句；点赞接口失败时随机",
    },
    {
      key: "repliesLimit",
      label: "上限词库",
      type: "textarea" as const,
      default: DEFAULT_LIMIT,
      description: "一行一句；今日已达上限时随机",
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
      description: "多号时填 selfId；空=当前连接",
    },
  ];

  private cfg: LikeCfg = {
    enabled: true,
    maxTimes: 10,
    randomMin: 1,
    randomMax: 10,
    repliesOk: DEFAULT_OK,
    repliesFail: DEFAULT_FAIL,
    repliesLimit: DEFAULT_LIMIT,
    friendsOnly: false,
    mastersOnly: false,
    triggerWords: "赞我,点个赞,给我点赞",
    botId: "",
  };

  getConfig() {
    return { ...this.cfg };
  }

  setConfig(next: Record<string, unknown>) {
    // 兼容旧配置：只有 replies 时当作成功词库
    const legacy = typeof next.replies === "string" ? String(next.replies) : "";
    this.cfg = {
      enabled: next.enabled !== false,
      maxTimes: Math.max(1, Number(next.maxTimes ?? 10) || 10),
      randomMin: Math.max(1, Number(next.randomMin ?? 1) || 1),
      randomMax: Math.max(1, Number(next.randomMax ?? 10) || 10),
      repliesOk: String(next.repliesOk ?? legacy || this.cfg.repliesOk || DEFAULT_OK),
      repliesFail: String(next.repliesFail ?? this.cfg.repliesFail || DEFAULT_FAIL),
      repliesLimit: String(next.repliesLimit ?? this.cfg.repliesLimit || DEFAULT_LIMIT),
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
        await e.reply(
          pickLine(this.cfg.repliesFail, "还不是好友，赞不了你啦"),
        );
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
      const tip = r.message || "";
      if (looksLikeLimit(tip)) {
        await e.reply(pickLine(this.cfg.repliesLimit, "今日点赞已达上限，明天再来吧"));
      } else {
        await e.reply(
          pickLine(this.cfg.repliesFail, tip || "点赞失败，稍后再试"),
        );
      }
      return;
    }
    await e.reply(pickLine(this.cfg.repliesOk, `赞了你 ${times} 下～`, times));
  }
}

export default new ZLikePlugin();
