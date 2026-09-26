import { pathToFileURL } from "node:url";
import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";
import { assertLangReady, LANG_BY_CMD, type ExecLang } from "./lib/env-gate.js";
import { isDangerous } from "./lib/danger.js";
import { formatRunResult, runLangCode } from "./lib/run.js";

const PLUGIN_ID = "z.exec";
const CONFIRM_TTL_MS = 120_000;

type Pending = {
  msgId: string;
  userId: string;
  chatId: string;
  lang: ExecLang;
  cmd: string;
  code: string;
  expiresAt: number;
};

/**
 * 主人命令执行：#py / #sh / #go / #js …
 * 语言须在控制台「环境配置」就绪；危险指令需引用自己的原消息并回复「确认」。
 */
export class ZExecPlugin extends Plugin {
  manifest = {
    id: PLUGIN_ID,
    name: "命令执行",
    version: "0.1.0",
    priority: 280,
    category: "utility" as const,
    kind: "framework" as const,
    adapterScope: "all" as const,
    permissions: ["channel.send" as const],
  };

  rule = [
    {
      reg: "^#执行菜单$",
      fnc: "menu",
      describe: "命令执行说明",
      permission: "master" as const,
    },
    {
      reg: "^#(py|python|sh|bash|cmd|ps|go|js|node|ts|rs|rust|php|rb|ruby)\\s+([\\s\\S]+)$",
      fnc: "runCmd",
      describe: "执行代码/命令",
      permission: "master" as const,
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
      key: "timeoutSec",
      label: "超时（秒）",
      type: "number" as const,
      default: 30,
      description: "单次执行最长等待",
    },
  ];

  private cfg = { enabled: true, timeoutSec: 30 };
  /** 每位主人各自一条待确认（只能确认自己的） */
  private pending = new Map<string, Pending>();

  getConfig() {
    return { ...this.cfg };
  }

  setConfig(next: Record<string, unknown>) {
    this.cfg = {
      enabled: next.enabled !== false,
      timeoutSec: Math.max(5, Math.min(120, Number(next.timeoutSec) || 30)),
    };
  }

  async onReady() {
    return ["命令执行就绪（仅主人）", "· #py / #sh / #js / #go …", "· 危险指令需引用原消息回复：确认"];
  }

  async accept(e: NexusEvent, ctx: PluginContext): Promise<boolean | void> {
    if (this.cfg.enabled === false) return false;
    if (await this.tryConfirm(e, ctx)) return true;
    return super.accept(e, ctx);
  }

  async menu(e: NexusEvent, ctx: PluginContext) {
    const langs = Object.entries(LANG_BY_CMD)
      .map(([k, v]) => `#${k} → ${v.label}（环境 ${v.runtimeId}）`)
      .filter((line, i, arr) => arr.indexOf(line) === i);
    const sections = [
      {
        title: "用法",
        lines: [
          "#py print(1+1)",
          "#sh echo hello",
          "#js console.log(1)",
          "更多：#go #ts #rs #php #rb #cmd #ps",
        ],
      },
      {
        title: "环境门禁",
        lines: [
          "对应语言须在控制台「环境配置」已安装/登记",
          "未就绪会提示去装，不会直接跑",
        ],
      },
      {
        title: "安全",
        lines: [
          "仅主人可用",
          "危险指令：引用你自己刚发的那条，回复「确认」",
          "每人只能确认自己的待执行指令",
        ],
      },
      { title: "语言对照", lines: langs.slice(0, 14) },
    ];
    const shot = await ctx.shot?.renderMenu?.({ title: "命令执行", sections });
    if (shot?.ok && shot.pngPath) {
      await e.replyImage(pathToFileURL(shot.pngPath).href);
      return;
    }
    await e.reply(
      ["命令执行（仅主人）", ...sections.flatMap((s) => [s.title, ...s.lines.map((l) => `· ${l}`)])].join(
        "\n",
      ),
    );
  }

