import { pathToFileURL } from "node:url";
import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";

/** 回声示例。本插件自带 #回声菜单。 */
export class ZEchoPlugin extends Plugin {
  manifest = {
    id: "z.echo",
    name: "回声",
    version: "0.2.0",
    priority: 1000,
    category: "demo" as const,
    kind: "framework" as const,
    adapterScope: "all" as const,
    permissions: ["channel.send" as const],
  };

  rule = [
    { reg: "^#回声菜单$", fnc: "menu", describe: "回声菜单" },
    {
      reg: "^#echo\\s+(.+)$",
      fnc: "echo",
      describe: "回声文本",
    },
  ];

  configSchema = [
    {
      key: "prefix",
      label: "回复前缀",
      type: "string" as const,
      description: "可选，拼在回声内容前",
      default: "",
    },
    {
      key: "enabled",
      label: "启用",
      type: "boolean" as const,
      default: true,
    },
  ];

  private cfg: Record<string, unknown> = { prefix: "", enabled: true };

  getConfig() {
    return { ...this.cfg };
  }

  setConfig(next: Record<string, unknown>) {
    this.cfg = {
      prefix: String(next.prefix ?? ""),
      enabled: next.enabled !== false,
    };
  }

  async onReady(_ctx: PluginContext) {}

  async menu(e: NexusEvent, ctx: PluginContext) {
    const sections = [
      {
        title: "用法",
        lines: ["#echo 文本 — 原样回一段字"],
      },
      {
        title: "组合",
        lines: ["适合练写法；可与菜单、生图同装做截图联调"],
      },
    ];
    const shot = await ctx.shot.renderMenu({ title: "回声菜单", sections });
    if (!shot.ok) {
      const lines = sections.flatMap((s) => [s.title, ...s.lines]);
      await e.reply(["回声菜单", ...lines, shot.message].join("\n"));
      return;
    }
    await e.replyImage(pathToFileURL(shot.pngPath).href);
  }

  async echo(e: NexusEvent) {
    if (this.cfg.enabled === false) return;
    const m = e.msg.match(/^#echo\s+(.+)$/);
    const body = m?.[1] ?? "";
    const prefix = String(this.cfg.prefix ?? "");
    await e.reply(prefix ? `${prefix}${body}` : body);
  }
}

export default new ZEchoPlugin();
