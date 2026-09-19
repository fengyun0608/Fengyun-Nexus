import { pathToFileURL } from "node:url";
import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";

/**
 * 生图 = 调用系统截图把菜单/网页渲好后发群。
 * 不是 AI 文生图。
 */
export class ZDrawPlugin extends Plugin {
  manifest = {
    id: "z.draw",
    name: "生图",
    version: "0.3.0",
    priority: 20,
    category: "basic" as const,
    kind: "framework" as const,
    adapterScope: "all" as const,
    permissions: ["channel.send" as const],
  };

  rule = [
    {
      reg: "^#生图\\s*(.*)$",
      fnc: "draw",
      describe: "系统截图：菜单图发群",
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
      key: "width",
      label: "截图宽度",
      type: "number" as const,
      description: "预留；当前固定版式",
      default: 720,
    },
  ];

  private cfg: Record<string, unknown> = { enabled: true, width: 720 };

  getConfig() {
    return { ...this.cfg };
  }

  setConfig(next: Record<string, unknown>) {
    this.cfg = {
      enabled: next.enabled !== false,
      width: Number(next.width ?? 720) || 720,
    };
  }

  async onReady(ctx: PluginContext) {
    ctx.log("生图插件就绪：系统截图");
  }

  async draw(e: NexusEvent, ctx: PluginContext) {
    if (this.cfg.enabled === false) return;
    const m = e.msg.match(/^#生图\s*(.*)$/);
    const arg = (m?.[1] ?? "").trim();

    const lines = [
      "电源",
      "#关机 — 暂停应答",
      "#开机 — 恢复应答",
      "#重启 — 重启",
      "更新",
      "#更新 — 更新框架与系统插件",
      "状态",
      "#状态 — 运行状态",
      "菜单",
      "#菜单 — 功能菜单",
      "#帮助 — 功能菜单",
    ];

    const shot = await ctx.shot.renderMenu({
      title: arg && arg !== "菜单" && arg !== "menu" ? arg : "功能菜单",
      lines,
    });

    if (!shot.ok) {
      await e.reply(`生图未完成\n${shot.message}\n已写出网页：${shot.htmlPath}`);
      return;
    }

    await e.replyImage(pathToFileURL(shot.pngPath).href);
  }
}

export default new ZDrawPlugin();
