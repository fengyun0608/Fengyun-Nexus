import { pathToFileURL } from "node:url";
import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";

/**
 * 运行状态面板 — `#状态`
 * 宿主提供 statusHtml / statusLines，插件负责截图发送。
 */
export class ZStatusPlugin extends Plugin {
  manifest = {
    id: "z.status",
    name: "状态",
    version: "0.2.0",
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
      describe: "运行状态面板图",
    },
  ];

  async onReady(ctx: PluginContext) {
    ctx.log("状态插件就绪：面板出图");
  }

  async status(e: NexusEvent, ctx: PluginContext) {
    const html = ctx.runtime.statusHtml();
    const shot = await ctx.shot.renderHtml({
      html,
      selector: "#panel",
      width: 820,
      height: 1200,
    });
    if (!shot.ok) {
      const lines = ctx.runtime.statusLines();
      await e.reply(lines.concat(shot.message).join("\n"));
      return;
    }
    await e.replyImage(pathToFileURL(shot.pngPath).href);
  }
}

export default new ZStatusPlugin();
