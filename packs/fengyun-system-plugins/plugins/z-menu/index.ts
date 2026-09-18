import { pathToFileURL } from "node:url";
import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";

/** Built-in menu — `#菜单`. Low priority number = runs first. */
export class ZMenuPlugin extends Plugin {
  manifest = {
    id: "z.menu",
    name: "菜单",
    version: "0.1.2",
    priority: 10,
    category: "basic" as const,
    kind: "framework" as const,
    adapterScope: "all" as const,
    permissions: ["channel.send" as const],
  };

  rule = [
    {
      reg: "^#菜单$",
      fnc: "menu",
      describe: "显示功能菜单",
    },
  ];

  async onReady(ctx: PluginContext) {
    ctx.log("菜单插件就绪");
  }

  async menu(e: NexusEvent, ctx: PluginContext) {
    const lines = [
      "#帮助 — 管理指令",
      "#状态 — 框架与运行信息",
      "#菜单 — 功能菜单",
      "#更新 — 框架与系统插件",
      "#生图 — 菜单图截图发群",
      "#echo 文本 — 回声",
    ];
    const shot = await ctx.shot.renderMenu({
      title: "功能菜单",
      lines,
    });
    if (!shot.ok) {
      await e.reply(["Fengyun Nexus", ...lines, shot.message].join("\n"));
      return;
    }
    await e.replyImage(pathToFileURL(shot.pngPath).href);
  }
}

export default new ZMenuPlugin();
