import { pathToFileURL } from "node:url";
import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";

type LikeCfg = {
  enabled: boolean;
  maxTimes: number;
  randomMin: number;
  randomMax: number;
  /** 主人 · 成功 */
  repliesOkMaster: string;
  /** 普通人 · 成功（好听，但不压过主人） */
  repliesOkGuest: string;
  repliesFailMaster: string;
  repliesFailGuest: string;
  repliesLimitMaster: string;
  repliesLimitGuest: string;
  friendsOnly: boolean;
  mastersOnly: boolean;
  triggerWords: string;
  botId: string;
};

/** 主人称呼：亲密、偏宠，杂鱼主人一类 */
const DEFAULT_OK_MASTER = [
  "哼，杂鱼主人也要赞吗…好啦，宠你 {n} 下。",
  "遵命，杂鱼主人。已赞 {n} 下，尾巴都要翘起来了。",
  "小主人伸手了？那就赞 {n} 下，不许后悔哦。",
  "才、才不是特别给你赞的…顺手 {n} 下而已，主人！",
  "杂鱼主人今日份夸奖：赞 ×{n}。请开心一点。",
  "摸摸…不对，是点赞。给亲爱的主人 {n} 下。",
  "主人一喊就到。赞了 {n} 下，记得夸我乖。",
  "好的好的，杂鱼主人最优先。赞 {n} 下到账。",
  "啧，粘人的主人。赞了 {n} 下，够宠了吧？",
  "为小主人破例啦——赞 {n} 下，别告诉别人这么甜。",
  "杂鱼主人专属通道：赞 {n}。请签收♡",
  "嗯…只有主人可以这么任性。赞了你 {n} 下。",
  "亲爱的主人，赞 {n} 下。今天也要被我罩着哦。",
  "主人要赞就赞，谁敢说不？一共 {n} 下。",
  "杂鱼主人浓度超标…仍旧认真赞了 {n} 下。",
  "好啦主人，赞完了。{n} 下，去炫耀也行。",
  "给你最高待遇：赞 ×{n}。杂鱼主人请慢用。",
  "小主人今天也很可爱。奖励赞 {n} 下。",
  "哼哼，被主人使唤的感觉…赞了 {n} 下啦。",
  "专属夸奖已送达：主人，{n} 个赞，不许分给别人。",
].join("\n");

/** 普通人：好听、礼貌亲近，但不叫主人、不更宠 */
const DEFAULT_OK_GUEST = [
  "好呀，赞了你 {n} 下，开心一点哦。",
  "行啦，给你 {n} 个赞，别太得意。",
  "朋友伸手要赞？那就 {n} 下，收下吧。",
  "嗯，赞了你 {n} 下。今天运气不错嘛。",
  "轻轻赞了 {n} 下，记得说谢谢呀。",
  "好的，点赞完成：{n}。去过好日子吧。",
  "给你鼓鼓掌——哦不，是赞 {n} 下。",
  "熟人优惠：赞 ×{n}。别天天来刷就行。",
  "赞了哦。{n} 下，算我请客。",
  "好嘞，{n} 个赞送到。保持可爱就行。",
  "给你点亮一下：赞 {n}。下次也要乖。",
  "唔，可以呀。赞了你 {n} 下，别飘太高。",
  "朋友份夸奖：赞 {n} 下。收好。",
  "点赞完毕。你这家伙，{n} 下够不够？",
  "行，赞了。一共 {n} 下，去笑一个。",
  "给你体面一点的赞：{n}。请慢用。",
  "好呀好呀，赞 {n} 下。今天也顺利哦。",
  "熟人通道通过～赞了你 {n} 下。",
  "嗯嗯，已赞 {n}。下次见。",
  "给你鼓劲：赞 ×{n}。加油呀。",
].join("\n");

const DEFAULT_FAIL_MASTER = [
  "杂鱼主人…这次没赞上，不是我不宠你，是接口抽风。",
  "失败了啦，小主人。稍后再喊我一次好不好？",
  "唔，赞飞了。主人先喝口水，我再试。",
  "亲爱的主人，这次 QQ 不配合。绝不是嫌弃你。",
  "杂鱼主人专属安慰：失败了，但明天还宠你。",
  "没成…主人别生气，过会儿再来，我等着。",
  "接口说不行。主人，我们换个时间继续被宠。",
  "赞丢了。小主人先忍忍，我马上补上——大概。",
  "失败了。主人今天运气一般，抱抱（口头）。",
  "啧，连主人的赞都丢？气死了。稍后再来。",
  "没赞上。杂鱼主人请稍候再试一次。",
  "卡住了。主人先忙别的，我盯着接口呢。",
].join("\n");

