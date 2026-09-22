import { Plugin, type PluginContext } from "@fengyun/nexus-plugin-sdk";

type Cfg = {
  enabled: boolean;
  text: string;
  group: string;
  botId: string;
};

const G = globalThis as typeof globalThis & {
  __nexusZGoodnightTimer?: ReturnType<typeof setInterval>;
  __nexusZGoodnightTick?: () => void;
};

/** 每天 0 点向指定群发一句；主人可用 #触发晚安立刻试发。 */
export class ZGoodnightPlugin extends Plugin {
  manifest = {
    id: "z.goodnight",
    name: "你看我看",
    version: "0.1.1",
    priority: 2100,
    category: "local" as const,
    kind: "channel" as const,
    adapterScope: "channel" as const,
    channels: ["onebot11"],
    permissions: ["channel.send" as const],
    description: "每天 0 点向群里发一句，可改开关和文案",
  };

  rule = [
    {
      reg: "^#触发晚安$",
      fnc: "triggerNow",
      permission: "master" as const,
      describe: "手动触发一次晚安发送",
    },
  ];

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
    {
      key: "botId",
      label: "机器人号",
      type: "string" as const,
      description: "多号时指定发信账号；空则走默认在线号",
      default: "",
    },
  ];

  private cfg: Cfg = {
    enabled: true,
    text: "起来重睡",
    group: "1094247519",
    botId: "",
  };

  private lastSentDay = "";

  getConfig() {
    return { ...this.cfg };
  }

  setConfig(next: Record<string, unknown>) {
    this.cfg = {
      enabled: next.enabled !== false,
      text: String(next.text ?? this.cfg.text) || "起来重睡",
      group: (String(next.group ?? this.cfg.group) || "1094247519").trim(),
      botId: String(next.botId ?? this.cfg.botId ?? "").trim(),
    };
  }

  async onReady(ctx: PluginContext) {
    if (G.__nexusZGoodnightTimer) clearInterval(G.__nexusZGoodnightTimer);
    G.__nexusZGoodnightTick = () => {
      void this.tick(ctx);
    };
    // 每 15 秒检查一次，降低漏掉 00:00 那一分钟的概率
    G.__nexusZGoodnightTimer = setInterval(() => G.__nexusZGoodnightTick?.(), 15_000);
    ctx.log("你看我看 · 半夜提醒已挂上");
    return "你看我看";
  }

  async triggerNow(e: { reply: (s: string) => Promise<unknown> }, ctx: PluginContext) {
    const msg = await this.sendOnce(ctx, true);
    await e.reply(msg);
  }

  private async tick(ctx: PluginContext) {
    if (this.cfg.enabled === false) return;
    const now = new Date();
    if (now.getHours() !== 0 || now.getMinutes() !== 0) return;
    await this.sendOnce(ctx, false);
  }

  private async sendOnce(ctx: PluginContext, force: boolean): Promise<string> {
    const now = new Date();
    const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    if (!force && this.lastSentDay === day) return "今天已发过";

    const gid = Number(this.cfg.group);
    if (!Number.isFinite(gid) || gid <= 0) {
      ctx.log(`半夜提醒：群号无效 ${this.cfg.group}`);
      return "群号无效";
    }
    if (!ctx.ob11) {
      ctx.log("半夜提醒：OneBot 未就绪");
      return "OneBot 未就绪";
    }

    const text = String(this.cfg.text || "起来重睡").trim() || "起来重睡";
    const botId = this.cfg.botId.trim() || undefined;

    try {
      const r = await ctx.ob11.call(
        "send_group_msg",
        { group_id: gid, message: text },
        botId ? { botId } : undefined,
      );
      if (r && r.ok === false) {
        const msg = r.message || "未知错误";
        ctx.log(`半夜提醒发不出：${msg}`);
        this.lastSentDay = "";
        return `发不出：${msg}`;
      }
      this.lastSentDay = day;
      ctx.log(`半夜提醒已发送到群 ${gid}${botId ? `（bot ${botId}）` : ""}：${text}`);
      return `已发送：${text}`;
    } catch (e) {
      this.lastSentDay = "";
      const msg = e instanceof Error ? e.message : String(e);
      ctx.log(`半夜提醒发不出：${msg}`);
      return `发不出：${msg}`;
    }
  }
}

export default new ZGoodnightPlugin();