  async runCmd(e: NexusEvent, ctx: PluginContext) {
    const m = e.msg.match(
      /^#(py|python|sh|bash|cmd|ps|go|js|node|ts|rs|rust|php|rb|ruby)\s+([\s\S]+)$/i,
    );
    if (!m) return;
    const cmd = m[1].toLowerCase();
    const code = m[2].trim();
    if (!code) {
      await e.reply("请在指令后写上要执行的内容");
      return;
    }
    if (code.length > 12_000) {
      await e.reply("内容太长，请拆短一点");
      return;
    }

    const gate = assertLangReady(cmd);
    if (!gate.ok) {
      await e.reply(gate.message);
      return;
    }

    const msgId = String(e.raw.meta?.replyTo || e.id || "").trim();
    if (isDangerous(code)) {
      if (!msgId) {
        await e.reply("危险指令需要消息 ID 才能二次确认，当前通道拿不到消息号");
        return;
      }
      this.pending.set(e.userId, {
        msgId,
        userId: e.userId,
        chatId: e.chatId,
        lang: gate.meta.lang,
        cmd,
        code,
        expiresAt: Date.now() + CONFIRM_TTL_MS,
      });
      await e.reply(
        [
          "检测到危险指令，已暂存，不会立刻执行。",
          `语言：${gate.meta.label}`,
          `摘要：${code.replace(/\s+/g, " ").slice(0, 120)}`,
          "请引用你刚才发的那条指令消息，并回复：确认",
          "（只能确认自己的指令；2 分钟内有效）",
        ].join("\n"),
      );
      return;
    }

    await this.execute(e, gate.meta.lang, gate.meta.label, code);
  }

  private async tryConfirm(e: NexusEvent, ctx: PluginContext): Promise<boolean> {
    const text = e.msg.trim();
    if (!/^(确认|#确认)$/.test(text)) return false;
    if (!ctx.isMaster?.(e.userId)) {
      await e.reply("无权限");
      return true;
    }

    const pending = this.pending.get(e.userId);
    if (!pending) {
      await e.reply("没有待确认的指令。危险操作需先发 #py / #sh …");
      return true;
    }
    if (Date.now() > pending.expiresAt) {
      this.pending.delete(e.userId);
      await e.reply("待确认已过期，请重新发送指令");
      return true;
    }
    if (pending.chatId !== e.chatId) {
      await e.reply("请在原对话里确认");
      return true;
    }

    const quoteId = String(e.raw.meta?.quoteMessageId || "").trim();
    if (!quoteId) {
      await e.reply("请引用你自己刚才那条指令消息，再回复：确认");
      return true;
    }
    if (quoteId !== pending.msgId) {
      await e.reply("引用的不是待确认的那条指令，请引用正确的消息");
      return true;
    }

    // 校验被引用消息确实是本人发的（每人只能确认自己的）
    let quoteUser = String(e.raw.meta?.quoteUserId || "").trim();
    if (!quoteUser && ctx.ob11?.call) {
      const botId = String(e.raw.meta?.botId || e.raw.meta?.selfId || "") || undefined;
      const r = await ctx.ob11.call(
        "get_msg",
        { message_id: Number(quoteId) || quoteId },
        { botId },
      );
      if (r.ok && r.data && typeof r.data === "object") {
        const data = r.data as Record<string, unknown>;
        const sender = (data.sender || {}) as { user_id?: string | number };
        quoteUser =
          data.user_id != null
            ? String(data.user_id)
            : sender.user_id != null
              ? String(sender.user_id)
              : "";
      }
    }
    if (quoteUser && quoteUser !== e.userId) {
      await e.reply("只能引用自己的消息来确认");
      return true;
    }
    if (pending.userId !== e.userId) {
      await e.reply("只能确认自己的待执行指令");
      return true;
    }

    this.pending.delete(e.userId);
    const label = LANG_BY_CMD[pending.cmd]?.label || pending.cmd;
    await e.reply(`已确认，开始执行 ${label}…`);
    await this.execute(e, pending.lang, label, pending.code);
    return true;
  }

  private async execute(e: NexusEvent, lang: ExecLang, label: string, code: string) {
    await e.reply(`${label}：执行中…`);
    try {
      const r = await runLangCode(lang, code);
      await e.reply([`${label}：执行结果`, formatRunResult(r)].join("\n"));
    } catch (err) {
      await e.reply(`${label}：执行异常 ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

export default new ZExecPlugin();
