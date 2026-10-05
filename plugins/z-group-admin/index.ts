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
  if (/owner|群主/i.test(m)) return "不能踢群主";
  if (/admin|管理员/i.test(m)) return "踢不了管理员";
  return m;
}

type GroupRole = "owner" | "admin" | "member" | "unknown";

function normalizeRole(raw: unknown): GroupRole {
  const r = String(raw || "")
    .trim()
    .toLowerCase();
  if (r === "owner" || r === "群主") return "owner";
  if (r === "admin" || r === "administrator" || r === "管理员") return "admin";
  if (r === "member" || r === "成员") return "member";
  return "unknown";
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
    version: "0.2.3",
    priority: 850,
    category: "standard" as const,
    kind: "channel" as const,
    adapterScope: "channel" as const,
    channels: ["onebot11"],
    permissions: ["channel.send" as const, "onebot.api" as const],
    description: "踢人、踢黑、踢片姐、禁言、全体禁言、群公告、群文件；发 #群管 看菜单",
  };

  rule = [
    { reg: "^#群管菜单$", fnc: "menu", describe: "群管菜单" },
    { reg: "^#群管$", fnc: "menu", describe: "群管菜单" },
    {
      reg: "^#踢片姐",
      fnc: "kickPurge",
      permission: "master" as const,
      describe: "踢黑并撤回对方24小时内消息",
    },
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
          "#踢片姐 @对方 — 踢黑并撤回其24小时内消息",
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
    await e.replyImage(shot.pngPath);
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

  private async memberRole(
    ctx: PluginContext,
    gid: string,
    userId: string,
    botId?: string,
  ): Promise<GroupRole> {
    if (!ctx.ob11 || !userId) return "unknown";
    const r = await ctx.ob11.call(
      "get_group_member_info",
      { group_id: String(gid), user_id: String(userId), no_cache: true },
      { botId },
    );
    if (!r.ok) return "unknown";
    const data = (r.data || {}) as Record<string, unknown>;
    return normalizeRole(data.role);
  }

  /**
   * 踢人前校验：
   * - 机器人须为群管或群主，否则踢不了
   * - 框架主人一律不踢
   * - 群主踢不了（谁都踢不了群主）
   * - 群管只能踢普通成员；群主可踢管理员
   */
  private async assertCanKick(
    e: NexusEvent,
    ctx: PluginContext,
    gid: string,
    targetQq: string,
  ): Promise<string | null> {
    if (ctx.isMaster?.(targetQq)) return "不能踢主人";

    const botId = botIdOf(e);
    const selfId = String(botId || e.raw?.meta?.selfId || "").trim();
    if (!selfId) return "认不出机器人号，无法判断群身份";

    const [selfRole, targetRole] = await Promise.all([
      this.memberRole(ctx, gid, selfId, botId),
      this.memberRole(ctx, gid, targetQq, botId),
    ]);

    if (selfRole === "member") {
      return "我不是群管，踢不了人";
    }
    if (selfRole === "unknown") {
      return "查不到我在本群的身份，确认机器人是群管后再试";
    }
    if (targetRole === "owner") {
      return "踢不了群主";
    }
    if (targetRole === "admin" && selfRole !== "owner") {
      return "群管踢不了管理员，只有群主可以";
    }
    if (targetQq === selfId) {
      return "不能踢自己";
    }
    return null;
  }

  async kick(e: NexusEvent, ctx: PluginContext) {
    await this.doKick(e, ctx, false);
  }

  async kickBan(e: NexusEvent, ctx: PluginContext) {
    await this.doKick(e, ctx, true);
  }

  /** 踢黑 + 撤回对方 24 小时内消息（QQ 管理员可撤回窗口） */
  async kickPurge(e: NexusEvent, ctx: PluginContext) {
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
      await e.reply("用法：#踢片姐 @对方");
      return;
    }
    const deny = await this.assertCanKick(e, ctx, gid, qq);
    if (deny) {
      await e.reply(deny);
      return;
    }

    const botId = botIdOf(e);
    await e.reply("正在清理对方近24小时消息…");
    const { deleted, scanned, failed } = await this.purgeUserMessages24h(ctx, gid, qq, botId);

    const kick = await ctx.ob11.call(
      "set_group_kick",
      {
        group_id: String(gid),
        user_id: String(qq),
        reject_add_request: true,
      },
      { botId },
    );

    const bits = [`已撤回 ${deleted} 条`];
    if (scanned) bits.push(`扫过历史 ${scanned} 条`);
    if (failed) bits.push(`撤回失败 ${failed} 条`);
    if (!kick.ok) {
      await e.reply(`${bits.join("，")}；踢黑失败：${kickFailTip(kick.message)}`);
      return;
    }
    await e.reply(`${bits.join("，")}；已踢黑`);
  }

  private async purgeUserMessages24h(
    ctx: PluginContext,
    gid: string,
    qq: string,
    botId?: string,
  ): Promise<{ deleted: number; scanned: number; failed: number }> {
    const ob11 = ctx.ob11!;
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const msgIds: string[] = [];
    let scanned = 0;
    let messageSeq: number | string | undefined;
    let hitOlder = false;

    for (let page = 0; page < 40; page++) {
      const params: Record<string, unknown> = {
        group_id: String(gid),
        count: 40,
      };
      if (messageSeq != null) params.message_seq = messageSeq;
      const r = await ob11.call("get_group_msg_history", params, { botId });
      if (!r.ok) {
        ctx.log(`踢片姐拉历史失败：${r.message || "未知"}`);
        break;
      }
      const list = historyMessages(r.data);
      if (!list.length) break;

      let oldestSeq: number | undefined;
      let pageMinTime = Number.POSITIVE_INFINITY;
      for (const m of list) {
        scanned += 1;
        const time = msgTimeMs(m.time);
        if (time > 0 && time < pageMinTime) pageMinTime = time;
        const seqRaw = m.message_seq ?? m.real_seq ?? m.real_id;
        if (seqRaw != null && Number.isFinite(Number(seqRaw))) {
          const seq = Number(seqRaw);
          if (oldestSeq == null || seq < oldestSeq) oldestSeq = seq;
        }
        if (time > 0 && time < cutoff) {
          hitOlder = true;
          continue;
        }
        const uid = String(
          m.user_id ??
            (m.sender as { user_id?: unknown } | undefined)?.user_id ??
            "",
        );
        const mid = m.message_id ?? m.messageId;
        if (uid === qq && mid != null && String(mid)) msgIds.push(String(mid));
      }

      if (hitOlder || pageMinTime < cutoff) break;
      if (oldestSeq == null) break;
      if (messageSeq != null && String(oldestSeq) === String(messageSeq)) break;
      messageSeq = oldestSeq;
      await sleep(60);
    }

    const uniq = [...new Set(msgIds)];
    let deleted = 0;
    let failed = 0;
    for (const mid of uniq) {
      const r = await ob11.call("delete_msg", { message_id: mid }, { botId });
      if (r.ok) deleted += 1;
      else failed += 1;
      await sleep(120);
    }
    return { deleted, scanned, failed };
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
    const deny = await this.assertCanKick(e, ctx, gid, qq);
    if (deny) {
      await e.reply(deny);
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
