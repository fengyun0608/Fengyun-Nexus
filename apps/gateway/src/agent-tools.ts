/**
 * 给 LLM 用的框架工具：状态 / 插件 / 主人 / 工作流 / MCP。
 * 敏感工具要求主人；公开查询谁都可以。
 */
import type { LlmToolDef } from "@fengyun/nexus-llm";
import type { McpHost } from "@fengyun/nexus-mcp-host";
import type { WorkflowRunner } from "@fengyun/nexus-workflow";
import type { PluginHost } from "@fengyun/nexus-plugin-sdk";
import type { ChannelSettings } from "./channel-settings.js";
import { isChannelMaster, masterLevelOf } from "./channel-settings.js";
import { hostUptime, launchDesktopApp, listOpenDesktopApps } from "./desktop-inspect.js";

export type AgentToolBag = {
  mcp: McpHost;
  workflows: WorkflowRunner;
  plugins: PluginHost;
  statusLines: () => string[];
  channelSettings: () => ChannelSettings;
  userId: string;
  isMaster: boolean;
  isAdminConsole?: boolean;
  /** 主人调用群内插件能力时，回复文本会追加发出 */
  capSink?: string[];
  invokeCapability?: (text: string) => Promise<string[]>;
  setPluginEnabled?: (id: string, enabled: boolean) => { ok: boolean; message: string };
  reloadPlugins?: () => Promise<{ ok: boolean; message: string }>;
  installPack?: (id: string) => Promise<{ ok: boolean; message: string }>;
  installRuntime?: (runtime: string) => { ok: boolean; message: string };
  listRuntimes?: () => unknown;
};

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

export function buildAgentToolDefs(mcp: McpHost): LlmToolDef[] {
  const defs: LlmToolDef[] = [
    tool("nexus_status", "查看 Fengyun Nexus 运行状态摘要", {}),
    tool("nexus_list_plugins", "列出已加载插件 id 与名称", {}),
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
      "nexus_host_uptime",
      "查看这台电脑自开机起运行了多久。有人问电脑开了多久、运行时长、开机时间时必须用这个。这是整台电脑的时长，不是 Fengyun Nexus 进程时长。不要说没有这个工具，也不要编数字。",
      {},
    ),
    tool(
      "nexus_launch_app",
      "在本机启动一个已安装的软件（主人或控制台）。有人说打开、启动某个软件时必须用这个，不要说没有启动工具。只传软件名，不要传命令。",
      { name: { type: "string", description: "软件名，例如 ToDesk、微信" } },
      ["name"],
    ),
    tool(
      "nexus_open_apps",
      "查看本机当前打开的带窗口软件/应用（主人或控制台）。回答「开了什么软件」时用这个。",
      {
        limit: {
          type: "number",
          description: "最多返回几条，默认 20，最大 40",
        },
      },
    ),
    tool("nexus_list_caps", "列出已加载插件的群内能力（指令与说明）。调用前先看这份清单，不要编造没有的能力。", {}),
    tool(
      "nexus_call_cap",
      "调用一条群内插件能力。传入要执行的指令文本，例如 #菜单。静妍这类已装进框架的群能力也走这里。",
      { text: { type: "string", description: "要执行的指令或匹配插件规则的文本" } },
      ["text"],
    ),
    tool(
      "nexus_plugin_switch",
      "启用或停用一个已加载插件（主人或控制台）",
      {
        id: { type: "string", description: "插件 id" },
        enabled: { type: "boolean", description: "true 启用，false 停用" },
      },
      ["id", "enabled"],
    ),
    tool("nexus_plugin_reload", "热重载全部插件（主人或控制台）", {}),
    tool(
      "nexus_install_pack",
      "从生态专仓安装一份收录（主人或控制台）。先确认收录 id，再安装。",
      { id: { type: "string", description: "生态收录 id" } },
      ["id"],
    ),
    tool("nexus_list_runtimes", "查看可安装的运行环境（Go / Python / 浏览器 / NapCat）", {}),
    tool(
      "nexus_install_runtime",
      "把 Go、Python、浏览器或 NapCat 加入安装队列并开始安装（主人或控制台）",
      {
        runtime: {
          type: "string",
          description: "go、python、browser、napcat 四选一",
        },
      },
      ["runtime"],
    ),
  ];
  for (const t of mcp.list()) {
    if (defs.some((d) => d.function.name === t.name)) continue;
  }
  return defs;
}

export async function runAgentTool(
  name: string,
  args: Record<string, unknown>,
  bag: AgentToolBag,
): Promise<unknown> {
  const needMaster =
    name === "nexus_run_workflow" ||
    name === "nexus_call_mcp" ||
    name === "nexus_open_apps" ||
    name === "nexus_launch_app" ||
    name === "nexus_host_uptime" ||
    name === "nexus_list_caps" ||
    name === "nexus_call_cap" ||
    name === "nexus_plugin_switch" ||
    name === "nexus_plugin_reload" ||
    name === "nexus_install_pack" ||
    name === "nexus_list_runtimes" ||
    name === "nexus_install_runtime";
  if (needMaster && !bag.isMaster && !bag.isAdminConsole) {
    return { error: "无权限，需要主人" };
  }

  if (name === "nexus_status") {
    return { lines: bag.statusLines() };
  }
  if (name === "nexus_open_apps") {
    return listOpenDesktopApps({ limit: Number(args.limit) || 20 });
  }
  if (name === "nexus_launch_app") {
    const appName = String(args.name || "").trim();
    if (!appName) return { error: "缺少软件名" };
    return launchDesktopApp(appName);
  }
  if (name === "nexus_host_uptime") {
    return hostUptime();
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
    return {
      items: bag.workflows.list().map((w) => ({ id: w.id, name: w.name })),
    };
  }
  if (name === "nexus_run_workflow") {
    const id = String(args.id || "").trim();
    if (!id) return { error: "缺少工作流 id" };
    return bag.workflows.run(id, { ...(args.payload as object), triggeredBy: bag.userId });
  }
  if (name === "nexus_list_mcp") {
    return { items: bag.mcp.list() };
  }
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
  if (name === "nexus_list_runtimes") {
    return { items: bag.listRuntimes?.() ?? [] };
  }
  if (name === "nexus_install_runtime") {
    const runtime = String(args.runtime || "").trim();
    if (!runtime) return { error: "缺少运行环境" };
    if (!bag.installRuntime) return { error: "当前不能安装" };
    return bag.installRuntime(runtime);
  }
  /** 直接透传 MCP 同名工具 */
  const mcpNames = new Set(bag.mcp.list().map((t) => t.name));
  if (mcpNames.has(name)) {
    if (!bag.isMaster && !bag.isAdminConsole) return { error: "无权限，需要主人" };
    return bag.mcp.call(name, args);
  }
  return { error: `未知工具：${name}` };
}
