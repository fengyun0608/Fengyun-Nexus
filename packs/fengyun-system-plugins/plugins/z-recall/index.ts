import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";

type GroupRole = "owner" | "admin" | "member" | "unknown";

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

function selfIdOf(e: NexusEvent): string {
  const meta = (e.raw?.meta || {}) as Record<string, unknown>;
  return String(meta.selfId || meta.botId || "").trim();
}

function normalizeRole(raw: unknown): GroupRole {
  const r = String(raw || "")
    .trim()
    .toLowerCase();
  if (r === "owner" || r === "群主") return "owner";
  if (r === "admin" || r === "administrator" || r === "管理员") return "admin";
  if (r === "member" || r === "成员") return "member";
  return "unknown";
}

/**
 * 机器人权限 vs 被撤消息作者：
 * - 自己的消息：总能撤
 * - 群主号：可撤管理、群员
 * - 管理号：只能撤群员，不能撤群主/其他管理
 */
function canBotRecall(botRole: GroupRole, targetRole: GroupRole, isSelf: boolean): boolean {
  if (isSelf) return true;
  if (botRole === "owner") return targetRole !== "owner";
  if (botRole === "admin") return targetRole === "member" || targetRole === "unknown";
  return false;
}

function roleLabel(r: GroupRole): string {
  if (r === "owner") return "群主";
  if (r === "admin") return "管理员";
  if (r === "member") return "群员";
  return "未知身份";
}

/** 主人引用消息后 #撤回；按机器人群职权决定能否删。 */
export class ZRecallPlugin extends Plugin {
  manifest = {
    id: "z.recall",
    name: "撤回",
    version: "0.1.0",
    priority: 860,
    category: "standard" as const,
    kind: "channel" as const,
    adapterScope: "channel" as const,
    channels: ["onebot11"],
    permissions: ["channel.send" as const, "onebot.api" as const],
    description: "主人引用消息后 #撤回；按机器人群职权",
  };

  rule = [
    {
      reg: "^#撤回$",
      fnc: "recall",
      permission: "master" as const,
      describe: "引用一条消息后撤回",
    },
    {
      reg: "^#撤回菜单$",
      fnc: "menu",
      permission: "master" as const,
      describe: "撤回说明",
    },
  ];

  override async onReady(_ctx: PluginContext) {
    return ["撤回：主人引用消息后发 #撤回"];
  }

  async menu(e: NexusEvent, _ctx: PluginContext) {
    await e.reply(
      [
        "撤回",
        "用法：引用要删的那条，再发 #撤回",
        "权限：",
        "· 机器人是群主 → 可撤管理、群员；可撤自己",
        "· 机器人是管理 → 可撤群员、自己；不能撤群主/其他管理",
        "· 机器人是群员 → 只能撤自己发的",
        "仅主人可用",
      ].join("\n"),
    );
  }

  async recall(e: NexusEvent, ctx: PluginContext) {
    if (!ctx.ob11) {
      await e.reply("当前通道不支持撤回");
      return;
    }
    const gid = groupIdOf(e);
    if (!gid) {
      await e.reply("请在群里引用消息后使用 #撤回");
      return;
    }

    const meta = (e.raw?.meta || {}) as Record<string, unknown>;
    const quoteId = String(meta.quoteMessageId || "").trim();
    if (!quoteId) {
      await e.reply("请先引用要撤回的那条消息，再发 #撤回");
      return;
    }

    const botId = botIdOf(e);
    const selfId = selfIdOf(e);
    if (!selfId) {
      await e.reply("读不出机器人 QQ，撤不了");
      return;
    }

    const got = await ctx.ob11.call("get_msg", { message_id: quoteId }, { botId });
    if (!got.ok) {
      await e.reply(`查不到那条消息：${got.message || "未知错误"}`);
      return;
    }
    const data = (got.data || {}) as Record<string, unknown>;
    const sender =
      (data.sender as { user_id?: unknown; role?: unknown } | undefined) ||
      ({} as { user_id?: unknown; role?: unknown });
    const targetUid = String(
      data.user_id ?? sender.user_id ?? data.sender_id ?? "",
    ).trim();
    if (!/^\d{5,12}$/.test(targetUid)) {
      await e.reply("读不出消息发送者，撤不了");
      return;
    }

    const isSelf = targetUid === selfId;
    let targetRole = normalizeRole(sender.role ?? data.role);
    let botRole: GroupRole = "unknown";

    const botInfo = await ctx.ob11.call(
      "get_group_member_info",
      { group_id: gid, user_id: selfId, no_cache: true },
      { botId },
    );
    if (botInfo.ok) {
      const d = (botInfo.data || {}) as Record<string, unknown>;
      botRole = normalizeRole(d.role);
    }

    if (targetRole === "unknown" && !isSelf) {
      const tInfo = await ctx.ob11.call(
        "get_group_member_info",
        { group_id: gid, user_id: targetUid, no_cache: true },
        { botId },
      );
      if (tInfo.ok) {
        const d = (tInfo.data || {}) as Record<string, unknown>;
        targetRole = normalizeRole(d.role);
      }
    }

    if (!canBotRecall(botRole, targetRole, isSelf)) {
      await e.reply(
        `撤不了：机器人是${roleLabel(botRole)}，对方是${roleLabel(targetRole)}。` +
          (botRole === "admin"
            ? "管理号只能撤群员和自己的消息。"
            : botRole === "member"
              ? "群员号只能撤自己的消息。"
              : ""),
      );
      return;
    }

    const del = await ctx.ob11.call("delete_msg", { message_id: quoteId }, { botId });
    if (!del.ok) {
      const tip = String(del.message || "").trim() || "QQ 拒绝";
      await e.reply(`撤回失败：${tip.slice(0, 80)}`);
      return;
    }
    await e.reply(isSelf ? "已撤回自己那条" : "已撤回");
  }
}

export default new ZRecallPlugin();
