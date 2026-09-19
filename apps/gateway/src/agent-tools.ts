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
import { listOpenDesktopApps } from "./desktop-inspect.js";

export type AgentToolBag = {
  mcp: McpHost;
  workflows: WorkflowRunner;
  plugins: PluginHost;
  statusLines: () => string[];
  channelSettings: () => ChannelSettings;
  userId: string;
  isMaster: boolean;
  isAdminConsole?: boolean;
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
      "nexus_open_apps",
      "查看本机当前打开的带窗口软件/应用（主人或控制台）。回答「开了什么软件」时用这个。",
      {
        limit: {
          type: "number",
          description: "最多返回几条，默认 20，最大 40",
        },
      },
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
    name === "nexus_open_apps";
  if (needMaster && !bag.isMaster && !bag.isAdminConsole) {
    return { error: "无权限，需要主人" };
  }

  if (name === "nexus_status") {
    return { lines: bag.statusLines() };
  }
  if (name === "nexus_open_apps") {
    return listOpenDesktopApps({ limit: Number(args.limit) || 20 });
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
  /** 直接透传 MCP 同名工具 */
  const mcpNames = new Set(bag.mcp.list().map((t) => t.name));
  if (mcpNames.has(name)) {
    if (!bag.isMaster && !bag.isAdminConsole) return { error: "无权限，需要主人" };
    return bag.mcp.call(name, args);
  }
  return { error: `未知工具：${name}` };
}
