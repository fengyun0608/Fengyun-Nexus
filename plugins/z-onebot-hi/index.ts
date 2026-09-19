import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";

/** Channel plugin sample — only responds on onebot11. */
export class ZOnebotHiPlugin extends Plugin {
  manifest = {
    id: "z.onebot.hi",
    name: "QQ 打招呼",
    version: "0.1.0",
    priority: 1100,
    category: "demo" as const,
    kind: "channel" as const,
    adapterScope: "channel" as const,
    channels: ["onebot11"],
    permissions: ["channel.send" as const],
  };

  rule = [
    {
      reg: "^#hi$",
      fnc: "hi",
      describe: "QQ 通道打招呼",
    },
  ];

  async onReady(_ctx: PluginContext) {}

  async hi(e: NexusEvent) {
    if (e.channel !== "onebot11") return;
    await e.reply("你好，这是 QQ OneBot 11 通道插件。");
  }
}

export default new ZOnebotHiPlugin();
