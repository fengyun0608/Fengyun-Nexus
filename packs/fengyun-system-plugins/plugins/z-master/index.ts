import { pathToFileURL } from "node:url";
import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";

function parseLevel(raw: string): "core" | "new" | "normal" {
  const s = raw.trim();
  if (/核心/.test(s)) return "core";
  if (/新主人|^新$/.test(s)) return "new";
  return "normal";
}

function extractQq(text: string): string {
  const at = text.match(/\[CQ:at,qq=(\d+)\]/);
  if (at?.[1]) return at[1];
  const m = text.match(/(\d{5,12})/);
  return m?.[1] || "";
}

const LEVEL_LABEL = { core: "核心主人", new: "新主人", normal: "普通主人" } as const;

/** 主人管理：列表 / 添加 / 删除。本插件自带 #主人菜单。 */
export class ZMasterPlugin extends Plugin {
  manifest = {
    id: "z.master",
    name: "主人管理",
    version: "0.2.0",
    priority: 800,
    category: "basic" as const,
    kind: "channel" as const,
    adapterScope: "channel" as const,
    channels: ["onebot11"],
    permissions: ["channel.send" as const, "channel.master" as const],
    description: "核心/新/普通主人互加与删除；发 #主人菜单 看用法",
  };

  rule = [
    { reg: "^#主人菜单$", fnc: "menu", describe: "主人菜单" },
    {
      reg: "^#主人列表",
      fnc: "listMasters",
      permission: "master" as const,
      describe: "查看主人",
    },
    {
      reg: "^#添加主人",
      fnc: "addMaster",
      permission: "master" as const,
      describe: "添加主人",
    },
    {
      reg: "^#删除主人",
      fnc: "removeMaster",
      permission: "master" as const,
      describe: "删除主人",
    },
  ];

  async onReady(_ctx: PluginContext) {}

  async menu(e: NexusEvent, ctx: PluginContext) {
    const sections = [
      {
        title: "查看",
        lines: ["#主人列表 — 核心 / 新 / 普通"],
      },
      {
        title: "增减",
        lines: [
          "#添加主人 @对方 普通 — 加普通主人",
          "#添加主人 @对方 新 — 加新主人",
          "#添加主人 @对方 核心 — 加核心主人",
          "#删除主人 @对方 — 按级别权限删除",
        ],
      },
      {
        title: "组合",
        lines: [
          "主人在通道层配置，群管踢禁等指令认主人",
          "点赞可对主人与普通人用不同回复",
        ],
      },
    ];
    const shot = await ctx.shot.renderMenu({ title: "主人菜单", sections });
    if (!shot.ok) {
      const lines = sections.flatMap((s) => [s.title, ...s.lines]);
      await e.reply(["主人菜单", ...lines, shot.message].join("\n"));
      return;
    }
    await e.replyImage(pathToFileURL(shot.pngPath).href);
  }

  async listMasters(e: NexusEvent, ctx: PluginContext) {
    const list = ctx.masters?.list(e.channel);
    if (!list) {
      await e.reply("主人数据不可用");
      return;
    }
    const lines = [
      "主人列表：",
      `核心：${list.core.join("、") || "无"}`,
      `新主人：${list.new.join("、") || "无"}`,
      `普通：${list.normal.join("、") || "无"}`,
    ];
    await e.reply(lines.join("\n"));
  }

  async addMaster(e: NexusEvent, ctx: PluginContext) {
    const rest = e.msg.replace(/^#添加主人\s*/, "");
    const qq = extractQq(rest);
    if (!qq) {
      await e.reply("用法：#添加主人 @对方 [核心|新|普通]");
      return;
    }
    const level = parseLevel(rest.replace(qq, "").replace(/\[CQ:at[^\]]*\]/g, ""));
    const r = ctx.masters?.add(qq, level, { channelId: e.channel, actorId: e.userId });
    if (!r?.ok) {
      await e.reply(r?.error || "添加失败");
      return;
    }
    await e.reply(`已添加 ${qq} 为${LEVEL_LABEL[level]}`);
  }

  async removeMaster(e: NexusEvent, ctx: PluginContext) {
    const rest = e.msg.replace(/^#删除主人\s*/, "");
    const qq = extractQq(rest);
    if (!qq) {
      await e.reply("用法：#删除主人 @对方");
      return;
    }
    const r = ctx.masters?.remove(qq, { channelId: e.channel, actorId: e.userId });
    if (!r?.ok) {
      await e.reply(r?.error || "删除失败");
      return;
    }
    await e.reply(`已删除主人 ${qq}`);
  }
}

export default new ZMasterPlugin();
