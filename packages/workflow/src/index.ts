export type WorkflowNodeType =
  | "trigger"
  | "llm"
  | "plugin"
  | "http"
  | "branch"
  | "delay"
  | "worker"
  | "memory"
  | "tool";

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  config?: Record<string, unknown>;
  next?: string[];
}

export interface WorkflowDef {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  entry: string;
}

export interface WorkflowRunResult {
  workflowId: string;
  visited: string[];
  ok: boolean;
  detail?: string;
  memory?: Record<string, unknown>;
}

export class WorkflowRunner {
  private defs = new Map<string, WorkflowDef>();
  private memoryStore = new Map<string, Record<string, unknown>>();

  register(def: WorkflowDef): void {
    this.defs.set(def.id, def);
  }

  list(): WorkflowDef[] {
    return [...this.defs.values()];
  }

  getMemory(key: string): Record<string, unknown> {
    return { ...(this.memoryStore.get(key) ?? {}) };
  }

  async run(id: string, payload: Record<string, unknown> = {}): Promise<WorkflowRunResult> {
    const def = this.defs.get(id);
    if (!def) return { workflowId: id, visited: [], ok: false, detail: "not found" };

    const memKey = String(payload.memoryKey ?? id);
    const memory = { ...(this.memoryStore.get(memKey) ?? {}) };
    const byId = new Map(def.nodes.map((n) => [n.id, n]));
    const visited: string[] = [];
    let cur: string | undefined = def.entry;
    let guard = 0;
    while (cur && guard++ < 64) {
      const node = byId.get(cur);
      if (!node) break;
      visited.push(node.id);
      if (node.type === "delay") {
        const ms = Number(node.config?.ms ?? 0);
        if (ms > 0) await new Promise((r) => setTimeout(r, Math.min(ms, 5000)));
      }
      if (node.type === "memory") {
        const op = String(node.config?.op ?? "set");
        const key = String(node.config?.key ?? "value");
        if (op === "set") memory[key] = payload[key] ?? node.config?.value;
        if (op === "get") payload[key] = memory[key];
      }
      if (node.type === "tool") {
        payload._lastTool = String(node.config?.name ?? "tool");
      }
      if (node.type === "branch") {
        const flag = Boolean(payload.branch ?? node.config?.default);
        cur = flag ? node.next?.[0] : node.next?.[1];
        continue;
      }
      cur = node.next?.[0];
    }
    this.memoryStore.set(memKey, memory);
    return { workflowId: id, visited, ok: true, memory };
  }
}
