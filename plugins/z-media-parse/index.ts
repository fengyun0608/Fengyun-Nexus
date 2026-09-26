import { pathToFileURL } from "node:url";
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
  saveQrPng,
  type DouyinLoginHub,
} from "./lib/douyin-login.js";
import { isKuaishouText, resolveKuaishou, downloadKuaishouVideo } from "./lib/kuaishou.js";
import { sendImages, sendLocalVideo } from "./lib/send.js";

const PLUGIN_ID = "z.media-parse";

/** 抖音 / 快手链接解析。控制台可开关；抖音支持扫码登录自动写 Cookie；快手走第三方轮询。 */
export class ZMediaParsePlugin extends Plugin {
  manifest = {
    id: PLUGIN_ID,
    name: "影链解析",
    version: "0.1.0",
    priority: 320,
    category: "utility" as const,
    kind: "framework" as const,
    adapterScope: "all" as const,
    permissions: ["channel.send" as const],
  };

  rule = [
    { reg: "^#影链菜单$", fnc: "menu", describe: "影链解析菜单" },
    { reg: "^#抖音登录$", fnc: "douyinLogin", describe: "打开抖音扫码登录页", permission: "master" as const },
    { reg: "^#解析\\s*", fnc: "parseCmd", describe: "手动解析链接" },
  ];

  configSchema = [
    {
      key: "enabled",
      label: "总开关",
      type: "boolean" as const,
      default: true,
      description: "关闭后不解析、不响应指令",
    },
    {
      key: "autoResolve",
      label: "自动识别链接",
      type: "boolean" as const,
      default: true,
      description: "群里直接发抖音/快手链接就解析，无需 #解析",
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
      description: "可手填；也可用 #抖音登录 扫码自动写入",
    },
    {
      key: "douyinPreferSsr",
      label: "抖音优先分享页兜底",
      type: "boolean" as const,
      default: true,
      description: "先试分享页，再试官方 Web 接口",
    },
    {
      key: "maxDurationSec",
      label: "最长时长（秒）",
      type: "number" as const,
      default: 480,
      description: "超过则只发文案不下载视频",
    },
    {
      key: "kuaishouApis",
      label: "快手第三方接口",
      type: "textarea" as const,
      default: DEFAULT_CFG.kuaishouApis,
      description: "每行一个，URL 里用 {} 占位作品链接，失败自动轮询下一个",
    },
    {
      key: "loginPort",
      label: "抖音登录页端口",
      type: "number" as const,
      default: 17988,
      description: "本机打开 http://局域网IP:端口/douyin-login 扫码",
    },
    {
      key: "identifyPrefix",
      label: "识别前缀",
      type: "string" as const,
      default: "识别：",
    },
  ];

  private cfg: MediaParseCfg = { ...DEFAULT_CFG };
  private loginHub: DouyinLoginHub | null = null;
  private loginStarting: Promise<void> | null = null;
  private busy = new Set<string>();

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

