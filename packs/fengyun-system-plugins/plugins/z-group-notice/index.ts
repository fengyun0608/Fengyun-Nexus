import { pathToFileURL } from "node:url";
import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";

const JOIN = [
  "哼，又钻进来一个。家里随便坐，别弄乱我的东西。",
  "来了呀。叫一声就行…才、才不是欢迎你。",
  "新来的小鬼？门没关，进来就别想马上跑。",
  "哟，又多一张嘴。想吃什么自己拿，别跟我客气。",
  "进来就进来呗。当自己人，别装陌生人。",
  "欸，你谁呀。算了，既然来了，就当亲戚。",
  "哼哼，迟到了哦。位置给你留着，别太得意。",
  "欢迎…才不欢迎。坐那儿，别吵我。",
  "又一个。乖一点，家里我罩着，但不许惹事。",
  "进来吧。鞋子摆好，别让我嫌弃你。",
].join("\n");

const LEAVE = [
  "走了？真没出息。想家了再回来，门还开着。",
  "哼，跑了。才不是舍不得你呢。",
  "退了就退了。自己小心，别让我再操心。",
  "走就走。下次见面我可要嫌弃你很久。",
  "欸，人呢。算了，不送了。记得吃饭。",
  "家里少一个人。哼，谁稀罕…你自己保重。",
  "溜了溜了。想回来就回来，别装矜持。",
  "行吧，你走。口袋里的糖自己带着，我才不追。",
].join("\n");

function pick(raw: string, fallback: string): string {
  const lines = raw
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!lines.length) return fallback;
  return lines[Math.floor(Math.random() * lines.length)] || fallback;
}

function sameId(a: unknown, b: unknown): boolean {
  const x = String(a ?? "").trim();
  const y = String(b ?? "").trim();
  return Boolean(x) && x === y;
}

/** 只对别人进群、别人退群说话。本插件自带 #进退群菜单。 */
export class ZGroupNoticePlugin extends Plugin {
  manifest = {
    id: "z.group.notice",
    name: "进退群通知",
    version: "0.2.0",
    priority: 860,
    category: "standard" as const,
    kind: "channel" as const,
    adapterScope: "channel" as const,
    channels: ["onebot11"],
    permissions: ["channel.send" as const],
    description: "别人进退群时说一声；发 #进退群菜单 看说明",
  };

  rule = [{ reg: "^#进退群菜单$", fnc: "menu", describe: "进退群菜单" }];

  configSchema = [
    {
      key: "enabled",
      label: "开启通知",
      type: "boolean" as const,
      default: true,
    },
    {
      key: "atUser",
      label: "艾特对方",
      type: "boolean" as const,
      default: true,
    },
    {
      key: "joinLines",
      label: "进群语句",
      type: "string" as const,
      default: JOIN,
    },
    {
      key: "leaveLines",
      label: "退群语句",
      type: "string" as const,
      default: LEAVE,
    },
  ];

  private cfg = {
    enabled: true,
    atUser: true,
    joinLines: JOIN,
    leaveLines: LEAVE,
  };

  getConfig() {
    return { ...this.cfg };
  }

  setConfig(next: Record<string, unknown>) {
    this.cfg = {
      enabled: next.enabled !== false,
      atUser: next.atUser !== false,
      joinLines: String(next.joinLines ?? this.cfg.joinLines),
      leaveLines: String(next.leaveLines ?? this.cfg.leaveLines),
    };
  }

  async onReady(_ctx: PluginContext) {}

  async menu(e: NexusEvent, ctx: PluginContext) {
    const sections = [
      {
        title: "行为",
        lines: [
          "别人进群 — 随机一句欢迎",
          "别人退群 — 随机一句送别",
          "机器人自己进退或被踢 — 不说话",
        ],
      },
      {
        title: "配置",
        lines: ["控制台可改进群/退群语句、是否艾特对方"],
      },
      {
        title: "组合",
        lines: ["可与群管、主人管理同装，欢迎与权限分开管"],
      },
    ];
    const shot = await ctx.shot.renderMenu({ title: "进退群菜单", sections });
    if (!shot.ok) {
      const lines = sections.flatMap((s) => [s.title, ...s.lines]);
      await e.reply(["进退群菜单", ...lines, shot.message].join("\n"));
      return;
    }
    await e.replyImage(pathToFileURL(shot.pngPath).href);
  }

  async onNotice(ev: Record<string, unknown>): Promise<string[] | void> {
    if (!this.cfg.enabled) return;
    const noticeType = String(ev.notice_type || "");
    const sub = String(ev.sub_type || "");
    const uid = String(ev.user_id ?? "").trim();
    const self = String(ev.self_id ?? "").trim();
    if (!uid) return;

    // 机器人自己进群、退群、被踢：不说话
    if (sameId(uid, self) || sub === "kick_me") return;

    if (noticeType === "group_increase") {
      return [this.wrap(uid, pick(this.cfg.joinLines, JOIN.split("\n")[0]!))];
    }

    // 别人主动退群才说。被踢不说
    if (noticeType === "group_decrease" && sub !== "kick") {
      return [this.wrap(uid, pick(this.cfg.leaveLines, LEAVE.split("\n")[0]!))];
    }
  }

  private wrap(uid: string, line: string): string {
    if (!this.cfg.atUser || !/^\d{5,12}$/.test(uid)) return line;
    return `[CQ:at,qq=${uid}] ${line}`;
  }
}

export default new ZGroupNoticePlugin();
