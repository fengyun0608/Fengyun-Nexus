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
  const fromMeta = meta.atQqs;
  if (Array.isArray(fromMeta)) {
    return fromMeta.map((x) => String(x).trim()).filter(Boolean);
  }
  const ids: string[] = [];
  const re = /\[CQ:at,qq=(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(e.msg))) ids.push(m[1]);
  const plain = e.msg.match(/(?:^|\s)(\d{5,12})(?:\s|$)/);
  if (plain?.[1]) ids.push(plain[1]);
  return [...new Set(ids)];
}

function firstTarget(e: NexusEvent): string {
  return extractAtQqs(e)[0] || "";
}

const TEASE = [
  "欸？你怎么被禁言了呀～是不是干了什么坏事了，杂鱼？",
  "哼哼，主人也被禁言啦？做了什么坏事被抓住了吗～",
  "哇，你居然被禁言了…是不是惹到谁了呀，杂鱼主人。",
];

/** QQ 群管：踢 / 踢黑 / 禁言 / 全体禁言 / 公告 / 群文件 */
export class ZGroupAdminPlugin extends Plugin {
  manifest = {
    id: "z.group.admin",
    name: "群管",
    version: "0.1.0",
    priority: 850,
    category: "standard" as const,
    kind: "channel" as const,
    adapterScope: "channel" as const,
    channels: ["onebot11"],
    permissions: ["channel.send" as const, "onebot.api" as const],
    description: "踢人、踢黑、禁言、全体禁言、群公告、群文件",
  };

  rule = [
    { reg: "^#踢黑", fnc: "kickBan", permission: "master" as const, describe: "踢出并拉黑" },
    { reg: "^#踢", fnc: "kick", permission: "master" as const, describe: "踢出群" },
    { reg: "^#禁言", fnc: "ban", permission: "master" as const, describe: "禁言（分钟）" },
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

  async onReady(ctx: PluginContext) {
    ctx.log("群管插件就绪");
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
        group_id: Number(gid) || gid,
        user_id: Number(qq) || qq,
        reject_add_request: reject,
      },
      { botId: botIdOf(e) },
    );
    await e.reply(r.ok ? (reject ? "已踢黑" : "已踢出") : r.message || "操作失败");
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
    const m = e.msg.match(/(\d+)\s*(?:分钟|分|m)?\s*$/i);
    const minutes = m ? Number(m[1]) : 10;
    if (!qq) {
      await e.reply("用法：#禁言 @对方 10");
      return;
    }
    const r = await ctx.ob11.call(
      "set_group_ban",
      {
        group_id: Number(gid) || gid,
        user_id: Number(qq) || qq,
        duration: Math.max(0, Math.floor(minutes * 60)),
      },
      { botId: botIdOf(e) },
    );
    await e.reply(r.ok ? `已禁言 ${minutes} 分钟` : r.message || "禁言失败");
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
        group_id: Number(gid) || gid,
        user_id: Number(qq) || qq,
        duration: 0,
      },
      { botId: botIdOf(e) },
    );
    await e.reply(r.ok ? "已解禁" : r.message || "解禁失败");
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
      { group_id: Number(gid) || gid, enable },
      { botId: botIdOf(e) },
    );
    await e.reply(r.ok ? (enable ? "已全体禁言" : "已全体解禁") : r.message || "操作失败");
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
      { group_id: Number(gid) || gid, content },
      { botId },
    );
    if (!r.ok) {
      r = await ctx.ob11.call(
        "send_group_notice",
        { group_id: Number(gid) || gid, content },
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
      { group_id: Number(gid) || gid },
      { botId },
    );
    if (!r.ok) {
      r = await ctx.ob11.call(
        "get_group_file_system_info",
        { group_id: Number(gid) || gid },
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
