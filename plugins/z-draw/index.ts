import { pathToFileURL } from "node:url";
import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";
import { renderMenuShot } from "./screenshot.js";

/**
 * 生图 = 用框架自带浏览器把菜单/网页渲好，截图后发到群。
 * 不是 AI 文生图。
 */
export class ZDrawPlugin extends Plugin {
  manifest = {
    id: "z.draw",
    name: "生图",
    version: "0.2.0",
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
      describe: "浏览器渲菜单网页并截图发送",
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
    ctx.log("生图插件就绪：浏览器截菜单图");
  }

  async draw(e: NexusEvent) {
    if (this.cfg.enabled === false) return;
    const m = e.msg.match(/^#生图\s*(.*)$/);
    const arg = (m?.[1] ?? "").trim();
    // 默认 / 菜单 → 功能菜单图
    const kind = !arg || arg === "菜单" || arg === "menu" ? "menu" : "menu";

    const lines =
      kind === "menu"
        ? [
            "#帮助 — 管理指令",
            "#状态 — 运行状态",
            "#菜单 — 功能菜单",
            "#生图 — 菜单图截图发群",
            "#echo 文本 — 回声",
          ]
        : [arg];

    const shot = await renderMenuShot({
      title: arg && arg !== "菜单" && arg !== "menu" ? arg : "功能菜单",
      lines,
    });

    if (!shot.ok) {
      await e.reply(`生图未完成\n${shot.message}\n已写出网页：${shot.htmlPath}`);
      return;
    }

    const fileUrl = pathToFileURL(shot.pngPath).href;
    await e.replyImage(fileUrl, "菜单图");
  }
}

export default new ZDrawPlugin();
