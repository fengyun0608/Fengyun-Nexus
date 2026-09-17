export type McpToolHandler = (args: Record<string, unknown>) => Promise<unknown> | unknown;

export interface McpTool {
  name: string;
  description: string;
  handler: McpToolHandler;
}

/** Minimal MCP-style tool registry Nexus can expose or consume. */
export class McpHost {
  private tools = new Map<string, McpTool>();

  register(tool: McpTool): void {
    this.tools.set(tool.name, tool);
  }

  list(): Array<{ name: string; description: string }> {
    return [...this.tools.values()].map(({ name, description }) => ({ name, description }));
  }

  async call(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`MCP tool not found: ${name}`);
    return tool.handler(args);
  }
}
