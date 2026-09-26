import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";
import {
  DEFAULT_CFG,
  normalizeCfg,
  persistPluginConfig,
  type MediaParseCfg,
} from "./lib/config.js";
import { isDouyinText, resolveDouyin, downloadDouyinVideo } from "./lib/douyin.js";
import {
  startDouyinLoginHub,
  type DouyinLoginHub,
  type LoginSuccessInfo,
} from "./lib/douyin-login.js";
import { isKuaishouText, resolveKuaishou, downloadKuaishouVideo } from "./lib/kuaishou.js";
import { sendImages, sendLocalVideo, sendMusicAsRecord } from "./lib/send.js";

const PLUGIN_ID = "z.media-parse";

type LoginNotifyTarget = {
  botId?: string;
  messageType: "group" | "private";
  groupId?: number;
  userId: number;
  ob11: NonNullable<PluginContext["ob11"]>;
};

/** 抖音 / 快手短链自动解析。指令仅保留 #抖音登录；菜单并入主 #菜单。 */
export class ZMediaParsePlugin extends Plugin {
  manifest = {
    id: PLUGIN_ID,
    name: "影链解析",
    version: "0.3.3",
    priority: 320,
    category: "utility" as const,
    kind: "framework" as const,
    adapterScope: "all" as const,
    permissions: ["channel.send" as const],
  };

  rule = [
    {
      reg: "^#抖音登录$",
      fnc: "douyinLogin",
      describe: "打开抖音扫码/粘贴 Cookie 登录页",
      permission: "master" as const,
    },
  ];

  configSchema = [
    {
      key: "enabled",
      label: "总开关",
      type: "boolean" as const,
      default: true,
      description: "关闭后不解析、不响应 #抖音登录",
    },
    {
      key: "autoResolve",
      label: "自动识别链接",
      type: "boolean" as const,
      default: true,
      description: "群里文案含抖音/快手短链时自动解析发送",
    },
    {
      key: "douyinEnabled",
      label: "抖音解析",
      type: "boolean" as const,
      default: true,
    },
    {
      key: "kuaishouEnabled",
      label: "快手解析",
      type: "boolean" as const,
      default: true,
    },
    {
      key: "douyinCookie",
      label: "抖音 Cookie",
      type: "textarea" as const,
      default: "",
      description: "可手填；也可用 #抖音登录 弹出真实抖音网页扫码写入",
    },
    {
      key: "douyinPreferSsr",
      label: "抖音优先分享页兜底",
      type: "boolean" as const,
      default: true,
    },
    {
      key: "maxDurationSec",
      label: "最长时长（秒）",
      type: "number" as const,
      default: 480,
      description: "超过则只发标题不下载视频",
    },
    {
      key: "groupFileOverMb",
      label: "改发群文件阈值（MB）",
      type: "number" as const,
      default: 15,
      description: "视频大于该大小直接上传群文件，减轻刷屏与协议压力",
    },
    {
      key: "kuaishouApis",
      label: "快手第三方接口",
      type: "textarea" as const,
      default: DEFAULT_CFG.kuaishouApis,
      description: "每行一个，URL 里用 {} 占位，失败自动轮询",
    },
    {
      key: "loginPort",
      label: "抖音登录页端口",
      type: "number" as const,
      default: 17988,
    },
  ];

  private cfg: MediaParseCfg = { ...DEFAULT_CFG };
  private loginHub: DouyinLoginHub | null = null;
  private loginStarting: Promise<void> | null = null;
  private busy = new Set<string>();
  private loginNotify: LoginNotifyTarget | null = null;

  getConfig() {
    return { ...this.cfg };
  }

  setConfig(next: Record<string, unknown>) {
    const prevPort = this.cfg.loginPort;
    this.cfg = normalizeCfg(next);
    if (this.loginHub && this.cfg.loginPort !== prevPort) {
      void this.restartLoginHub();
    }
  }

  async onReady(ctx: PluginContext) {
    await this.ensureLoginHub();
    const url = this.loginHub?.lanUrl || "";
    return [
      "影链解析就绪",
      this.cfg.douyinEnabled ? "· 抖音开" : "· 抖音关",
      this.cfg.kuaishouEnabled ? "· 快手开" : "· 快手关",
      url ? `· 登录页 ${url}` : "· 登录页未启动",
      ctx.pluginId,
    ];
  }

