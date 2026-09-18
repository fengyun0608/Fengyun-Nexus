import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";

/** 规则在 plugin/；分目录加载 */
export class ZModularPlugin extends Plugin {
  manifest = {
    id: "z.modular",
    name: "模块化",
    version: "0.1.0",
    priority: 1100,
    category: "demo" as const,
    kind: "framework" as const,
    adapterScope: "all" as const,
    permissions: ["channel.send" as const],
  };

  rule = [
    {
      reg: "^#模块化$",
      fnc: "hello",
      describe: "验证分目录插件",
    },
  ];

  async onReady(ctx: PluginContext) {
    ctx.log("模块化插件就绪");
  }

  async hello(e: NexusEvent) {
    await e.reply("模块化 OK：来自 plugin/");
  }
}

export default new ZModularPlugin();
