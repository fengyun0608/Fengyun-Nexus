/**
 * 本机工作流：读写 workflows/ 下 JSON，供控制台创建与试跑。
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import type { WorkflowDef } from "@fengyun/nexus-workflow";
import { docLink } from "./docs-serve.js";

export type LocalWorkflowMeta = WorkflowDef & {
  description?: string;
  author?: string;
  file?: string;
};

function workflowsRoot(root: string): string {
  return resolve(join(root, "workflows"));
}

export function scaffoldWorkflowGuide(root: string): {
  workflowsDir: string;
  docs: Array<{ title: string; path: string; url: string }>;
  steps: string[];
} {
  const workflowsDir = workflowsRoot(root);
  return {
    workflowsDir,
    docs: [
      docLink("产品介绍 · 能力总览", "docs/product/README.md"),
      docLink("目录与本地文件说明", "docs/product/directory.md"),
      docLink("各平台启动", "docs/product/start.md"),
      docLink("环境要求", "docs/product/environment.md"),
      docLink("本地工作流目录", "workflows"),
    ],
    steps: [
      `本地工作流目录：${workflowsDir}`,
      "控制台「创建本地工作流」会生成 JSON 骨架",
      "点文档链接在新窗口打开，按说明改节点后刷新即可",
      "本页可试跑已加载的工作流",
    ],
  };
}

export function listLocalWorkflows(root: string): LocalWorkflowMeta[] {
  const base = workflowsRoot(root);
  if (!existsSync(base)) return [];
  const out: LocalWorkflowMeta[] = [];
  for (const name of readdirSync(base)) {
    if (!name.endsWith(".json")) continue;
    const file = join(base, name);
    try {
      const j = JSON.parse(readFileSync(file, "utf8")) as LocalWorkflowMeta;
      if (!j?.id || !j?.entry || !Array.isArray(j.nodes)) continue;
      out.push({
        ...j,
        name: j.name || j.id,
        file: `workflows/${name}`,
      });
    } catch {
      /* ignore broken */
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export type CreateLocalWorkflowInput = {
  id: string;
  name: string;
  description?: string;
  author?: string;
};

export function createLocalWorkflow(
  root: string,
  input: CreateLocalWorkflowInput,
):
  | {
      ok: true;
      id: string;
      path: string;
      workflow: LocalWorkflowMeta;
      docs: Array<{ title: string; path: string; url: string }>;
      message: string;
    }
  | { ok: false; error: string } {
  const id = String(input.id || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const name = String(input.name || "").trim();
  if (!id || !/^[a-z][a-z0-9._-]*$/.test(id)) {
    return { ok: false, error: "工作流 id 须为英文：字母开头，仅 a-z 0-9 . _ -" };
  }
  if (!name) return { ok: false, error: "请填写工作流名称" };

  const base = workflowsRoot(root);
  mkdirSync(base, { recursive: true });
  const fileName = `${id}.json`;
  const abs = join(base, fileName);
  if (existsSync(abs)) {
    return { ok: false, error: `已存在：workflows/${fileName}` };
  }

  const description = String(input.description || "").trim() || "本地工作流";
  const author = String(input.author || "").trim();
  const workflow: LocalWorkflowMeta = {
    id,
    name,
    description,
    author: author || undefined,
    entry: "start",
    nodes: [
      { id: "start", type: "trigger", next: ["done"] },
      { id: "done", type: "memory", config: { op: "set", key: "ok", value: true }, next: [] },
    ],
  };
  writeFileSync(abs, `${JSON.stringify(workflow, null, 2)}\n`, "utf8");
  const guide = scaffoldWorkflowGuide(root);
  return {
    ok: true,
    id,
    path: `workflows/${fileName}`,
    workflow: { ...workflow, file: `workflows/${fileName}` },
    docs: guide.docs,
    message: `已创建本地工作流 workflows/${fileName}，请按文档继续编写`,
  };
}

export function toWorkflowDef(meta: LocalWorkflowMeta): WorkflowDef {
  return {
    id: meta.id,
    name: meta.name,
    entry: meta.entry,
    nodes: meta.nodes,
  };
}
