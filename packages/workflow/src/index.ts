export type WorkflowNodeType =
  | "trigger"
  | "llm"
  | "plugin"
  | "http"
  | "branch"
  | "delay"
  | "worker";

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
}

export class WorkflowRunner {
  private defs = new Map<string, WorkflowDef>();

  register(def: WorkflowDef): void {
    this.defs.set(def.id, def);
  }

  list(): WorkflowDef[] {
    return [...this.defs.values()];
  }

  async run(id: string, payload: Record<string, unknown> = {}): Promise<WorkflowRunResult> {
    const def = this.defs.get(id);
    if (!def) return { workflowId: id, visited: [], ok: false, detail: "not found" };

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
      if (node.type === "branch") {
        const flag = Boolean(payload.branch ?? node.config?.default);
        cur = flag ? node.next?.[0] : node.next?.[1];
        continue;
      }
      cur = node.next?.[0];
    }
    return { workflowId: id, visited, ok: true };
  }
}
