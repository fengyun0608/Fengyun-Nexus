export interface LlmContentPartText {
  type: "text";
  text: string;
}

export interface LlmContentPartImage {
  type: "image_url";
  image_url: { url: string; detail?: "auto" | "low" | "high" };
}

export type LlmContentPart = LlmContentPartText | LlmContentPartImage;

export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  /** 纯文本，或 OpenAI 兼容多模态 parts（看图） */
  content: string | LlmContentPart[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: LlmToolCall[];
  /**
   * DeepSeek 思考模式：能力模式带 tools 时，后续请求必须回传本字段，否则 API 400。
   * 见 https://api-docs.deepseek.com/guides/thinking_mode/
   */
  reasoning_content?: string;
}

export interface LlmToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface LlmToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
  };
}

export interface LlmRouterOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export type LlmToolHandler = (
  name: string,
  args: Record<string, unknown>,
) => Promise<unknown> | unknown;

export type LlmStreamOpts = {
  /** 正文与思考的增量都会回调（思考会先标「思考：」）。 */
  onDelta?: (text: string) => void;
  /** 每回合摘要，给网关打日志。 */
  onTrace?: (line: string) => void;
  /**
   * 正数：硬上限。
   * 0 / 不传：能力模式「尽量做完」，但仍有安全帽（默认 28）与空转纠偏，避免无限抠源码。
   */
  maxRounds?: number;
};

