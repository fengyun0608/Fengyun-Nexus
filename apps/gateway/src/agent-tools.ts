/**
 * 给 LLM 用的框架工具：状态 / 插件 / 主人 / 工作流 / MCP / QQ 多媒体 / 沙箱。
 * 敏感工具要求主人或控制台。
 */
import { isAbsolute, join } from "node:path";
import type { LlmToolDef } from "@fengyun/nexus-llm";
import type { McpHost } from "@fengyun/nexus-mcp-host";
import type { WorkflowRunner } from "@fengyun/nexus-workflow";
import type { PluginHost } from "@fengyun/nexus-plugin-sdk";
import type { NexusMessage } from "@fengyun/nexus-shared";
import { renderHtmlShot, renderMenuShot } from "@fengyun/browser-shot";
import type { ChannelSettings } from "./channel-settings.js";
import { isChannelMaster, masterLevelOf } from "./channel-settings.js";
import { hostInfo, hostUptime, launchDesktopApp, listOpenDesktopApps } from "./desktop-inspect.js";
import { webRead, webSearch } from "./web-lookup.js";
import {
  runSafeCommand,
  workspaceDelete,
  workspaceList,
  workspaceRead,
  workspaceWrite,
} from "./agent-workspace.js";
import { textToSpeechFile } from "./tts-stt.js";
import { runHostShell } from "./host-shell.js";
import { captureDesktop } from "./screen-capture.js";
import { findAgentSkill, loadAgentSkills } from "./agent-skills.js";
import {
  playMusic,
  uiaClick,
  uiaFocus,
  uiaKeys,
  uiaSetText,
  uiaTree,
  uiaWindows,
} from "./uia-bridge.js";
import {
  webClick,
  webClose,
  webKeys,
  webOpen,
  webScreenshot,
  webSnapshot,
  webType,
} from "./web-control.js";
import type { OneBot11Bridge } from "./onebot11-bridge.js";
import type { OneBotConfig } from "./onebot11-bridge.js";
import { queryLogEntries } from "./log.js";

export type AgentToolBag = {
  mcp: McpHost;
  workflows: WorkflowRunner;
  plugins: PluginHost;
  statusLines: () => string[];
  channelSettings: () => ChannelSettings;
  userId: string;
  isMaster: boolean;
  isAdminConsole?: boolean;
  repoRoot: string;
  /** 当前入站消息上下文，供 QQ 出站 */
  messageCtx?: NexusMessage;
  onebot?: OneBot11Bridge;
  capSink?: string[];
  invokeCapability?: (text: string) => Promise<string[]>;
  setPluginEnabled?: (id: string, enabled: boolean) => { ok: boolean; message: string };
  reloadPlugins?: () => Promise<{ ok: boolean; message: string }>;
  installPack?: (id: string) => Promise<{ ok: boolean; message: string }>;
  installRuntime?: (runtime: string) => { ok: boolean; message: string };
  listRuntimes?: () => unknown;
  patchChannelSettings?: (
    patch: Record<string, unknown>,
  ) => { ok: boolean; message: string };
  patchOneBotConfig?: (
    patch: Record<string, unknown>,
  ) => { ok: boolean; message: string; config?: OneBotConfig };
  getOneBotSnapshot?: () => unknown;
};

const MASTER_TOOLS = new Set([
  "nexus_run_workflow",
  "nexus_call_mcp",
  "nexus_open_apps",
  "nexus_launch_app",
  "nexus_music_play",
  "nexus_host_uptime",
  "nexus_host_info",
  "nexus_logs",
  "nexus_shell",
  "nexus_list_skills",
  "nexus_skill_read",
  "nexus_uia_windows",
  "nexus_uia_tree",
  "nexus_uia_focus",
  "nexus_uia_click",
  "nexus_uia_set_text",
  "nexus_uia_keys",
  "nexus_web_open",
  "nexus_web_snapshot",
  "nexus_web_click",
  "nexus_web_type",
  "nexus_web_keys",
  "nexus_web_screenshot",
  "nexus_web_close",
  "nexus_web_search",
  "nexus_web_read",
  "nexus_list_caps",
  "nexus_call_cap",
  "nexus_plugin_switch",
  "nexus_plugin_reload",
  "nexus_install_pack",
  "nexus_list_runtimes",
  "nexus_install_runtime",
  "nexus_qq_send_image",
  "nexus_qq_send_file",
  "nexus_qq_send_voice",
  "nexus_screen",
  "nexus_shot",
  "nexus_workspace_list",
  "nexus_workspace_read",
  "nexus_workspace_write",
  "nexus_workspace_delete",
  "nexus_run_safe",
  "nexus_channel_get",
  "nexus_channel_patch",
  "nexus_onebot_get",
  "nexus_onebot_patch",
]);