  private async onLoginSuccess(info: LoginSuccessInfo) {
    this.cfg = { ...this.cfg, douyinCookie: info.cookie };
    persistPluginConfig(PLUGIN_ID, { ...this.cfg });
    const text = `恭喜，「${info.nickname || "抖音账号"}」登录成功。`;
    const target = this.loginNotify;
    if (!target?.ob11?.call) return;
    try {
      const params =
        target.messageType === "group" && target.groupId
          ? {
              message_type: "group" as const,
              group_id: target.groupId,
              message: text,
            }
          : {
              message_type: "private" as const,
              user_id: target.userId,
              message: text,
            };
      await target.ob11.call("send_msg", params, { botId: target.botId });
    } catch (e) {
      console.warn(
        `[影链解析] 登录成功通知失败：${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  private async ensureLoginHub(): Promise<void> {
    if (this.loginHub) return;
    if (this.loginStarting) return this.loginStarting;
    this.loginStarting = (async () => {
      try {
        this.loginHub = await startDouyinLoginHub({
          port: this.cfg.loginPort,
          onSuccess: (info) => this.onLoginSuccess(info),
        });
      } catch (e) {
        this.loginHub = null;
        console.warn(
          `[影链解析] 登录页启动失败：${e instanceof Error ? e.message : String(e)}`,
        );
      } finally {
        this.loginStarting = null;
      }
    })();
    return this.loginStarting;
  }

  private async restartLoginHub(): Promise<void> {
    if (this.loginHub) {
      try {
        await this.loginHub.close();
      } catch {
        /* ignore */
      }
      this.loginHub = null;
    }
    await this.ensureLoginHub();
  }

  private captureNotifyTarget(e: NexusEvent, ctx: PluginContext) {
    if (!ctx.ob11) {
      this.loginNotify = null;
      return;
    }
    const meta = e.raw.meta || {};
    const mt =
      String(meta.messageType || "") === "group" || String(e.chatId).startsWith("group:")
        ? "group"
        : "private";
    const groupId = Number(meta.groupId ?? String(e.chatId).replace(/^group:/, ""));
    const userId = Number(e.userId);
    this.loginNotify = {
      ob11: ctx.ob11,
      botId: String(meta.botId || meta.selfId || ctx.ob11.selfId?.() || "") || undefined,
      messageType: mt,
      groupId: mt === "group" && Number.isFinite(groupId) ? groupId : undefined,
      userId: Number.isFinite(userId) ? userId : 0,
    };
  }

  async accept(e: NexusEvent, ctx: PluginContext): Promise<boolean | void> {
    if (this.cfg.enabled === false) return false;

    for (const r of this.rule) {
      const re = typeof r.reg === "string" ? new RegExp(r.reg) : r.reg;
      if (!re.test(e.msg)) continue;
      if (r.permission === "master" && ctx.isMaster && !ctx.isMaster(e.userId)) {
        await e.reply("无权限");
        return true;
      }
      const fn = (this as unknown as Record<string, unknown>)[r.fnc];
      if (typeof fn === "function") {
        await (fn as (e: NexusEvent, ctx: PluginContext) => Promise<void>).call(this, e, ctx);
        return true;
      }
    }

    if (!this.cfg.autoResolve) return false;
    if (/^\s*#/.test(e.msg)) return false;

    if (this.cfg.douyinEnabled && isDouyinText(e.msg)) {
      await this.handleDouyin(e, ctx);
      return true;
    }
    if (this.cfg.kuaishouEnabled && isKuaishouText(e.msg)) {
      await this.handleKuaishou(e, ctx);
      return true;
    }
    return false;
  }

  async douyinLogin(e: NexusEvent, ctx: PluginContext) {
    await this.ensureLoginHub();
    if (!this.loginHub) {
      await e.reply(
        `登录页未启动。请检查端口 ${this.cfg.loginPort} 是否被占用，或在控制台改「抖音登录页端口」后重载插件。`,
      );
      return;
    }
    this.captureNotifyTarget(e, ctx);

    let tip = "正在弹出本机抖音网页，请用手机 App 扫码登录。";
    try {
      const session = await this.loginHub.startBrowserLogin();
      if (session.status === "error") {
        tip = session.error || tip;
      } else if (session.status === "waiting" || session.status === "launching") {
        tip = "本机已打开（或正在打开）抖音网页，请扫码；成功后会在这里通知你。";
      } else if (session.status === "confirmed") {
        tip = `恭喜，「${session.nickname || "抖音账号"}」登录成功。`;
      }
    } catch (err) {
      tip = err instanceof Error ? err.message : String(err);
    }
    await e.reply(
      [
        "抖音登录",
        tip,
        `状态页：${this.loginHub.localUrl}?auto=1`,
        `局域网：${this.loginHub.lanUrl}?auto=1`,
      ].join("\n"),
    );
  }

  private lockKey(e: NexusEvent): string {
    return `${e.channel}:${e.chatId}`;
  }

  private async handleDouyin(e: NexusEvent, ctx: PluginContext) {
    const key = this.lockKey(e);
    if (this.busy.has(key)) {
      await e.reply("抖音：正在解析中，稍等");
      return;
    }
    this.busy.add(key);
    try {
      await e.reply("抖音：视频正在解析…");
      const resolved = await resolveDouyin(e.msg, {
        cookie: this.cfg.douyinCookie,
        preferSsr: this.cfg.douyinPreferSsr,
      });
      if (!resolved.ok) {
        await e.reply(`抖音：${resolved.message}`);
        return;
      }
      const d = resolved.data;
      const title = d.desc.replace(/\s+/g, " ").slice(0, 80) || "无标题";
      await e.reply(`抖音：${title}`);

      const isAlbum = Boolean(d.images?.length && !d.videoUrl);

      if (isAlbum) {
        await sendImages(e, d.images || []);
        if (d.musicUrl) await sendMusicAsRecord(e, ctx, d.musicUrl);
        return;
      }

      if (d.durationSec > 0 && d.durationSec > this.cfg.maxDurationSec) {
        await e.reply(
          `时长约 ${(d.durationSec / 60).toFixed(1)} 分钟，超过上限，已跳过下载`,
        );
        return;
      }

      await e.reply("视频正在下载…");
      const dl = await downloadDouyinVideo(d);
      if (!dl.ok) {
        if (d.images?.length) {
          await sendImages(e, d.images);
          if (d.musicUrl) await sendMusicAsRecord(e, ctx, d.musicUrl);
          return;
        }
        await e.reply(`抖音：${dl.message}`);
        return;
      }
      await sendLocalVideo(e, ctx, dl.path, { groupFileOverMb: this.cfg.groupFileOverMb });
      if (d.images?.length && d.musicUrl) {
        await sendMusicAsRecord(e, ctx, d.musicUrl);
      }
    } finally {
      this.busy.delete(key);
    }
  }

  private async handleKuaishou(e: NexusEvent, ctx: PluginContext) {
    const key = this.lockKey(e);
    if (this.busy.has(key)) {
      await e.reply("快手：正在解析中，稍等");
      return;
    }
    this.busy.add(key);
    try {
      await e.reply("快手：视频正在解析…");
      const resolved = await resolveKuaishou(e.msg, this.cfg);
      if (!resolved.ok) {
        await e.reply(`快手：${resolved.message}`);
        return;
      }
      const d = resolved.data;
      const title = (d.title || "无标题").replace(/\s+/g, " ").slice(0, 80);
      await e.reply(`快手：${title}`);

      if (d.images?.length && !d.videoUrl) {
        await sendImages(e, d.images);
        return;
      }

      await e.reply("视频正在下载…");
      const dl = await downloadKuaishouVideo(d);
      if (!dl.ok) {
        await e.reply(`快手：${dl.message}`);
        return;
      }
      await sendLocalVideo(e, ctx, dl.path, { groupFileOverMb: this.cfg.groupFileOverMb });
    } finally {
      this.busy.delete(key);
    }
  }
}

export default new ZMediaParsePlugin();