  private async ensureLoginHub(): Promise<void> {
    if (this.loginHub) return;
    if (this.loginStarting) return this.loginStarting;
    this.loginStarting = (async () => {
      try {
        this.loginHub = await startDouyinLoginHub({
          port: this.cfg.loginPort,
          onCookie: async (cookie) => {
            this.cfg = { ...this.cfg, douyinCookie: cookie };
            persistPluginConfig(PLUGIN_ID, { ...this.cfg });
          },
        });
      } catch (e) {
        this.loginHub = null;
        // 端口占用时不挡插件加载
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

  async menu(e: NexusEvent, ctx: PluginContext) {
    const sections = [
      {
        title: "解析",
        lines: [
          "直接发抖音 / 快手链接（可关自动识别）",
          "#解析 + 链接 — 手动触发",
        ],
      },
      {
        title: "抖音登录",
        lines: [
          "#抖音登录 — 输出扫码页链接（主人）",
          "手机抖音扫码确认后 Cookie 自动写入",
        ],
      },
      {
        title: "控制台",
        lines: [
          "总开关 / 抖音 / 快手 / 自动识别",
          "快手第三方接口可多行轮询",
        ],
      },
    ];
    const shot = await ctx.shot.renderMenu({ title: "影链解析", sections });
    if (!shot.ok) {
      const lines = sections.flatMap((s) => [s.title, ...s.lines.map((x) => `· ${x}`)]);
      await e.reply(["影链解析", ...lines].join("\n"));
      return;
    }
    await e.replyImage(pathToFileURL(shot.pngPath).href);
  }

  async douyinLogin(e: NexusEvent, _ctx: PluginContext) {
    await this.ensureLoginHub();
    if (!this.loginHub) {
      await e.reply(`登录页未启动。请检查端口 ${this.cfg.loginPort} 是否被占用，或在控制台改「抖音登录页端口」后重载插件。`);
      return;
    }
    const session = await this.loginHub.ensureSession();
    const qrPath = await saveQrPng(session);
    await e.reply(
      [
        "抖音扫码登录",
        `本机：${this.loginHub.localUrl}`,
        `局域网：${this.loginHub.lanUrl}`,
        "用抖音 App 扫码并确认；成功后 Cookie 会自动写入控制台配置。",
      ].join("\n"),
    );
    if (qrPath) {
      await e.replyImage(pathToFileURL(qrPath).href);
    }
  }

  async parseCmd(e: NexusEvent, ctx: PluginContext) {
    if (this.cfg.douyinEnabled && isDouyinText(e.msg)) {
      await this.handleDouyin(e, ctx);
      return;
    }
    if (this.cfg.kuaishouEnabled && isKuaishouText(e.msg)) {
      await this.handleKuaishou(e, ctx);
      return;
    }
    await e.reply("请带上抖音或快手链接，例如：#解析 https://v.douyin.com/xxx");
  }

  private lockKey(e: NexusEvent): string {
    return `${e.channel}:${e.chatId}:${e.userId}`;
  }

  private async handleDouyin(e: NexusEvent, ctx: PluginContext) {
    const key = this.lockKey(e);
    if (this.busy.has(key)) {
      await e.reply("正在解析中，稍等一下");
      return;
    }
    this.busy.add(key);
    try {
      const resolved = await resolveDouyin(e.msg, {
        cookie: this.cfg.douyinCookie,
        preferSsr: this.cfg.douyinPreferSsr,
      });
      if (!resolved.ok) {
        await e.reply(resolved.message);
        return;
      }
      const d = resolved.data;
      const head = `${this.cfg.identifyPrefix}抖音${d.images?.length && !d.videoUrl ? "图集" : ""}，作者：${d.author}\n📝 ${d.desc}\n（${d.via}）`;

      if (d.images?.length && !d.videoUrl) {
        await sendImages(e, d.images, head);
        return;
      }

      if (d.durationSec > 0 && d.durationSec > this.cfg.maxDurationSec) {
        await e.reply(
          `${head}\n时长约 ${(d.durationSec / 60).toFixed(1)} 分钟，超过上限 ${Math.round(this.cfg.maxDurationSec / 60)} 分钟，已跳过下载`,
        );
        return;
      }

      const dl = await downloadDouyinVideo(d);
      if (!dl.ok) {
        if (d.images?.length) {
          await sendImages(e, d.images, `${head}\n视频下载失败，改发封面/图集`);
          return;
        }
        await e.reply(`${head}\n${dl.message}`);
        return;
      }
      await sendLocalVideo(e, ctx, dl.path, head);
    } finally {
      this.busy.delete(key);
    }
  }

  private async handleKuaishou(e: NexusEvent, ctx: PluginContext) {
    const key = this.lockKey(e);
    if (this.busy.has(key)) {
      await e.reply("正在解析中，稍等一下");
      return;
    }
    this.busy.add(key);
    try {
      const resolved = await resolveKuaishou(e.msg, this.cfg);
      if (!resolved.ok) {
        await e.reply(resolved.message);
        return;
      }
      const d = resolved.data;
      const head = `${this.cfg.identifyPrefix}快手，作者：${d.author}\n📝 ${d.title}\n（${d.via}）`;

      if (d.images?.length && !d.videoUrl) {
        await sendImages(e, d.images, head);
        return;
      }

      const dl = await downloadKuaishouVideo(d);
      if (!dl.ok) {
        await e.reply(`${head}\n${dl.message}`);
        return;
      }
      await sendLocalVideo(e, ctx, dl.path, head);
    } finally {
      this.busy.delete(key);
    }
  }
}

export default new ZMediaParsePlugin();
