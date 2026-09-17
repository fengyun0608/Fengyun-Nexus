import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";

/** Sample directory plugin — Z.* id convention. Commands use `#` prefix. */
export class ZEchoPlugin extends Plugin {
  manifest = {
    id: "z.echo",
    name: "Z Echo",
    version: "0.1.1",
    priority: 1000,
    category: "demo" as const,
    kind: "framework" as const,
    adapterScope: "all" as const,
    permissions: ["channel.send" as const],
  };

  rule = [
    {
      reg: "^#echo\\s+(.+)$",
      fnc: "echo",
      describe: "Echo text after #echo",
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

  async onReady(ctx: PluginContext) {
    ctx.log("Z Echo ready");
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
