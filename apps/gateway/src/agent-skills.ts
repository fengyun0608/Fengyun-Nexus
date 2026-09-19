/**
 * 运行时技能：扫 skills/agent/*.md，把摘要塞进系统提示，供 AI 按文档办事。
 * 与 Cursor 个人 skill 无关；这是宿主给模型看的短说明。
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type AgentSkill = {
  id: string;
  name: string;
  description: string;
  body: string;
};

function parseFront(raw: string): { meta: Record<string, string>; body: string } {
  if (!raw.startsWith("---")) return { meta: {}, body: raw.trim() };
  const end = raw.indexOf("\n---", 3);
  if (end < 0) return { meta: {}, body: raw.trim() };
  const head = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).trim();
  const meta: Record<string, string> = {};
  for (const line of head.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    meta[m[1]!] = m[2]!.replace(/^["']|["']$/g, "").trim();
  }
  return { meta, body };
}

export function loadAgentSkills(root: string): AgentSkill[] {
  const dir = join(root, "skills", "agent");
  if (!existsSync(dir)) return [];
  const out: AgentSkill[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".md")) continue;
    const id = name.replace(/\.md$/i, "");
    try {
      const raw = readFileSync(join(dir, name), "utf8");
      const { meta, body } = parseFront(raw);
      out.push({
        id,
        name: meta.name || id,
        description: meta.description || "",
        body: body.slice(0, 4000),
      });
    } catch {
      /* skip */
    }
  }
  return out;
}

/** 拼进系统提示的短块；太长会截断 */
export function skillsPromptBlock(skills: AgentSkill[]): string {
  if (!skills.length) return "";
  const lines = ["可用技能（按需要遵循）："];
  for (const s of skills) {
    lines.push(`- ${s.name}（${s.id}）：${s.description || s.body.slice(0, 120)}`);
  }
  return lines.join("\n");
}
