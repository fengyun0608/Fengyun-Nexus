import { Plugin, type PluginContext } from "@fengyun/nexus-plugin-sdk";

type Cfg = {
  enabled: boolean;
  text: string;
  group: string;
};

const G = globalThis as typeof globalThis & {
  __nexusZGoodnightTimer?: ReturnType<typeof setInterval>;
  __nexusZGoodnightTick?: () => void;
};

/** 每天 0 点往指定群发一句。群里无指令，只靠定时。 */
export class ZGoodnightPlugin extends Plugin {
  manifest = {
    id: "z.goodnight",
    name: "你看我看",
    version: "0.1.0",
    priority: 2100,
    category: "local" as const,
    kind: "channel" as const,
    adapterScope: "channel" as const,
    channels: ["onebot11"],
    permissions: ["channel.send" as const],
    description: "每天 0 点往群里发一句，可改开关和文案",
  };

  /** 无群指令 */
  rule = [];

  configSchema = [
    {
      key: "enabled",
      label: "启用",
      type: "boolean" as const,
      default: true,
    },
    {
      key: "text",
      label: "文案",
      type: "string" as const,
      default: "起来重睡",
    },
    {
      key: "group",
      label: "群号",
      type: "string" as const,
      default: "1094247519",
    },
  ];

  private cfg: Cfg = {
    enabled: true,
    text: "起来重睡",
    group: "1094247519",
  };

  private lastSentDay = "";

  getConfig() {
    return { ...this.cfg };
  }

  setConfig(next: Record<string, unknown>) {
    this.cfg = {
      enabled: next.enabled !== false,
      text: String(next.text ?? this.cfg.text || "起来重睡"),
      group: String(next.group ?? this.cfg.group || "1094247519").trim(),
    };
  }

  async onReady(ctx: PluginContext) {
    if (G.__nexusZGoodnightTimer) clearInterval(G.__nexusZGoodnightTimer);
    G.__nexusZGoodnightTick = () => {
      void this.tick(ctx);
    };
    G.__nexusZGoodnightTimer = setInterval(() => G.__nexusZGoodnightTick?.(), 20_000);
    ctx.log("你看我看 · 半夜提醒已挂上");
    return "你看我看";
  }

  private async tick(ctx: PluginContext) {
    if (this.cfg.enabled === false) return;
    const now = new Date();
    if (now.getHours() !== 0 || now.getMinutes() !== 0) return;
    const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    if (this.lastSentDay === day) return;
    const gid = Number(this.cfg.group);
    if (!Number.isFinite(gid) || gid <= 0) {
      ctx.log("半夜提醒：群号无效");
      return;
    }
    if (!ctx.ob11) {
      ctx.log("半夜提醒：OneBot 未就绪");
      return;
    }
    this.lastSentDay = day;
    const text = String(this.cfg.text || "起来重睡").trim() || "起来重睡";
    try {
      await ctx.ob11.call("send_group_msg", {
        group_id: gid,
        message: text,
      });
    } catch (e) {
      this.lastSentDay = "";
      ctx.log(`半夜提醒发不出：${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

export default new ZGoodnightPlugin();
