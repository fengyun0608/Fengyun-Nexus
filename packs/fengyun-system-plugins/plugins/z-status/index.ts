import { pathToFileURL } from "node:url";
import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";

/**
 * 运行状态图 — `#状态`
 * 文案由宿主 runtime.statusLines 提供，插件只负责出图。
 */
export class ZStatusPlugin extends Plugin {
  manifest = {
    id: "z.status",
    name: "状态",
    version: "0.1.0",
    priority: 12,
    category: "basic" as const,
    kind: "framework" as const,
    adapterScope: "all" as const,
    permissions: ["channel.send" as const],
  };

  rule = [
    {
      reg: "^#状态$",
      fnc: "status",
      describe: "框架与运行状态图",
    },
  ];

  async onReady(ctx: PluginContext) {
    ctx.log("状态插件就绪");
  }

  async status(e: NexusEvent, ctx: PluginContext) {
    const lines = ctx.runtime.statusLines();
    const shot = await ctx.shot.renderMenu({
      title: "运行状态",
      lines,
    });
    if (!shot.ok) {
      await e.reply(lines.concat(shot.message).join("\n"));
      return;
    }
    await e.replyImage(pathToFileURL(shot.pngPath).href);
  }
}

export default new ZStatusPlugin();
