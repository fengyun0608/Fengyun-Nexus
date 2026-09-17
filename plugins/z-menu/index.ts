import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";

/** Built-in menu — `#菜单`. Low priority number = runs first. */
export class ZMenuPlugin extends Plugin {
  manifest = {
    id: "z.menu",
    name: "菜单",
    version: "0.1.0",
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

  async menu(e: NexusEvent) {
    await e.reply(
      [
        "Fengyun Nexus",
        "#帮助 — 管理指令",
        "#状态 — 运行状态",
        "#菜单 — 功能菜单",
        "#生图 — 菜单图截图发群",
        "#echo 文本 — 回声",
      ].join("\n"),
    );
  }
}

export default new ZMenuPlugin();
