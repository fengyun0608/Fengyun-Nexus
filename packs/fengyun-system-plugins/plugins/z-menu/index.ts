import { pathToFileURL } from "node:url";
import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";

/** 框架菜单。各功能插件另有自己的菜单，这里不收录插件指令。 */
const SECTIONS = [
  {
    title: "电源",
    lines: ["#关机 — 暂停应答", "#开机 — 恢复应答", "#重启 — 重启"],
  },
  {
    title: "更新",
    lines: ["#更新 — 更新框架与系统插件包"],
  },
  {
    title: "状态",
    lines: ["#状态 — 运行状态"],
  },
  {
    title: "菜单",
    lines: ["#菜单 — 框架菜单", "#帮助 — 框架菜单"],
  },
];

export class ZMenuPlugin extends Plugin {
  manifest = {
    id: "z.menu",
    name: "菜单",
    version: "0.2.1",
    priority: 10,
    category: "basic" as const,
    kind: "framework" as const,
    adapterScope: "all" as const,
    permissions: ["channel.send" as const],
  };

  rule = [
    { reg: "^#菜单$", fnc: "menu", describe: "框架菜单" },
    { reg: "^#帮助$", fnc: "menu", describe: "框架菜单" },
    { reg: "^#help$", fnc: "menu", describe: "框架菜单" },
  ];

  async onReady(_ctx: PluginContext) {}

  async menu(e: NexusEvent, ctx: PluginContext) {
    const shot = await ctx.shot.renderMenu({
      title: "框架菜单",
      sections: SECTIONS,
    });
    if (!shot.ok) {
      const lines = SECTIONS.flatMap((s) => [s.title, ...s.lines]);
      await e.reply(["Fengyun Nexus", ...lines, shot.message].join("\n"));
      return;
    }
    await e.replyImage(pathToFileURL(shot.pngPath).href);
  }
}

export default new ZMenuPlugin();