const DEFAULT_FAIL_GUEST = [
  "这次没赞上，稍后再试一下呀。",
  "唔，失败了。不是不想赞你，是网络抽风。",
  "赞飞了。等会儿再喊我一次吧。",
  "哎，没成。你先自己开心一下？",
  "接口不开心。过会儿再来，朋友。",
  "失败了啦。再试一次通常就好。",
  "没赞上。先喝口水，别着急。",
  "卡住了。稍后再点一次就行。",
  "赞丢了…下次一定！大概。",
  "今天风太大，赞被吹走了。再试呗。",
  "失败。可能设置太严，我也没办法。",
  "没成。你先忙，回头再赞。",
].join("\n");

const DEFAULT_LIMIT_MASTER = [
  "杂鱼主人，今日赞额度用光啦。明天继续宠你。",
  "上限到了，小主人。先存着想念，明日再赞。",
  "亲爱的主人，今天的赞卖完了。明天见哦。",
  "满了满了。主人也要懂得节制…明天再来。",
  "今日份专属夸奖售罄。杂鱼主人请明日排队。",
  "额度见底。小主人先去忙，太阳一出来再宠。",
  "到上限啦。不是不宠你，是 QQ 不给次数了。",
  "主人今日已赞满。留下一个吻面…口头的，明天见。",
  "赞库存清空。杂鱼主人，我们约明天。",
  "上限警告：今天不能再宠了。主人乖乖等日出。",
  "今日额度耗尽。明天见，最优先还是你。",
  "满了哦。小主人先忍一忍，明日继续最高待遇。",
].join("\n");