function tool(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required?: string[],
): LlmToolDef {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters: {
        type: "object",
        properties,
        ...(required?.length ? { required } : {}),
        additionalProperties: false,
      },
    },
  };
}

function resolveSendCtx(bag: AgentToolBag, args: Record<string, unknown>): NexusMessage | null {
  const base = bag.messageCtx;
  if (!base) return null;
  const groupId = String(args.group_id || args.groupId || "").trim();
  const userId = String(args.user_id || args.userId || "").trim();
  if (groupId) {
    return {
      ...base,
      chatId: `group:${groupId}`,
      userId: base.userId,
      meta: { ...base.meta, messageType: "group", groupId },
    };
  }
  if (userId) {
    return {
      ...base,
      chatId: `private:${userId}`,
      userId,
      meta: { ...base.meta, messageType: "private", groupId: undefined },
    };
  }
  return base;
}

export function buildAgentToolDefs(_mcp: McpHost): LlmToolDef[] {
  return [
    tool("nexus_status", "查看 Fengyun Nexus 运行状态摘要", {}),
    tool("nexus_list_plugins", "列出已加载插件 id 与名称", {}),
    tool("nexus_list_skills", "列出 skills/agent 运行时技能。不会做某事时先看这里。", {}),
    tool(
      "nexus_skill_read",
      "读取某个运行时技能全文，按里面的步骤做。不会就先读技能。",
      { id: { type: "string", description: "技能 id 或名称，如 framework-helper" } },
      ["id"],
    ),
    tool("nexus_whoami", "查看当前用户是否主人及级别", {}),
    tool("nexus_list_workflows", "列出可用工作流", {}),
    tool(
      "nexus_run_workflow",
      "运行指定工作流（主人或控制台）",
      { id: { type: "string", description: "工作流 id" } },
      ["id"],
    ),
    tool("nexus_list_mcp", "列出 MCP 工具名与说明", {}),
    tool(
      "nexus_call_mcp",
      "调用一个已注册的 MCP 工具（主人或控制台）",
      {
        name: { type: "string", description: "工具名" },
        args: { type: "object", description: "参数对象" },
      },
      ["name"],
    ),
    tool(
      "nexus_web_search",
      "搜索公开网页。有人说搜、查一下、网上看看时必须用这个。",
      { query: { type: "string", description: "搜索词" } },
      ["query"],
    ),
    tool(
      "nexus_web_read",
      "读取一个公开网页的标题和正文摘要。只传 http/https。",
      { url: { type: "string", description: "公开网址" } },
      ["url"],
    ),
    tool("nexus_host_info", "查看本机系统信息：系统、处理器、内存、磁盘、开机时长", {}),
    tool("nexus_host_uptime", "查看这台电脑开机运行了多久", {}),
    tool(
      "nexus_logs",
      "框架内存日志环的快捷查看。查磁盘上的日志文件请用 nexus_shell 读 data/logs/gateway.log，不要改用框架 # 指令。",
      {
        limit: { type: "number", description: "条数，默认 60，最大 200" },
        levels: {
          type: "string",
          description: "级别过滤，逗号分隔，如 ERROR 或 ERROR,WARN。不传则全部",
        },
        contains: { type: "string", description: "消息关键词过滤" },
      },
    ),
    tool(
      "nexus_launch_app",
      "只打开本机软件，不搜歌。听某首歌不要用这个，用 nexus_music_play。",
      { name: { type: "string", description: "软件名，如 ToDesk" } },
      ["name"],
    ),
    tool(
      "nexus_music_play",
      "听歌专用。打开汽水音乐等客户端并在后台搜歌播放。主人说「汽水音乐我要听水手」就只调这个，app=汽水音乐，query=水手。返回的 message 原样说给用户，一句就够。不要再截图、扫窗口、读技能，也不要让用户自己去搜。",
      {
        app: { type: "string", description: "软件名，默认汽水音乐" },
        query: { type: "string", description: "歌名，如 水手" },
      },
      ["query"],
    ),
    tool("nexus_open_apps", "查看本机当前打开的带窗口软件", {
      limit: { type: "number", description: "最多条数" },
    }),
    tool("nexus_list_caps", "列出已加载插件的群内能力", {}),
    tool(
      "nexus_call_cap",
      "调用一条群内插件能力，例如 #菜单",
      { text: { type: "string", description: "指令文本" } },
      ["text"],
    ),
    tool(
      "nexus_plugin_switch",
      "启用或停用插件",
      {
        id: { type: "string" },
        enabled: { type: "boolean" },
      },
      ["id", "enabled"],
    ),
    tool("nexus_plugin_reload", "热重载全部插件", {}),
    tool(
      "nexus_install_pack",
      "从生态专仓安装收录",
      { id: { type: "string" } },
      ["id"],
    ),
    tool("nexus_list_runtimes", "查看可安装运行环境", {}),
    tool(
      "nexus_install_runtime",
      "排队安装 go/python/browser/napcat",
      { runtime: { type: "string" } },
      ["runtime"],
    ),
    tool(
      "nexus_qq_send_image",
      "向当前 QQ 会话发本地图片。path 为本地图片路径。可选 group_id / user_id 改目标。",
      {
        path: { type: "string", description: "本地图片路径" },
        group_id: { type: "string" },
        user_id: { type: "string" },
      },
      ["path"],
    ),
    tool(
      "nexus_qq_send_file",
      "向当前 QQ 会话发本地文件。",
      {
        path: { type: "string" },
        name: { type: "string", description: "显示文件名" },
        group_id: { type: "string" },
        user_id: { type: "string" },
      },
      ["path"],
    ),
    tool(
      "nexus_qq_send_voice",
      "把文字合成语音气泡发到当前 QQ 会话。不要说没有发语音能力。",
      {
        text: { type: "string", description: "要朗读的文字" },
        group_id: { type: "string" },
        user_id: { type: "string" },
      },
      ["text"],
    ),
    tool(
      "nexus_screen",
      "截本机电脑屏幕（真实桌面画面）并可直接发到当前 QQ。有人说截图、截屏、截个图发群里，必须用这个。不要用 nexus_shot 渲状态卡片充数。Windows、macOS、Linux 桌面、Termux 可用；没有显示器的服务器会说明截不了。",
      { send: { type: "boolean", description: "是否发到当前 QQ，默认 true" } },
    ),
    tool(
      "nexus_shot",
      "渲一张菜单或 HTML 状态图。这不是电脑屏幕。电脑截图用 nexus_screen。",
      {
        title: { type: "string", description: "标题" },
        lines: { type: "array", items: { type: "string" }, description: "行文案" },
        html: { type: "string", description: "可选完整 HTML，优先于 title/lines" },
        send: { type: "boolean", description: "是否发到当前 QQ，默认 true" },
      },
    ),
    tool(
      "nexus_workspace_list",
      "列出 data/agent-workspace 沙箱目录",
      { path: { type: "string", description: "相对路径，默认 ." } },
    ),
    tool(
      "nexus_workspace_read",
      "读取沙箱内文件",
      { path: { type: "string" } },
      ["path"],
    ),
    tool(
      "nexus_workspace_write",
      "写入沙箱内文件",
      { path: { type: "string" }, content: { type: "string" } },
      ["path", "content"],
    ),
    tool(
      "nexus_workspace_delete",
      "删除沙箱内文件或目录",
      { path: { type: "string" } },
      ["path"],
    ),
    tool(
      "nexus_run_safe",
      "仅在 data/agent-workspace 沙箱跑白名单命令。查日志、看服务器、操作系统请用 nexus_shell。",
      { command: { type: "string" } },
      ["command"],
    ),
    tool(
      "nexus_shell",
      "在本机执行系统命令。Windows 用 PowerShell，macOS / Linux 服务器用 bash 或 sh，Termux 用自带 bash。查日志、列目录、看进程都可以。框架日志文件是 data/logs/gateway.log。这是系统命令，不是框架内部 # 指令。",
      {
        command: { type: "string", description: "系统命令正文" },
        cwd: { type: "string", description: "工作目录，默认框架根，也可写绝对路径" },
      },
      ["command"],
    ),
    tool("nexus_uia_windows", "列出本机已开窗口（Windows UIA）。操控桌面软件前先用这个。", {}),
    tool(
      "nexus_uia_tree",
      "扫描某窗口控件树，拿 name/auto_id/control_type 做精准点击填字。",
      {
        title: { type: "string", description: "窗口标题，可部分匹配" },
        handle: { type: "number" },
        depth: { type: "number" },
        limit: { type: "number" },
      },
    ),
    tool(
      "nexus_uia_focus",
      "把指定窗口提到前台",
      { title: { type: "string" }, handle: { type: "number" } },
    ),
    tool(
      "nexus_uia_click",
      "点击窗口内控件。先 tree 再点。",
      {
        title: { type: "string" },
        handle: { type: "number" },
        name: { type: "string" },
        auto_id: { type: "string" },
        control_type: { type: "string", description: "如 Button / Edit" },
      },
    ),
    tool(
      "nexus_uia_set_text",
      "向窗口输入框填字",
      {
        title: { type: "string" },
        handle: { type: "number" },
        name: { type: "string" },
        auto_id: { type: "string" },
        control_type: { type: "string" },
        text: { type: "string" },
      },
      ["text"],
    ),
    tool(
      "nexus_uia_keys",
      "向窗口或控件模拟按键。keys 如 ^a{ENTER}（pywinauto 语法）",
      {
        title: { type: "string" },
        handle: { type: "number" },
        name: { type: "string" },
        auto_id: { type: "string" },
        control_type: { type: "string" },
        keys: { type: "string" },
      },
      ["keys"],
    ),
    tool(
      "nexus_web_open",
      "打开网页会话以便操控控件。不是只读摘要。",
      {
        url: { type: "string" },
        session: { type: "string", description: "会话名，默认 default" },
        headless: { type: "boolean", description: "默认 true；false 显示浏览器窗口" },
      },
      ["url"],
    ),
    tool(
      "nexus_web_snapshot",
      "列出当前网页可点可选的控件与 selector",
      { session: { type: "string" }, limit: { type: "number" } },
    ),
    tool(
      "nexus_web_click",
      "按 CSS selector 点击网页控件",
      { selector: { type: "string" }, session: { type: "string" } },
      ["selector"],
    ),
    tool(
      "nexus_web_type",
      "向网页输入框填字",
      {
        selector: { type: "string" },
        text: { type: "string" },
        session: { type: "string" },
        clear: { type: "boolean" },
      },
      ["selector", "text"],
    ),
    tool(
      "nexus_web_keys",
      "网页模拟按键，如 Enter / Control+a / Tab",
      { key: { type: "string" }, session: { type: "string" } },
      ["key"],
    ),
    tool(
      "nexus_web_screenshot",
      "截当前网页会话",
      { session: { type: "string" } },
    ),
    tool("nexus_web_close", "关闭网页操控会话", { session: { type: "string" } }),
    tool("nexus_channel_get", "查看当前消息通道设置（主人、人设、回复群等）", {}),
    tool(
      "nexus_channel_patch",
      "修改当前通道设置。可改 label、systemPrompt、replyGroupIds、onlyMasters、note。不能改密码。",
      {
        label: { type: "string" },
        systemPrompt: { type: "string" },
        replyGroupIds: { type: "string", description: "逗号分隔群号" },
        onlyMasters: { type: "boolean" },
        note: { type: "string" },
      },
    ),
    tool("nexus_onebot_get", "查看 OneBot 连接摘要（不含密码明文）", {}),
    tool(
      "nexus_onebot_patch",
      "修改 OneBot：enabled、reverseWsPath、httpPath。不改 accessToken 明文。",
      {
        enabled: { type: "boolean" },
        reverseWsPath: { type: "string" },
        httpPath: { type: "string" },
      },
    ),
  ];
}

