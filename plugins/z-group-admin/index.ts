import { pathToFileURL } from "node:url";
import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";

function groupIdOf(e: NexusEvent): string {
  const meta = (e.raw?.meta || {}) as Record<string, unknown>;
  if (meta.groupId != null) return String(meta.groupId);
  if (String(e.chatId).startsWith("group:")) return String(e.chatId).slice(6);
  return "";
}

function botIdOf(e: NexusEvent): string | undefined {
  const meta = (e.raw?.meta || {}) as Record<string, unknown>;
  const id = meta.botId || meta.selfId;
  return id != null ? String(id) : undefined;
}

function extractAtQqs(e: NexusEvent): string[] {
  const meta = (e.raw?.meta || {}) as Record<string, unknown>;
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

function firstTarget(e: NexusEvent): string {
  const ids = extractAtQqs(e).filter((id) => /^\d{5,12}$/.test(id));
  return ids[0] || "";
}

/** QQ 单人禁言最长 30 天。别把被 @ 的 QQ 当成分钟数。 */
const BAN_MAX_SEC = 30 * 24 * 60 * 60;

function parseBanSeconds(msg: string, targetQq: string): number {
  let rest = msg.replace(/^#(?:全体)?解?禁言\s*/, "");
  rest = rest.replace(/\[CQ:at,qq=[^\]]+\]/gi, " ");
  if (targetQq) rest = rest.replace(new RegExp(`@${targetQq}\\b`, "g"), " ");
  rest = rest.replace(/@\d{5,12}\b/g, " ").trim();
  const m = rest.match(/(\d+)\s*(天|小时|时|分钟|分|d|h|m)?/i);
  if (!m) return 10 * 60;
  const n = Math.max(0, Math.floor(Number(m[1]) || 0));
  const unit = (m[2] || "分").toLowerCase();
  let sec = n * 60;
  if (unit === "天" || unit === "d") sec = n * 86400;
  else if (unit === "小时" || unit === "时" || unit === "h") sec = n * 3600;
  if (sec > BAN_MAX_SEC) sec = BAN_MAX_SEC;
  return sec;
}

function banFailTip(message?: string): string {
  const m = (message || "").trim();
  if (!m || m === "Error" || /napcat\.mjs|_handle/i.test(m)) {
    return "禁言被拒绝。机器人需要是管理员，且不能禁群主或其他管理员";
  }
  if (/cannot ban owner/i.test(m)) return "不能禁言群主";
  if (/cannot ban admin/i.test(m)) return "不能禁言管理员";
  if (/user not in group/i.test(m)) return "对方不在这个群";
  if (/uid error|get Uid Error/i.test(m)) return "找不到这个 QQ";
  return m;
}

function kickFailTip(message?: string): string {
  const m = (message || "").trim();
  if (!m || m === "Error" || /napcat\.mjs|_handle/i.test(m)) {
    return "踢人失败。机器人需要是管理员，且不能踢群主或其他管理员";
  }
  if (/get Uid Error|uid/i.test(m)) return "找不到这个 QQ";
  return m;
}

const TEASE = [
  "欸？你怎么被禁言了呀～是不是干了什么坏事了，杂鱼？",
  "哼哼，主人也被禁言啦？做了什么坏事被抓住了吗～",
  "哇，你居然被禁言了…是不是惹到谁了呀，杂鱼主人。",
];

/** QQ 群管：踢 / 踢黑 / 禁言 / 全体禁言 / 公告 / 群文件。本插件自带 #群管 菜单。 */
export class ZGroupAdminPlugin extends Plugin {
  manifest = {
    id: "z.group.admin",
    name: "群管",
    version: "0.2.0",
    priority: 850,
    category: "standard" as const,
    kind: "channel" as const,
    adapterScope: "channel" as const,
    channels: ["onebot11"],
    permissions: ["channel.send" as const, "onebot.api" as const],
    description: "踢人、踢黑、禁言、全体禁言、群公告、群文件；发 #群管 看菜单",
  };

  rule = [
    { reg: "^#群管菜单$", fnc: "menu", describe: "群管菜单" },
    { reg: "^#群管$", fnc: "menu", describe: "群管菜单" },
    { reg: "^#踢黑", fnc: "kickBan", permission: "master" as const, describe: "踢出并拉黑" },
    { reg: "^#踢", fnc: "kick", permission: "master" as const, describe: "踢出群" },
    { reg: "^#禁言", fnc: "ban", permission: "master" as const, describe: "禁言" },
    { reg: "^#解禁", fnc: "unban", permission: "master" as const, describe: "解除禁言" },
    { reg: "^#全体禁言", fnc: "wholeBan", permission: "master" as const, describe: "全体禁言" },
    { reg: "^#全体解禁", fnc: "wholeUnban", permission: "master" as const, describe: "全体解禁" },
    { reg: "^#群公告", fnc: "announce", permission: "master" as const, describe: "发群公告" },
    { reg: "^#群文件", fnc: "listFiles", permission: "master" as const, describe: "查看群文件" },
  ];

  configSchema = [
    {
      key: "teaseMasters",
      label: "主人被禁言时调侃",
      type: "boolean" as const,
      default: true,
    },
    {
      key: "teaseLines",
      label: "调侃语句",
      type: "string" as const,
      default: TEASE.join("\n"),
      description: "多行随机；仅当被禁言的是主人时回复",
    },
  ];

  private cfg = {
    teaseMasters: true,
    teaseLines: TEASE.join("\n"),
  };

  getConfig() {
    return { ...this.cfg };
  }

  setConfig(next: Record<string, unknown>) {
    this.cfg = {
      teaseMasters: next.teaseMasters !== false,
      teaseLines: String(next.teaseLines ?? this.cfg.teaseLines),
    };
  }

  async onReady(_ctx: PluginContext) {}

  async menu(e: NexusEvent, ctx: PluginContext) {
    const sections = [
      {
        title: "成员",
        lines: [
          "#踢 @对方 — 踢出",
          "#踢黑 @对方 — 踢出并拉黑",
          "#禁言 @对方 10分 — 禁言",
          "#解禁 @对方 — 解除禁言",
        ],
      },
      {
        title: "全群",
        lines: ["#全体禁言 — 开全体禁言", "#全体解禁 — 关全体禁言"],
      },
      {
        title: "公告与文件",
        lines: ["#群公告 内容 — 发公告", "#群文件 — 看群文件"],
      },
      {
        title: "组合",
        lines: [
          "可与主人管理、进退群通知同装，权限与欢迎语互相配合",
          "发 #群管 或 #群管菜单 再看本页",
        ],
      },
    ];
    const shot = await ctx.shot.renderMenu({ title: "群管菜单", sections });
    if (!shot.ok) {
      const lines = sections.flatMap((s) => [s.title, ...s.lines]);
      await e.reply(["群管菜单", ...lines, shot.message].join("\n"));
      return;
    }
    await e.replyImage(pathToFileURL(shot.pngPath).href);
  }

  async onNotice(ev: Record<string, unknown>, ctx: PluginContext): Promise<string[] | void> {
    if (!this.cfg.teaseMasters) return;
    const noticeType = String(ev.notice_type || "");
    const sub = String(ev.sub_type || "");
    // group_ban + ban（不是 lift_ban）
    if (noticeType !== "group_ban") return;
    if (sub === "lift_ban") return;
    const duration = Number(ev.duration ?? 0);
    if (!(duration > 0) && sub !== "ban") return;
    const uid = String(ev.user_id ?? "");
    if (!uid || !ctx.isMaster?.(uid)) return;
    const lines = this.cfg.teaseLines
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const line = lines[Math.floor(Math.random() * lines.length)] || TEASE[0];
    return [line];
  }

  private needGroup(e: NexusEvent): string | null {
    const gid = groupIdOf(e);
    return gid || null;
  }

  async kick(e: NexusEvent, ctx: PluginContext) {
    await this.doKick(e, ctx, false);
  }

  async kickBan(e: NexusEvent, ctx: PluginContext) {
    await this.doKick(e, ctx, true);
  }

  private async doKick(e: NexusEvent, ctx: PluginContext, reject: boolean) {
    if (!ctx.ob11) {
      await e.reply("当前通道不支持群管");
      return;
    }
    const gid = this.needGroup(e);
    if (!gid) {
      await e.reply("请在群里使用");
      return;
    }
    const qq = firstTarget(e);
    if (!qq) {
      await e.reply(reject ? "用法：#踢黑 @对方" : "用法：#踢 @对方");
      return;
    }
    if (ctx.isMaster?.(qq) && ctx.masterLevel?.(e.userId) !== "core") {
      await e.reply("不能踢主人");
      return;
    }
    const r = await ctx.ob11.call(
      "set_group_kick",
      {
        group_id: String(gid),
        user_id: String(qq),
        reject_add_request: reject,
      },
      { botId: botIdOf(e) },
    );
    await e.reply(r.ok ? (reject ? "已踢黑" : "已踢出") : kickFailTip(r.message));
  }

  async ban(e: NexusEvent, ctx: PluginContext) {
    if (!ctx.ob11) {
      await e.reply("当前通道不支持群管");
      return;
    }
    const gid = this.needGroup(e);
    if (!gid) {
      await e.reply("请在群里使用");
      return;
    }
    const qq = firstTarget(e);
    if (!qq) {
      await e.reply("用法：#禁言 @对方 10");
      return;
    }
    const duration = parseBanSeconds(e.msg, qq);
    const r = await ctx.ob11.call(
      "set_group_ban",
      {
        group_id: String(gid),
        user_id: String(qq),
        duration,
      },
      { botId: botIdOf(e) },
    );
    const minutes = Math.max(1, Math.round(duration / 60));
    await e.reply(r.ok ? `已禁言 ${minutes} 分钟` : banFailTip(r.message));
  }

  async unban(e: NexusEvent, ctx: PluginContext) {
    if (!ctx.ob11) {
      await e.reply("当前通道不支持群管");
      return;
    }
    const gid = this.needGroup(e);
    if (!gid) {
      await e.reply("请在群里使用");
      return;
    }
    const qq = firstTarget(e);
    if (!qq) {
      await e.reply("用法：#解禁 @对方");
      return;
    }
    const r = await ctx.ob11.call(
      "set_group_ban",
      {
        group_id: String(gid),
        user_id: String(qq),
        duration: 0,
      },
      { botId: botIdOf(e) },
    );
    await e.reply(r.ok ? "已解禁" : banFailTip(r.message));
  }

  async wholeBan(e: NexusEvent, ctx: PluginContext) {
    await this.setWhole(e, ctx, true);
  }

  async wholeUnban(e: NexusEvent, ctx: PluginContext) {
    await this.setWhole(e, ctx, false);
  }

  private async setWhole(e: NexusEvent, ctx: PluginContext, enable: boolean) {
    if (!ctx.ob11) {
      await e.reply("当前通道不支持群管");
      return;
    }
    const gid = this.needGroup(e);
    if (!gid) {
      await e.reply("请在群里使用");
      return;
    }
    const r = await ctx.ob11.call(
      "set_group_whole_ban",
      { group_id: String(gid), enable },
      { botId: botIdOf(e) },
    );
    await e.reply(
      r.ok
        ? enable
          ? "已全体禁言"
          : "已全体解禁"
        : r.message && r.message !== "Error"
          ? r.message
          : "操作失败。机器人需要是管理员",
    );
  }

  async announce(e: NexusEvent, ctx: PluginContext) {
    if (!ctx.ob11) {
      await e.reply("当前通道不支持群管");
      return;
    }
    const gid = this.needGroup(e);
    if (!gid) {
      await e.reply("请在群里使用");
      return;
    }
    const content = e.msg.replace(/^#群公告\s*/, "").trim();
    if (!content) {
      await e.reply("用法：#群公告 内容");
      return;
    }
    const botId = botIdOf(e);
    let r = await ctx.ob11.call(
      "_send_group_notice",
      { group_id: String(gid), content },
      { botId },
    );
    if (!r.ok) {
      r = await ctx.ob11.call(
        "send_group_notice",
        { group_id: String(gid), content },
        { botId },
      );
    }
    await e.reply(r.ok ? "已发群公告" : r.message || "发公告失败");
  }

  async listFiles(e: NexusEvent, ctx: PluginContext) {
    if (!ctx.ob11) {
      await e.reply("当前通道不支持群管");
      return;
    }
    const gid = this.needGroup(e);
    if (!gid) {
      await e.reply("请在群里使用");
      return;
    }
    const botId = botIdOf(e);
    let r = await ctx.ob11.call(
      "get_group_root_files",
      { group_id: String(gid) },
      { botId },
    );
    if (!r.ok) {
      r = await ctx.ob11.call(
        "get_group_file_system_info",
        { group_id: String(gid) },
        { botId },
      );
    }
    if (!r.ok) {
      await e.reply(r.message || "拉取群文件失败");
      return;
    }
    const data = (r.data || {}) as {
      files?: Array<{ file_name?: string; file_id?: string }>;
      folders?: Array<{ folder_name?: string }>;
    };
    const files = data.files || [];
    const folders = data.folders || [];
    const lines: string[] = ["群文件："];
    for (const f of folders.slice(0, 20)) {
      lines.push(`📁 ${f.folder_name || "文件夹"}`);
    }
    for (const f of files.slice(0, 30)) {
      lines.push(`📄 ${f.file_name || f.file_id || "文件"}`);
    }
    if (lines.length === 1) lines.push("空");
    await e.reply(lines.join("\n"));
  }
}

export default new ZGroupAdminPlugin();
