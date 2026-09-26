import { pathToFileURL } from "node:url";
import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";

type Section = { title: string; lines: string[] };

/** 统一帮助图：框架 + 各功能子菜单指令都塞进来。单插件菜单图仍可单独发。 */
const SECTIONS: Section[] = [
  {
    title: "电源",
    lines: ["#关机 — 暂停应答", "#开机 — 恢复应答", "#重启 — 重启"],
  },
  {
    title: "更新与状态",
    lines: ["#更新 — 更新框架与系统插件包", "#状态 — 运行状态"],
  },
  {
    title: "帮助",
    lines: ["#菜单 / #帮助 / #唤群主秘诀 — 本页总览"],
  },
  {
    title: "群管",
    lines: [
      "#踢 @对方 — 踢出",
      "#踢黑 @对方 — 踢出并拉黑",
      "#踢片姐 @对方 — 踢黑并撤回其24小时内消息",
      "#禁言 @对方 10分 — 禁言",
      "#解禁 @对方 — 解除禁言",
      "#全体禁言 / #全体解禁",
      "#群公告 内容 — 发公告",
      "#群文件 — 看群文件",
      "#群管 — 群管专页",
    ],
  },
  {
    title: "全部发言",
    lines: [
      "#全部发言 @对方 — 按日汇总本群发言并合并转发",
      "#全部发言 QQ号 — 同上",
      "#全部发言菜单 — 专页",
    ],
  },
  {
    title: "主人",
    lines: [
      "#主人列表 — 只读查看",
      "#主人菜单 — 说明",
      "增减主人请到网页控制台通道设置",
    ],
  },
  {
    title: "进退群",
    lines: ["进群欢迎 / 退群送别自动发", "#进退群菜单 — 专页与配置说明"],
  },
  {
    title: "点赞",
    lines: ["#赞我 — 给自己点赞", "触发词：赞我、点个赞、给我点赞", "#点赞菜单 — 专页"],
  },
  {
    title: "生图与回声",
    lines: [
      "#生图 — 示例菜单图",
      "#生图菜单 — 专页",
      "#echo 文本 — 原样回一段",
      "#回声菜单 — 专页",
    ],
  },
  {
    title: "影链解析",
    lines: [
      "群内发抖音 / 快手短链或分享文案 → 自动解析发视频",
      "过大视频改发群文件（控制台可调阈值）",
      "图文背景音乐用语音条发送",
      "#抖音登录 — 弹出真实抖音网页扫码（对齐续火花助手）",
    ],
  },
];

export class ZMenuPlugin extends Plugin {
  manifest = {
    id: "z.menu",
    name: "菜单",
    version: "0.3.1",
    priority: 10,
    category: "basic" as const,
    kind: "framework" as const,
    adapterScope: "all" as const,
    permissions: ["channel.send" as const],
    description: "统一帮助图：框架与各插件指令总览",
  };

  rule = [
    { reg: "^#菜单$", fnc: "menu", describe: "统一帮助" },
    { reg: "^#帮助$", fnc: "menu", describe: "统一帮助" },
    { reg: "^#help$", fnc: "menu", describe: "统一帮助" },
    { reg: "^#唤群主秘诀$", fnc: "menu", describe: "统一帮助" },
    { reg: "^#召唤群主秘诀$", fnc: "menu", describe: "统一帮助" },
  ];

  async onReady(_ctx: PluginContext) {}

  async menu(e: NexusEvent, ctx: PluginContext) {
    const shot = await ctx.shot.renderMenu({
      title: "帮助总览",
      sections: SECTIONS,
    });
    if (!shot.ok) {
      const lines = SECTIONS.flatMap((s) => [s.title, ...s.lines]);
      await e.reply(["Fengyun Nexus", ...lines, shot.message].join("\n"));
      return;
    }
    await e.replyImage(pathToFileURL(shot.pngPath).href);
  }
}

export default new ZMenuPlugin();
