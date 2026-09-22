import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";

const MAX_TIMES = 20;

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

function isQq(v: unknown): boolean {
  if (typeof v === "number") v = String(v);
  return typeof v === "string" && /^\d{5,12}$/.test(v);
}

type Ob11 = NonNullable<PluginContext["ob11"]>;

/** 唤群主秘诀：主人输入 #召唤群主 [次数]，连续多条气泡艾特群主 */
export class ZSummonOwnerPlugin extends Plugin {
  manifest = {
    id: "z.summon.owner",
    name: "唤群主秘诀",
    version: "0.1.0",
    priority: 900,
    category: "standard" as const,
    kind: "channel" as const,
    adapterScope: "channel" as const,
    channels: ["onebot11"],
    permissions: ["channel.send" as const, "onebot.api" as const],
    description: "主人输入 #召唤群主 [次数]，连续多条气泡艾特群主",
  };

  rule = [
    {
      reg: "^#召唤群主",
      fnc: "summon",
      permission: "master" as const,
      describe: "唤群主秘诀",
    },
  ];

  async onReady(ctx: PluginContext) {
    ctx.log("唤群主秘诀已就绪：#召唤群主 [次数] 连续艾特群主");
  }

  private async ownerOf(ob11: Ob11, gid: string, botId?: string): Promise<string> {
    const info = await ob11.call("get_group_info", { group_id: gid }, { botId });
    const data = (info.data || {}) as Record<string, unknown>;
    const owner = data.owner_id ?? data.ownerId ?? data.owner ?? data.owner_uin ?? data.owner_qq;
    if (isQq(owner)) return String(owner);

    const list = await ob11.call("get_group_member_list", { group_id: gid }, { botId });
    const members = (list.data || []) as Array<Record<string, unknown>>;
    for (const m of members) {
      if (String(m.role || "").toLowerCase() === "owner") {
        const uid = m.user_id ?? m.userId ?? m.qq;
        if (isQq(uid)) return String(uid);
      }
    }
    return "";
  }

  async summon(e: NexusEvent, ctx: PluginContext) {
    const ob11 = ctx.ob11;
    if (!ob11) {
      await e.reply("当前通道不支持群管");
      return;
    }
    const gid = groupIdOf(e);
    if (!gid) {
      await e.reply("请在群里使用");
      return;
    }

    const rest = e.msg.replace(/^#召唤群主\s*/, "").trim();
    let times = 1;
    const m = rest.match(/(\d+)/);
    if (m) times = Math.floor(Number(m[1]) || 1);
    if (times < 1) times = 1;
    if (times > MAX_TIMES) times = MAX_TIMES;

    const botId = botIdOf(e);
    const owner = await this.ownerOf(ob11, gid, botId);
    if (!owner) {
      await e.reply("没找到群主");
      return;
    }

    const atMsg = `[CQ:at,qq=${owner}]`;
    for (let i = 0; i < times; i++) {
      await ob11.call("send_group_msg", { group_id: gid, message: atMsg }, { botId });
    }
    await e.reply(`已召唤群主 ${times} 次`);
  }
}

export default new ZSummonOwnerPlugin();
