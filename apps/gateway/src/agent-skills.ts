/**
 * 运行时技能：扫 skills/agent/*.md，摘要进系统提示；完整内容可按需读取。
 * 与 Cursor 个人 skill 无关；这是宿主给模型看的说明。
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
        body: body.slice(0, 12_000),
      });
    } catch {
      /* skip */
    }
  }
  return out;
}

export function findAgentSkill(root: string, idOrName: string): AgentSkill | null {
  const key = String(idOrName || "").trim().toLowerCase();
  if (!key) return null;
  const skills = loadAgentSkills(root);
  return (
    skills.find((s) => s.id.toLowerCase() === key || s.name.toLowerCase() === key) || null
  );
}

/** 拼进系统提示的短块 */
export function skillsPromptBlock(skills: AgentSkill[]): string {
  if (!skills.length) {
    return [
      "当前没有 skills/agent 技能文件。",
      "不会做时：先用已有工具；没有专用工具就用 nexus_shell 系统命令试；不要一上来就说做不到。",
    ].join("\n");
  }
  const lines = [
    "可用技能（不会就先读技能，再试系统命令）：",
    "顺序：1）有专用工具就用；2）nexus_list_skills / nexus_skill_read 看 skills/agent；3）nexus_shell 用系统命令试能不能做；4）仍不行再说原因。禁止一上来说没有办法。",
  ];
  for (const s of skills) {
    lines.push(`- ${s.name}（${s.id}）：${s.description || s.body.slice(0, 120)}`);
  }
  return lines.join("\n");
}
