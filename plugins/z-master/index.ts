import { pathToFileURL } from "node:url";
import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";

/**
 * 主人说明：增减只能在网页控制台通道设置里改。
 * 群聊 / 插件指令一律不能认主、加主人、删主人。
 */
export class ZMasterPlugin extends Plugin {
  manifest = {
    id: "z.master",
    name: "主人管理",
    version: "0.3.0",
    priority: 800,
    category: "basic" as const,
    kind: "channel" as const,
    adapterScope: "channel" as const,
    channels: ["onebot11"],
    permissions: ["channel.send" as const],
    description: "主人只能在网页控制台改；这里只可查看说明与列表",
  };

  rule = [
    { reg: "^#主人菜单$", fnc: "menu", describe: "主人说明" },
    {
      reg: "^#主人列表",
      fnc: "listMasters",
      permission: "master" as const,
      describe: "查看主人",
    },
    {
      reg: "^#认主",
      fnc: "denied",
      describe: "已取消",
    },
    {
      reg: "^#添加主人",
      fnc: "denied",
      describe: "已取消",
    },
    {
      reg: "^#删除主人",
      fnc: "denied",
      describe: "已取消",
    },
  ];

  async onReady(_ctx: PluginContext) {}

  async denied(e: NexusEvent) {
    await e.reply("主人只能在网页控制台改，请打开通道设置");
  }

  async menu(e: NexusEvent, ctx: PluginContext) {
    const sections = [
      {
        title: "怎么改",
        lines: [
          "打开网页控制台 → 消息通道 → 该通道 → 通道设置",
          "在核心 / 新 / 普通主人栏填写 QQ，保存即可",
          "群里不能认主、不能加主人、不能删主人",
        ],
      },
      {
        title: "查看",
        lines: ["#主人列表 — 只读，主人可看"],
      },
    ];
    const shot = await ctx.shot.renderMenu({ title: "主人说明", sections });
    if (!shot.ok) {
      const lines = sections.flatMap((s) => [s.title, ...s.lines]);
      await e.reply(["主人说明", ...lines, shot.message].join("\n"));
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
      "增减请到网页控制台通道设置",
    ];
    await e.reply(lines.join("\n"));
  }
}

export default new ZMasterPlugin();