export async function runAgentTool(
  name: string,
  args: Record<string, unknown>,
  bag: AgentToolBag,
): Promise<unknown> {
  if (MASTER_TOOLS.has(name) && !bag.isMaster && !bag.isAdminConsole) {
    return { error: "无权限，需要主人" };
  }

  if (name === "nexus_status") return { lines: bag.statusLines() };
  if (name === "nexus_open_apps") return listOpenDesktopApps({ limit: Number(args.limit) || 20 });
  if (name === "nexus_launch_app") {
    const appName = String(args.name || "").trim();
    if (!appName) return { error: "缺少软件名" };
    return launchDesktopApp(appName);
  }
  if (name === "nexus_music_play") {
    const query = String(args.query || args.song || args.name || "").trim();
    const app = String(args.app || "汽水音乐").trim() || "汽水音乐";
    if (!query) return { error: "缺少歌名" };
    return playMusic(bag.repoRoot, app, query);
  }
  if (name === "nexus_host_uptime") return hostUptime();
  if (name === "nexus_host_info") return hostInfo();
  if (name === "nexus_logs") {
    const levelsRaw = String(args.levels || args.level || "").trim();
    const levels = levelsRaw
      ? levelsRaw.split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean)
      : [];
    const limit = Number(args.limit) || 60;
    const contains = String(args.contains || args.q || "").trim() || undefined;
    const q = queryLogEntries({
      limit,
      levels: levels.length ? levels : undefined,
      contains,
    });
    // 未指定级别时，额外附上最近报错，避免 INFO 盖住 ERROR
    const errors =
      levels.length > 0
        ? null
        : queryLogEntries({ limit: Math.min(limit, 80), levels: ["ERROR", "WARN"], contains });
    const lines = q.items.map(
      (e) => `${e.at.replace("T", " ").slice(0, 19)} [${e.level}] ${e.message}`,
    );
    const errorLines =
      errors?.items.map(
        (e) => `${e.at.replace("T", " ").slice(0, 19)} [${e.level}] ${e.message}`,
      ) ?? undefined;
    return {
      ok: true,
      ringTotal: q.total,
      matched: q.matched,
      summary: q.summary,
      errorWarnCount: errors?.summary ?? q.summary,
      lines,
      errorLines,
      note:
        q.matched === 0 && !(errorLines && errorLines.length)
          ? "当前内存日志环里没有匹配项。重启后环会清空；更早的只在启动该网关的终端窗口里。"
          : undefined,
    };
  }
  if (name === "nexus_web_search") {
    const query = String(args.query || args.q || "").trim();
    if (!query) return { error: "缺少搜索词" };
    return webSearch(query);
  }
  if (name === "nexus_web_read") {
    const url = String(args.url || "").trim();
    if (!url) return { error: "缺少网址" };
    return webRead(url);
  }
  if (name === "nexus_list_plugins") {
    return {
      items: bag.plugins.list().map((p) => ({
        id: p.id,
        name: p.name,
        version: p.version,
      })),
    };
  }
  if (name === "nexus_list_skills") {
    return {
      items: loadAgentSkills(bag.repoRoot).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
      })),
      note: "不会做时先 nexus_skill_read 读完整技能，再按步骤做；没有技能就用 nexus_shell 试。",
    };
  }
  if (name === "nexus_skill_read") {
    const id = String(args.id || args.name || "").trim();
    if (!id) return { error: "缺少技能 id" };
    const skill = findAgentSkill(bag.repoRoot, id);
    if (!skill) return { error: `没有这个技能：${id}` };
    return { id: skill.id, name: skill.name, description: skill.description, body: skill.body };
  }
  if (name === "nexus_whoami") {
    const s = bag.channelSettings();
    return {
      userId: bag.userId,
      isMaster: bag.isMaster || isChannelMaster(s, bag.userId),
      level: masterLevelOf(s, bag.userId),
      adminConsole: Boolean(bag.isAdminConsole),
    };
  }
  if (name === "nexus_list_workflows") {
    return { items: bag.workflows.list().map((w) => ({ id: w.id, name: w.name })) };
  }
  if (name === "nexus_run_workflow") {
    const id = String(args.id || "").trim();
    if (!id) return { error: "缺少工作流 id" };
    return bag.workflows.run(id, { ...(args.payload as object), triggeredBy: bag.userId });
  }
  if (name === "nexus_list_mcp") return { items: bag.mcp.list() };
  if (name === "nexus_call_mcp") {
    const toolName = String(args.name || "").trim();
    if (!toolName) return { error: "缺少工具名" };
    const callArgs =
      args.args && typeof args.args === "object" && !Array.isArray(args.args)
        ? (args.args as Record<string, unknown>)
        : {};
    return bag.mcp.call(toolName, callArgs);
  }
  if (name === "nexus_list_caps") {
    const items: Array<{
      pluginId: string;
      name: string;
      command: string;
      describe: string;
      permission: string;
    }> = [];
    for (const p of bag.plugins.values()) {
      const rules = (p as { rule?: Array<{ reg?: unknown; describe?: string; permission?: string }> }).rule;
      if (!Array.isArray(rules)) continue;
      for (const r of rules) {
        items.push({
          pluginId: p.manifest.id,
          name: p.manifest.name,
          command: String(r.reg ?? ""),
          describe: String(r.describe || ""),
          permission: r.permission || "all",
        });
      }
    }
    return { items };
  }
  if (name === "nexus_call_cap") {
    const text = String(args.text || "").trim();
    if (!text) return { error: "缺少要调用的指令" };
    if (!bag.invokeCapability) return { error: "当前不能调用群内能力" };
    const replies = await bag.invokeCapability(text);
    if (bag.capSink) bag.capSink.push(...replies.filter((x) => x.trim()));
    return {
      ok: replies.length > 0,
      replies,
      note: replies.length ? "框架会另发这些回复，不要整段照抄" : "没有插件接住这条指令",
    };
  }
  if (name === "nexus_plugin_switch") {
    const id = String(args.id || "").trim();
    if (!id) return { error: "缺少插件 id" };
    if (!bag.setPluginEnabled) return { error: "当前不能操控插件" };
    return bag.setPluginEnabled(id, Boolean(args.enabled));
  }
  if (name === "nexus_plugin_reload") {
    if (!bag.reloadPlugins) return { error: "当前不能重载插件" };
    return bag.reloadPlugins();
  }
  if (name === "nexus_install_pack") {
    const id = String(args.id || "").trim();
    if (!id) return { error: "缺少收录 id" };
    if (!bag.installPack) return { error: "当前不能安装" };
    return bag.installPack(id);
  }
  if (name === "nexus_list_runtimes") return { items: bag.listRuntimes?.() ?? [] };
  if (name === "nexus_install_runtime") {
    const runtime = String(args.runtime || "").trim();
    if (!runtime) return { error: "缺少运行环境" };
    if (!bag.installRuntime) return { error: "当前不能安装" };
    return bag.installRuntime(runtime);
  }

  if (name === "nexus_qq_send_image") {
    if (!bag.onebot) return { error: "OneBot 未就绪" };
    const ctx = resolveSendCtx(bag, args);
    if (!ctx || ctx.channel !== "onebot11") return { error: "当前不在 QQ 会话" };
    const path = String(args.path || "").trim();
    if (!path) return { error: "缺少图片路径" };
    const ok = await bag.onebot.sendImage(path, ctx);
    return { ok, message: ok ? "已发图" : "发图失败" };
  }
  if (name === "nexus_qq_send_file") {
    if (!bag.onebot) return { error: "OneBot 未就绪" };
    const ctx = resolveSendCtx(bag, args);
    if (!ctx || ctx.channel !== "onebot11") return { error: "当前不在 QQ 会话" };
    const path = String(args.path || "").trim();
    if (!path) return { error: "缺少文件路径" };
    return bag.onebot.sendFile(path, ctx, { name: String(args.name || "") || undefined });
  }
  if (name === "nexus_qq_send_voice") {
    if (!bag.onebot) return { error: "OneBot 未就绪" };
    const ctx = resolveSendCtx(bag, args);
    if (!ctx || ctx.channel !== "onebot11") return { error: "当前不在 QQ 会话" };
    const text = String(args.text || "").trim();
    if (!text) return { error: "缺少要朗读的文字" };
    const tts = await textToSpeechFile(bag.repoRoot, text);
    if (!tts.ok || !tts.path) return { ok: false, message: tts.message };
    const ok = await bag.onebot.sendRecord(tts.path, ctx);
    return { ok, message: ok ? "已发语音" : `合成成功但发送失败：${tts.path}` };
  }
  if (name === "nexus_screen") {
    const shot = await captureDesktop(join(bag.repoRoot, "data", "shots"));
    if (!shot.ok || !shot.path) return { ok: false, platform: shot.platform, message: shot.message };
    const send = args.send !== false;
    if (send && bag.onebot && bag.messageCtx?.channel === "onebot11") {
      const ctx = resolveSendCtx(bag, args);
      if (!ctx) return { ok: false, path: shot.path, message: "当前不在 QQ 会话" };
      const ok = await bag.onebot.sendImage(shot.path, ctx);
      return {
        ok,
        path: shot.path,
        platform: shot.platform,
        message: ok ? "已把电脑屏幕截图发到群里" : "截到了屏幕，但发送失败",
      };
    }
    return { ok: true, path: shot.path, platform: shot.platform, message: shot.message, sent: false };
  }
  if (name === "nexus_shot") {
    const outDir = join(bag.repoRoot, "data", "shots");
    const html = String(args.html || "").trim();
    const shot = html
      ? await renderHtmlShot({ html, outDir })
      : await renderMenuShot({
          title: String(args.title || "Fengyun Nexus"),
          lines: Array.isArray(args.lines) ? args.lines.map((x) => String(x)) : ["状态图"],
          outDir,
        });
    if (!shot.ok || !shot.pngPath) {
      return { ok: false, message: "message" in shot ? shot.message : "截图失败", htmlPath: shot.htmlPath };
    }
    const send = args.send !== false;
    if (send && bag.onebot && bag.messageCtx?.channel === "onebot11") {
      const ok = await bag.onebot.sendImage(shot.pngPath, bag.messageCtx);
      return { ok, path: shot.pngPath, message: ok ? "已截图并发出" : "截图成功但发送失败" };
    }
    return { ok: true, path: shot.pngPath, message: "已截图", sent: false };
  }

  if (name === "nexus_workspace_list") {
    return workspaceList(bag.repoRoot, String(args.path || "."));
  }
  if (name === "nexus_workspace_read") {
    return workspaceRead(bag.repoRoot, String(args.path || ""));
  }
  if (name === "nexus_workspace_write") {
    return workspaceWrite(bag.repoRoot, String(args.path || ""), String(args.content ?? ""));
  }
  if (name === "nexus_workspace_delete") {
    return workspaceDelete(bag.repoRoot, String(args.path || ""));
  }
  if (name === "nexus_run_safe") {
    return runSafeCommand(bag.repoRoot, String(args.command || ""));
  }
  if (name === "nexus_shell") {
    const command = String(args.command || args.cmd || "").trim();
    if (!command) return { error: "缺少命令" };
    const rawCwd = String(args.cwd || "").trim();
    const cwd = rawCwd ? (isAbsolute(rawCwd) ? rawCwd : join(bag.repoRoot, rawCwd)) : bag.repoRoot;
    const result = await runHostShell(command, { cwd });
    return {
      ...result,
      logFile: join(bag.repoRoot, "data", "logs", "gateway.log"),
    };
  }

  if (name === "nexus_uia_windows") return uiaWindows(bag.repoRoot);
  if (name === "nexus_uia_tree") {
    return uiaTree(bag.repoRoot, {
      title: String(args.title || ""),
      handle: Number(args.handle) || 0,
      depth: Number(args.depth) || 3,
      limit: Number(args.limit) || 120,
    });
  }
  if (name === "nexus_uia_focus") {
    return uiaFocus(bag.repoRoot, {
      title: String(args.title || ""),
      handle: Number(args.handle) || 0,
    });
  }
  if (name === "nexus_uia_click") {
    return uiaClick(bag.repoRoot, {
      title: String(args.title || ""),
      handle: Number(args.handle) || 0,
      name: String(args.name || ""),
      auto_id: String(args.auto_id || ""),
      control_type: String(args.control_type || ""),
    });
  }
  if (name === "nexus_uia_set_text") {
    return uiaSetText(bag.repoRoot, {
      title: String(args.title || ""),
      handle: Number(args.handle) || 0,
      name: String(args.name || ""),
      auto_id: String(args.auto_id || ""),
      control_type: String(args.control_type || "Edit"),
      text: String(args.text ?? ""),
    });
  }
  if (name === "nexus_uia_keys") {
    return uiaKeys(bag.repoRoot, {
      title: String(args.title || ""),
      handle: Number(args.handle) || 0,
      name: String(args.name || ""),
      auto_id: String(args.auto_id || ""),
      control_type: String(args.control_type || ""),
      keys: String(args.keys || ""),
    });
  }

  if (name === "nexus_web_open") {
    return webOpen(bag.repoRoot, {
      url: String(args.url || ""),
      session: String(args.session || "default"),
      headless: args.headless === false ? false : true,
    });
  }
  if (name === "nexus_web_snapshot") {
    return webSnapshot(bag.repoRoot, {
      session: String(args.session || "default"),
      limit: Number(args.limit) || 40,
    });
  }
  if (name === "nexus_web_click") {
    return webClick(bag.repoRoot, {
      selector: String(args.selector || ""),
      session: String(args.session || "default"),
    });
  }
  if (name === "nexus_web_type") {
    return webType(bag.repoRoot, {
      selector: String(args.selector || ""),
      text: String(args.text ?? ""),
      session: String(args.session || "default"),
      clear: args.clear !== false,
    });
  }
  if (name === "nexus_web_keys") {
    return webKeys(bag.repoRoot, {
      key: String(args.key || args.keys || ""),
      session: String(args.session || "default"),
    });
  }
  if (name === "nexus_web_screenshot") {
    return webScreenshot(bag.repoRoot, { session: String(args.session || "default") });
  }
  if (name === "nexus_web_close") {
    return webClose({ session: String(args.session || "default") });
  }

  if (name === "nexus_channel_get") {
    const s = bag.channelSettings();
    return {
      label: s.label,
      onlyMasters: s.onlyMasters,
      replyGroupIds: s.replyGroupIds,
      systemPrompt: s.systemPrompt,
      note: s.note,
      masters: s.masters,
      coreMasters: s.coreMasters,
      newMasters: s.newMasters,
      normalMasters: s.normalMasters,
    };
  }
  if (name === "nexus_channel_patch") {
    if (!bag.patchChannelSettings) return { error: "当前不能改通道" };
    const patch: Record<string, unknown> = {};
    for (const k of ["label", "systemPrompt", "replyGroupIds", "onlyMasters", "note"] as const) {
      if (args[k] !== undefined) patch[k] = args[k];
    }
    if (!Object.keys(patch).length) return { error: "没有可改的字段" };
    return bag.patchChannelSettings(patch);
  }
  if (name === "nexus_onebot_get") {
    return bag.getOneBotSnapshot?.() ?? { error: "没有 OneBot 快照" };
  }
  if (name === "nexus_onebot_patch") {
    if (!bag.patchOneBotConfig) return { error: "当前不能改 OneBot" };
    const patch: Record<string, unknown> = {};
    for (const k of ["enabled", "reverseWsPath", "httpPath"] as const) {
      if (args[k] !== undefined) patch[k] = args[k];
    }
    if (!Object.keys(patch).length) return { error: "没有可改的字段" };
    return bag.patchOneBotConfig(patch);
  }

  const mcpNames = new Set(bag.mcp.list().map((t) => t.name));
  if (mcpNames.has(name)) {
    if (!bag.isMaster && !bag.isAdminConsole) return { error: "无权限，需要主人" };
    return bag.mcp.call(name, args);
  }
  return { error: `未知工具：${name}` };
}