/** 把思考标签展开成可见正文，不再删掉。工具调用标记仍另清。 */
export function revealThinking(text: string): string {
  return String(text || "")
    .replace(/<think>([\s\S]*?)<\/think>/gi, "\n$1\n")
    .replace(/<thinking>([\s\S]*?)<\/thinking>/gi, "\n$1\n")
    .replace(/<\/?think(?:ing)?>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** @deprecated 现与 revealThinking 相同：思考要发给用户 */
export function stripThinking(text: string): string {
  return revealThinking(text);
}

function speakOutsideTags(text: string): string {
  return String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/<\/?think(?:ing)?>/gi, "")
    .trim();
}

/** 从正文抠出 <think>，供 DeepSeek 回传 reasoning_content */
function peelThinkTags(raw: string): { think: string; speak: string } {
  const chunks: string[] = [];
  let speak = String(raw || "");
  speak = speak.replace(/<think>([\s\S]*?)<\/think>/gi, (_m, t: string) => {
    const s = String(t || "").trim();
    if (s) chunks.push(s);
    return "";
  });
  speak = speak.replace(/<thinking>([\s\S]*?)<\/thinking>/gi, (_m, t: string) => {
    const s = String(t || "").trim();
    if (s) chunks.push(s);
    return "";
  });
  speak = speak.replace(/<\/?think(?:ing)?>/gi, "").trim();
  return { think: chunks.join("\n\n").trim(), speak };
}

function isDeepSeekProvider(baseUrl: string, model: string): boolean {
  const u = String(baseUrl || "").toLowerCase();
  const m = String(model || "").toLowerCase();
  return /deepseek\.com/i.test(u) || /(^|[/\s._-])deepseek/i.test(m) || m.startsWith("deepseek");
}

/** 回话是否几乎全是英文（技术报告刷屏） */
function isMostlyEnglishSpeak(text: string): boolean {
  const s = speakOutsideTags(text);
  if (!s.trim()) return false;
  if (/\b(IDENTITY|DEMO\s*\d|TIMELINE|3-LINE VALUE|root confirmed)\b/i.test(s)) return true;
  if (/^\*\*[A-Z][A-Z0-9 _-]{2,}\*\*/m.test(s) && /[A-Za-z]{30,}/.test(s)) return true;
  const cn = (s.match(/[\u4e00-\u9fff]/g) || []).length;
  const en = (s.match(/[A-Za-z]/g) || []).length;
  return en >= 60 && cn < Math.max(12, en * 0.35);
}

/** 模型把答复塞进思考时，尽量捞一句能给人看的话 */
function rescueSpeakFromThoughts(thoughts: string[]): string {
  const blob = thoughts.join("\n");
  const lines = blob
    .split(/\n+/)
    .map((l) => l.replace(/^[\s*•\-]+/, "").trim())
    .filter((l) => l.length >= 6 && l.length <= 120);
  const scored = lines.filter((l) =>
    /[℃度晴雨云雪风温]|天气|绥中|今天|明天|周末|紫外|带伞/.test(l),
  );
  const pick = scored[scored.length - 1] || lines[lines.length - 1] || "";
  if (!pick) return "";
  if (/^用户|我需要|让我|实际上|之前|可能是|应该是|不要|工具/.test(pick)) return "";
  return pick;
}

function clipLine(text: string, n = 180): string {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

/** 模型把推理写进 content（「思考：」或大段英文），从正文抠出来当 reasoning */
function peelPlainThinkingFromContent(content: string): { think: string; speak: string } {
  let raw = String(content || "").replace(/\r\n/g, "\n").trim();
  if (!raw) return { think: "", speak: "" };

  // 已有标签的留给 composeSpeak / 下游拆
  if (/<think(?:ing)?>/i.test(raw)) return { think: "", speak: raw };

  let body = raw;
  const prefixed = /^思考[：:]\s*/.test(body);
  if (prefixed) body = body.replace(/^思考[：:]\s*/, "").trim();

  const paras = body
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!paras.length) return { think: "", speak: "" };

  const looksThink = (p: string) => {
    if (/^(The user|I should|I need|Let me|My (?:plan|response)|Acknowledge|Explain why)/i.test(p)) {
      return true;
    }
    if (/\b(IDENTITY|DEMO\s*\d|TIMELINE|3-LINE VALUE|root confirmed)\b/i.test(p)) return true;
    if (/^(用户|我需要|让我|接下来|策略|计划)/.test(p)) return true;
    const cn = (p.match(/[\u4e00-\u9fff]/g) || []).length;
    const en = (p.match(/[A-Za-z]/g) || []).length;
    return en >= 40 && cn < Math.max(8, en * 0.25);
  };
  const looksSpeak = (p: string) => {
    if (/^(呜|喵|哼|哈|哎|哇|好|这|那|看|笑|啊|诶|欸|本猫|小璃)/.test(p)) return true;
    const cn = (p.match(/[\u4e00-\u9fff]/g) || []).length;
    const en = (p.match(/[A-Za-z]/g) || []).length;
    return cn >= 6 && cn >= en * 0.4;
  };

  if (!(prefixed || looksThink(paras[0]!) || paras.every(looksThink))) {
    return { think: "", speak: raw };
  }

  let speakAt = paras.length;
  for (let i = 0; i < paras.length; i++) {
    if (looksSpeak(paras[i]!) && !looksThink(paras[i]!)) {
      speakAt = i;
      break;
    }
  }
  return {
    think: paras.slice(0, speakAt).join("\n\n").trim(),
    speak: paras.slice(speakAt).join("\n\n").trim(),
  };
}

/** API 的 reasoning 也包进 think 标签，外面只留给人看的正文。 */
function composeSpeak(reasoning: string, content: string): string {
  const peeled = peelPlainThinkingFromContent(String(content || ""));
  const body = stripToolMarkup(peeled.speak || (peeled.think ? "" : String(content || "")));
  const apiThink = [String(reasoning || "").trim(), peeled.think].filter(Boolean).join("\n\n");
  const tagged = apiThink ? `<think>\n${apiThink}\n</think>` : "";
  return [tagged, body].filter(Boolean).join("\n\n").trim();
}

function stripToolMarkup(text: string): string {
  let s = String(text || "");
  s = s.replace(
    /<[^>\n]{0,80}(?:DSML|tool_calls|tool_call|function_calls|invoke|parameter)[^>]*>[\s\S]*?<\/[^>\n]{0,80}(?:DSML|tool_calls|tool_call|function_calls|invoke|parameter)[^>]*>/gi,
    "",
  );
  s = s
    .split(/\r?\n/)
    .filter((line) => !/DSML|tool_calls|invoke\s+name\s*=|function_calls/i.test(line))
    .join("\n");
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

/** 正文里的 DSML / XML 工具调用，转成正式 tool_calls，避免发出去也不执行。 */
function leakedToolCalls(text: string): LlmToolCall[] {
  const raw = String(text || "");
  if (!/DSML|tool_calls|invoke\s+name\s*=|function_calls/i.test(raw)) return [];
  const out: LlmToolCall[] = [];
  const seen = new Set<string>();
  const invokeRe =
    /name\s*=\s*["'](nexus_[a-zA-Z0-9_.]+)["']([^]*?)(?:<\/[^>\n]*invoke>|<\/invoke>|(?=<[^>\n]*tool_calls)|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = invokeRe.exec(raw))) {
    const name = m[1]!.trim().replace(/\./g, "_");
    if (!/^nexus_[a-z0-9_]+$/i.test(name)) continue;
    const args: Record<string, unknown> = {};
    const paramRe = /name\s*=\s*["']([A-Za-z0-9_]+)["'][^>]*>([^<]*)/g;
    let p: RegExpExecArray | null;
    const body = m[2] || "";
    while ((p = paramRe.exec(body))) {
      if (p[1] === "name") continue;
      args[p[1]!] = (p[2] || "").trim();
    }
    const key = `${name}:${JSON.stringify(args)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `leak_${out.length}_${name}`,
      type: "function",
      function: { name, arguments: JSON.stringify(args) },
    });
  }
  return out;
}

/** 已有完整正文时，小块吐出，方便控制台流式显示。 */
async function emitSoftDeltas(text: string, onDelta: (s: string) => void): Promise<void> {
  const raw = String(text || "");
  if (!raw) return;
  const size = Math.max(2, Math.ceil(raw.length / 28));
  for (let i = 0; i < raw.length; i += size) {
    onDelta(raw.slice(i, i + size));
    await new Promise((r) => setTimeout(r, 10));
  }
}

export class LlmRouter {
  constructor(private opts: LlmRouterOptions = {}) {}

  configure(next: Partial<LlmRouterOptions>): void {
    this.opts = { ...this.opts, ...next };
  }

  snapshot(): {
    hasKey: boolean;
    apiKeyMasked: string;
    baseUrl: string;
    model: string;
  } {
    const key = this.opts.apiKey ?? "";
    return {
      hasKey: Boolean(key),
      apiKeyMasked: key
        ? `${key.slice(0, 4)}${"*".repeat(Math.min(8, Math.max(0, key.length - 4)))}`
        : "",
      baseUrl: this.opts.baseUrl ?? "",
      model: this.opts.model ?? "",
    };
  }

  /** 拉取 OpenAI 兼容 /models；可临时覆盖 baseUrl / apiKey（编辑弹窗未保存时）。 */
  async listModels(override?: { baseUrl?: string; apiKey?: string }): Promise<{
    ok: boolean;
    models: string[];
    message: string;
  }> {
    const baseUrl = String(override?.baseUrl || this.opts.baseUrl || "")
      .trim()
      .replace(/\/$/, "");
    const apiKey = String(
      override?.apiKey !== undefined && override.apiKey !== ""
        ? override.apiKey
        : this.opts.apiKey || "",
    ).trim();
    if (!baseUrl) {
      return { ok: false, models: [], message: "请先填写 Base URL" };
    }
    try {
      const res = await fetch(`${baseUrl}/models`, {
        method: "GET",
        headers: {
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
          "user-agent": "Fengyun-Nexus",
          accept: "application/json",
        },
        signal: AbortSignal.timeout(30_000),
      });
      const raw = await res.text();
      if (!res.ok) {
        return {
          ok: false,
          models: [],
          message: `拉取失败 HTTP ${res.status}：${raw.slice(0, 160)}`,
        };
      }
      let data: unknown;
      try {
        data = JSON.parse(raw);
      } catch {
        return { ok: false, models: [], message: "返回不是 JSON" };
      }
      const list = Array.isArray((data as { data?: unknown })?.data)
        ? ((data as { data: Array<{ id?: string }> }).data || [])
        : Array.isArray(data)
          ? (data as Array<{ id?: string }>)
          : [];
      const models = [
        ...new Set(
          list
            .map((m) => String(m?.id || "").trim())
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b));
      return {
        ok: true,
        models,
        message: models.length ? `已拉取 ${models.length} 个模型` : "列表为空，可手动输入模型名",
      };
    } catch (e) {
      return {
        ok: false,
        models: [],
        message: e instanceof Error ? e.message.slice(0, 160) : String(e),
      };
    }
  }

  /** Chat via configured provider. Returns empty string when no API key (no local echo). */
  async chat(messages: LlmMessage[], streamOpts?: LlmStreamOpts): Promise<string> {
    if (streamOpts?.onDelta) {
      const r = await this.chatTurnStream(messages, undefined, streamOpts.onDelta);
      return composeSpeak(r.reasoning || "", r.content);
    }
    const r = await this.chatTurn(messages);
    return composeSpeak(r.reasoning || "", r.content);
  }

  /**
   * OpenAI 风格 tools：模型可多轮调工具，再给最终文本。
   * 思考过程一并给人看；工具调用原文仍不发。
   */
  async chatWithTools(
    messages: LlmMessage[],
    tools: LlmToolDef[],
    onTool: LlmToolHandler,
    opts?: LlmStreamOpts,
  ): Promise<string> {
    if (!this.opts.apiKey) return "";
    if (!tools.length) return this.chat(messages, opts);

    const history = messages.map((m) => ({ ...m }));
    const maxRounds = opts?.maxRounds ?? 0;
    /** 不限时也有安全帽，防止无限抠源码空转 */
    const hardCap = maxRounds > 0 ? maxRounds : 28;
    const thoughts: string[] = [];
    const trace = (line: string) => {
      try {
        opts?.onTrace?.(line);
      } catch {
        /* 日志失败不影响回话 */
      }
    };
    const finish = async (text: string): Promise<string> => {
      const out = text.trim() || "好了。";
      trace(`AI 终稿  ${clipLine(speakOutsideTags(out) || out, 300) || "空"}`);
      if (opts?.onDelta) await emitSoftDeltas(out, opts.onDelta);
      return out;
    };
    const parseArgs = (raw: string): Record<string, unknown> => {
      try {
        return JSON.parse(raw || "{}") as Record<string, unknown>;
      } catch {
        return {};
      }
    };
    const isSourceDigShell = (args: Record<string, unknown>): boolean => {
      const cmd = String(args.command || args.cmd || "");
      return /apps[/\\]gateway|packages[/\\](llm|plugin|channel)|onebot11-bridge|plugin-loader|plugin-ctx|napcat\.mjs|Substring\s*\(|Get-Content[\s\S]{0,80}\\.ts/i.test(
        cmd,
      );
    };
    const runCalls = async (
      calls: LlmToolCall[],
      content: string,
      hideContent: boolean,
      reasoning?: string,
    ) => {
      const row: LlmMessage = {
        role: "assistant",
        content: hideContent ? "" : content || "",
        tool_calls: calls,
      };
      // DeepSeek + tools：必须回传 reasoning_content，否则下一轮 400
      if (reasoning) row.reasoning_content = reasoning;
      else if (isDeepSeekProvider(this.opts.baseUrl || "", this.opts.model || "")) {
        row.reasoning_content = "";
      }
      history.push(row);
      for (const call of calls) {
        const args = parseArgs(call.function.arguments || "{}");
        let result: unknown;
        try {
          result = await onTool(call.function.name, args);
        } catch (e) {
          result = { error: e instanceof Error ? e.message : String(e) };
        }
        history.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: typeof result === "string" ? result : JSON.stringify(result).slice(0, 6000),
        });
      }
    };
    let emptySpeak = 0;
    let toolOnlyEmpty = 0;
    let shellDig = 0;
    const nudge = (content: string, why: string) => {
      history.push({ role: "user", content });
      trace(`AI 纠偏  ${why}`);
    };
    const oneTurn = async (
      round: number,
      allowTools: boolean,
    ): Promise<"done" | "cont" | string> => {
      const turn = await this.chatTurn(history, allowTools ? tools : undefined);
      const peeled = peelPlainThinkingFromContent(turn.content || "");
      const turnThink = [turn.reasoning?.trim(), peeled.think].filter(Boolean).join("\n\n");
      const turnSpeak = peeled.think ? peeled.speak : turn.content || "";
      if (turnThink) thoughts.push(turnThink);
      const contentForTools = turnSpeak || turn.content || "";
      const leaked = turn.tool_calls?.length ? [] : leakedToolCalls(contentForTools);
      const calls = allowTools
        ? turn.tool_calls?.length
          ? turn.tool_calls
          : leaked
        : [];
      const speakNow = speakOutsideTags(turnSpeak);
      trace(
        `AI 回合 ${round}  工具 ${calls.map((c) => c.function.name).join("、") || "无"}  正文 ${clipLine(speakNow) || "空"}  思考 ${clipLine(turnThink || "") || "无"}`,
      );
      if (!calls.length) {
        const text = composeSpeak(thoughts.join("\n\n"), turnSpeak);
        const speak = speakOutsideTags(text);
        if (speak && !isMostlyEnglishSpeak(text)) return text;

        if (speak && isMostlyEnglishSpeak(text)) {
          thoughts.push(speak);
          trace(`AI 英文回话  已收进思考，催中文概括`);
        }
        emptySpeak += 1;
        if (emptySpeak >= 2 || !allowTools) {
          const rescued = rescueSpeakFromThoughts(thoughts);
          if (rescued && !isMostlyEnglishSpeak(rescued)) {
            trace(`AI 空回话  从思考捞出一句：${clipLine(rescued)}`);
            return composeSpeak(thoughts.join("\n\n"), rescued);
          }
          trace("AI 空回话  二次仍空，结束本轮");
          return composeSpeak(
            thoughts.join("\n\n"),
            "我这边绕远了。请再说一下要我做哪一步，我直接干。",
          );
        }
        const assist: LlmMessage = {
          role: "assistant",
          content: turnSpeak || turn.content || "",
        };
        if (turnThink) assist.reasoning_content = turnThink;
        else if (isDeepSeekProvider(this.opts.baseUrl || "", this.opts.model || "")) {
          assist.reasoning_content = turn.reasoning || "";
        }
        history.push(assist);
        nudge(
          "回话必须用简体中文。刚才若只有思考或大段英文报告，请用两三句中文直接回答用户，写在 <think> 标签外面；不要 IDENTITY/DEMO/TIMELINE 英文标题，不要「思考：」前缀，不要工具名或 JSON。",
          "空回话催中文",
        );
        return "cont";
      }

      emptySpeak = 0;
      if (!speakNow) toolOnlyEmpty += 1;
      else toolOnlyEmpty = 0;

      let digThis = 0;
      for (const call of calls) {
        if (call.function.name !== "nexus_shell") continue;
        if (isSourceDigShell(parseArgs(call.function.arguments || "{}"))) digThis += 1;
      }
      if (digThis) shellDig += digThis;
      else shellDig = Math.max(0, shellDig - 1);

      await runCalls(
        calls,
        contentForTools,
        leaked.length > 0,
        turn.reasoning || turnThink || undefined,
      );

      if (shellDig >= 3) {
        shellDig = 0;
        nudge(
          "停：不要再用 shell 抠框架源码或 NapCat 打包文件猜 API。QQ 群文件用 nexus_qq_group_files / nexus_qq_group_file_get；禁言用 nexus_qq_ban；重启用 nexus_framework_restart。先写两三句中文进度（标签外），再调正确工具。",
          "禁止抠源码",
        );
      } else if (toolOnlyEmpty >= 6) {
        toolOnlyEmpty = 0;
        nudge(
          "停一下：连续多轮只有工具没有回话。先用简体中文两三句告诉用户当前进度和卡点，写在 <think> 外面；然后再调下一步。禁止空转。",
          "工具空转催进度",
        );
      } else if (round === 12 || round === 20) {
        nudge(
          `已进行约 ${round} 轮。若目标仍未完成：换直接工具，或用中文说明卡点；不要继续漫无目的地翻目录/抠源码。`,
          `第 ${round} 轮提醒`,
        );
      }
      return "cont";
    };

    for (let i = 1; i <= hardCap; i++) {
      const done = await oneTurn(i, true);
      if (done !== "cont") return finish(done);
      if (i === hardCap - 1) {
        nudge(
          "轮次将尽。停止继续挖工具。用简体中文总结：已做到哪、卡在哪、还需要主人提供什么；写在 <think> 外面，不要再调工具。",
          "收尾催总结",
        );
        const last = await oneTurn(i + 1, false);
        if (last !== "cont") return finish(last);
        break;
      }
      if (i % 10 === 0) trace(`AI 仍在继续  已 ${i}/${hardCap} 回合`);
    }
    const rescued = rescueSpeakFromThoughts(thoughts);
    trace("AI 停  已到安全轮次上限");
    return finish(
      composeSpeak(
        thoughts.join("\n\n"),
        rescued && !isMostlyEnglishSpeak(rescued)
          ? rescued
          : "这事我绕远了，先停一下。你再说要我做的下一步，我按直接工具重来。",
      ),
    );
  }

  private endpoint(): string {
    return (this.opts.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  }

  private buildBody(
    messages: LlmMessage[],
    tools: LlmToolDef[] | undefined,
    stream: boolean,
  ): Record<string, unknown> {
    const model = this.opts.model ?? "gpt-4o-mini";
    const deepseek = isDeepSeekProvider(this.opts.baseUrl || "", model);
    const withTools = Boolean(tools?.length);
    const body: Record<string, unknown> = {
      model,
      messages: messages.map((m) => {
        let content: string | LlmContentPart[] = m.content;
        let reasoning = m.reasoning_content;
        // 会话里可能把思考写进 <think>；DeepSeek 带 tools 时要拆成 reasoning_content 回传
        if (
          deepseek &&
          withTools &&
          m.role === "assistant" &&
          typeof content === "string" &&
          !reasoning
        ) {
          const peeled = peelThinkTags(content);
          if (peeled.think) {
            reasoning = peeled.think;
            content = peeled.speak;
          }
        }
        const row: Record<string, unknown> = { role: m.role, content };
        if (m.name) row.name = m.name;
        if (m.tool_call_id) row.tool_call_id = m.tool_call_id;
        if (m.tool_calls?.length) row.tool_calls = m.tool_calls;
        if (m.role === "assistant" && reasoning != null && reasoning !== undefined) {
          row.reasoning_content = reasoning;
        } else if (
          deepseek &&
          withTools &&
          m.role === "assistant" &&
          (m.tool_calls?.length || reasoning === "")
        ) {
          row.reasoning_content = reasoning || "";
        }
        return row;
      }),
      stream,
    };
    if (tools?.length) {
      body.tools = tools;
      body.tool_choice = "auto";
    }
    // DeepSeek V4 等：显式开思考（官方默认也开，写死避免被兼容层关掉）
    if (deepseek) {
      body.thinking = { type: "enabled" };
      body.reasoning_effort = "high";
    }
    return body;
  }

  private async chatTurn(
    messages: LlmMessage[],
    tools?: LlmToolDef[],
  ): Promise<{ content: string; reasoning?: string; tool_calls?: LlmToolCall[] }> {
    if (!this.opts.apiKey) return { content: "" };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 600_000);
    let res: Response;
    try {
      res = await fetch(`${this.endpoint()}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.opts.apiKey}`,
        },
        body: JSON.stringify(this.buildBody(messages, tools, false)),
        signal: ctrl.signal,
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        throw new Error("LLM 请求超时");
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`LLM error ${res.status}: ${err}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          reasoning_content?: string | null;
          reasoning?: string | null;
          tool_calls?: LlmToolCall[];
        };
      }>;
    };
    const msg = data.choices?.[0]?.message;
    const reasoning = String(msg?.reasoning_content ?? msg?.reasoning ?? "").trim();
    return {
      content: String(msg?.content ?? ""),
      reasoning: reasoning || undefined,
      tool_calls: msg?.tool_calls?.length ? msg.tool_calls : undefined,
    };
  }

  /** 流式一轮。思考与正文都会交给 onDelta。 */
  private async chatTurnStream(
    messages: LlmMessage[],
    tools: LlmToolDef[] | undefined,
    onDelta?: (text: string) => void,
  ): Promise<{ content: string; reasoning?: string; tool_calls?: LlmToolCall[] }> {
    if (!this.opts.apiKey) return { content: "" };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 600_000);
    let res: Response;
    try {
      res = await fetch(`${this.endpoint()}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.opts.apiKey}`,
        },
        body: JSON.stringify(this.buildBody(messages, tools, true)),
        signal: ctrl.signal,
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        throw new Error("LLM 请求超时");
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`LLM error ${res.status}: ${err}`);
    }
    if (!res.body) {
      return this.chatTurn(messages, tools);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let content = "";
    let reasoning = "";
    let thinkHeader = false;
    let bodyStarted = false;
    const toolAcc = new Map<number, { id: string; name: string; arguments: string }>();

    const flushLine = (line: string) => {
      const s = line.trim();
      if (!s.startsWith("data:")) return;
      const payload = s.slice(5).trim();
      if (!payload || payload === "[DONE]") return;
      let json: {
        choices?: Array<{
          delta?: {
            content?: string | null;
            reasoning_content?: string | null;
            reasoning?: string | null;
            tool_calls?: Array<{
              index?: number;
              id?: string;
              function?: { name?: string; arguments?: string };
            }>;
          };
        }>;
      };
      try {
        json = JSON.parse(payload) as typeof json;
      } catch {
        return;
      }
      const delta = json.choices?.[0]?.delta;
      if (!delta) return;
      const thinkPiece = delta.reasoning_content ?? delta.reasoning;
      if (thinkPiece) {
        if (!thinkHeader) {
          thinkHeader = true;
          onDelta?.("思考：\n");
        }
        reasoning += thinkPiece;
        onDelta?.(thinkPiece);
      }
      const piece = delta.content;
      if (piece) {
        if (thinkHeader && !bodyStarted && reasoning) {
          bodyStarted = true;
          onDelta?.("\n\n");
        }
        content += piece;
        onDelta?.(piece);
      }
      if (delta.tool_calls?.length) {
        for (const tc of delta.tool_calls) {
          const idx = Number(tc.index ?? 0);
          const cur = toolAcc.get(idx) || { id: "", name: "", arguments: "" };
          if (tc.id) cur.id = tc.id;
          if (tc.function?.name) cur.name += tc.function.name;
          if (tc.function?.arguments) cur.arguments += tc.function.arguments;
          toolAcc.set(idx, cur);
        }
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() || "";
      for (const line of lines) flushLine(line);
    }
    if (buf.trim()) flushLine(buf);

    const tool_calls: LlmToolCall[] | undefined = toolAcc.size
      ? [...toolAcc.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([, t]) => ({
            id: t.id || `call_${Math.random().toString(36).slice(2, 10)}`,
            type: "function" as const,
            function: { name: t.name, arguments: t.arguments || "{}" },
          }))
      : undefined;

    return {
      content,
      reasoning: reasoning.trim() || undefined,
      tool_calls,
    };
  }
}