const DEFAULT_LIMIT_GUEST = [
  "今天赞次数用完啦，明天再来呀。",
  "上限到了。先歇歇，明日继续。",
  "今日额度见底。明天见，朋友。",
  "赞满了。明天再给你鼓劲哦。",
  "没有次数了。先去干点别的吧。",
  "今日份夸奖售罄。明天再排队。",
  "到上限啦。不是不想赞，是没次数了。",
  "赞库存清空。明天见。",
  "今天到此为止。明日再喊我。",
  "满了哦。先忍一忍，明天继续。",
  "额度耗尽。回去喝口水，明天见。",
  "上限警告：今天不能再赞了。明天见。",
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

/** QQ 点赞：主人 / 普通人两套词库，一行一句，控制台可改。 */
export class ZLikePlugin extends Plugin {
  manifest = {
    id: "z.like",
    name: "点赞",
    version: "0.3.2",
    priority: 900,
    category: "basic" as const,
    kind: "channel" as const,
    adapterScope: "channel" as const,
    channels: ["onebot11"],
    permissions: ["channel.send" as const, "onebot.api" as const],
    description: "给自己点赞。#赞我或触发词；发 #点赞菜单 看用法",
  };

  rule = [
    { reg: "^#点赞菜单$", fnc: "menu", describe: "点赞菜单" },
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
      key: "repliesOkMaster",
      label: "成功 · 主人",
      type: "textarea" as const,
      default: DEFAULT_OK_MASTER,
      description: "主人触发时；一行一句。可用 {n}",
    },
    {
      key: "repliesOkGuest",
      label: "成功 · 普通人",
      type: "textarea" as const,
      default: DEFAULT_OK_GUEST,
      description: "非主人；好听但不压过主人。一行一句",
    },
    {
      key: "repliesFailMaster",
      label: "失败 · 主人",
      type: "textarea" as const,
      default: DEFAULT_FAIL_MASTER,
      description: "一行一句",
    },
    {
      key: "repliesFailGuest",
      label: "失败 · 普通人",
      type: "textarea" as const,
      default: DEFAULT_FAIL_GUEST,
      description: "一行一句",
    },
    {
      key: "repliesLimitMaster",
      label: "上限 · 主人",
      type: "textarea" as const,
      default: DEFAULT_LIMIT_MASTER,
      description: "一行一句",
    },
    {
      key: "repliesLimitGuest",
      label: "上限 · 普通人",
      type: "textarea" as const,
      default: DEFAULT_LIMIT_GUEST,
      description: "一行一句",
    },
    { key: "friendsOnly", label: "仅好友可赞", type: "boolean" as const, default: false },
    { key: "mastersOnly", label: "仅给主人点赞", type: "boolean" as const, default: false },
    {
      key: "triggerWords",
      label: "触发词",
      type: "string" as const,
      default: "赞我,点个赞,给我点赞",
      description: "逗号分隔",
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
    repliesOkMaster: DEFAULT_OK_MASTER,
    repliesOkGuest: DEFAULT_OK_GUEST,
    repliesFailMaster: DEFAULT_FAIL_MASTER,
    repliesFailGuest: DEFAULT_FAIL_GUEST,
    repliesLimitMaster: DEFAULT_LIMIT_MASTER,
    repliesLimitGuest: DEFAULT_LIMIT_GUEST,
    friendsOnly: false,
    mastersOnly: false,
    triggerWords: "赞我,点个赞,给我点赞",
    botId: "",
  };

  getConfig() {
    return { ...this.cfg };
  }

  setConfig(next: Record<string, unknown>) {
    const legacyOk = String(next.repliesOk ?? next.replies ?? "");
    const legacyFail = String(next.repliesFail ?? "");
    const legacyLimit = String(next.repliesLimit ?? "");
    this.cfg = {
      enabled: next.enabled !== false,
      maxTimes: Math.max(1, Number(next.maxTimes ?? 10) || 10),
      randomMin: Math.max(1, Number(next.randomMin ?? 1) || 1),
      randomMax: Math.max(1, Number(next.randomMax ?? 10) || 10),
      repliesOkMaster: String(
        next.repliesOkMaster || this.cfg.repliesOkMaster || legacyOk || DEFAULT_OK_MASTER,
      ),
      repliesOkGuest: String(
        next.repliesOkGuest || this.cfg.repliesOkGuest || legacyOk || DEFAULT_OK_GUEST,
      ),
      repliesFailMaster: String(
        next.repliesFailMaster || this.cfg.repliesFailMaster || legacyFail || DEFAULT_FAIL_MASTER,
      ),
      repliesFailGuest: String(
        next.repliesFailGuest || this.cfg.repliesFailGuest || legacyFail || DEFAULT_FAIL_GUEST,
      ),
      repliesLimitMaster: String(
        next.repliesLimitMaster ||
          this.cfg.repliesLimitMaster ||
          legacyLimit ||
          DEFAULT_LIMIT_MASTER,
      ),
      repliesLimitGuest: String(
        next.repliesLimitGuest || this.cfg.repliesLimitGuest || legacyLimit || DEFAULT_LIMIT_GUEST,
      ),
      friendsOnly: Boolean(next.friendsOnly),
      mastersOnly: Boolean(next.mastersOnly),
      triggerWords: String(next.triggerWords ?? ""),
      botId: String(next.botId ?? "").trim(),
    };
  }

  async onReady(_ctx: PluginContext) {}

  async menu(e: NexusEvent, ctx: PluginContext) {
    const sections = [
      {
        title: "用法",
        lines: [
          "#赞我 — 给自己点赞",
          "触发词也可，不用写 #，默认：赞我、点个赞、给我点赞",
        ],
      },
      {
        title: "组合",
        lines: [
          "主人与普通人可用不同回复文案",
          "可与主人管理同装，识别主人更宠",
        ],
      },
    ];
    const shot = await ctx.shot.renderMenu({ title: "点赞菜单", sections });
    if (!shot.ok) {
      const lines = sections.flatMap((s) => [s.title, ...s.lines]);
      await e.reply(["点赞菜单", ...lines, shot.message].join("\n"));
      return;
    }
    await e.replyImage(pathToFileURL(shot.pngPath).href);
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

  private bank(
    master: boolean,
    kind: "ok" | "fail" | "limit",
  ): { raw: string; fallback: string } {
    if (kind === "ok") {
      return master
        ? { raw: this.cfg.repliesOkMaster, fallback: "杂鱼主人，赞了你 {n} 下～" }
        : { raw: this.cfg.repliesOkGuest, fallback: "赞了你 {n} 下～" };
    }
    if (kind === "fail") {
      return master
        ? { raw: this.cfg.repliesFailMaster, fallback: "杂鱼主人，这次没赞上，稍后再试" }
        : { raw: this.cfg.repliesFailGuest, fallback: "点赞失败，稍后再试" };
    }
    return master
      ? { raw: this.cfg.repliesLimitMaster, fallback: "杂鱼主人，今日已达上限，明天再来" }
      : { raw: this.cfg.repliesLimitGuest, fallback: "今日点赞已达上限，明天再来吧" };
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
    const asMaster = Boolean(ctx.isMaster?.(e.userId));
    if (this.cfg.mastersOnly && !asMaster) {
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
        const b = this.bank(asMaster, "fail");
        await e.reply(pickLine(b.raw, "还不是好友，赞不了你啦"));
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
        const b = this.bank(asMaster, "limit");
        await e.reply(pickLine(b.raw, b.fallback));
      } else {
        const b = this.bank(asMaster, "fail");
        await e.reply(pickLine(b.raw, tip || b.fallback));
      }
      return;
    }
    const b = this.bank(asMaster, "ok");
    await e.reply(pickLine(b.raw, b.fallback, times));
  }
}

export default new ZLikePlugin();
