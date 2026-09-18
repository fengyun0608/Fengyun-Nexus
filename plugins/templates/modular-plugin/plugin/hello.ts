import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";

/**
 * 消息规则放 plugin/；同目录还可加多个 *.ts。
 * adapter / workflow / http / events / www 先占位，网关后续按目录挂。
 */
export class ModularDemoPlugin extends Plugin {
  manifest = {
    id: "z.demo.modular",
    name: "模块化示例",
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
      describe: "验证分目录插件能加载",
    },
  ];

  async onReady(ctx: PluginContext) {
    ctx.log("模块化示例就绪（plugin/）");
  }

  async hello(e: NexusEvent) {
    await e.reply("模块化插件 OK：规则来自 plugin/");
  }
}

export default new ModularDemoPlugin();
