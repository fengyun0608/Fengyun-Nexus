import type { NexusMessage } from "@fengyun/nexus-shared";

export type PluginPermission =
  | "channel.send"
  | "llm.chat"
  | "fs.data"
  | "mcp.expose"
  | "workflow.register";

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  engines?: { nexus?: string };
  main?: string;
  permissions?: PluginPermission[];
  hooks?: Array<"onMessage" | "onReady" | "onCron" | "onWorkflowNode">;
  contributes?: {
    mcpTools?: string[];
    workflowNodes?: string[];
  };
  category?: "demo" | "basic" | "standard" | "local";
}

export interface PluginContext {
  pluginId: string;
  reply: (content: string, to: NexusMessage) => Promise<void>;
  log: (msg: string) => void;
}

export interface NexusPlugin {
  manifest: PluginManifest;
  onReady?(ctx: PluginContext): Promise<void> | void;
  onMessage?(msg: NexusMessage, ctx: PluginContext): Promise<NexusMessage | null> | NexusMessage | null;
}

export function definePlugin(plugin: NexusPlugin): NexusPlugin {
  return plugin;
}

export class PluginHost {
  private plugins = new Map<string, NexusPlugin>();

  register(plugin: NexusPlugin): void {
    this.plugins.set(plugin.manifest.id, plugin);
  }

  list(): PluginManifest[] {
    return [...this.plugins.values()].map((p) => p.manifest);
  }

  async emitReady(makeCtx: (id: string) => PluginContext): Promise<void> {
    for (const p of this.plugins.values()) {
      await p.onReady?.(makeCtx(p.manifest.id));
    }
  }

  async onMessage(msg: NexusMessage, makeCtx: (id: string) => PluginContext): Promise<NexusMessage[]> {
    const out: NexusMessage[] = [];
    for (const p of this.plugins.values()) {
      if (!p.onMessage) continue;
      const r = await p.onMessage(msg, makeCtx(p.manifest.id));
      if (r) out.push(r);
    }
    return out;
  }
}
