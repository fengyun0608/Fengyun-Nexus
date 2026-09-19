export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: LlmToolCall[];
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
  /** 仅正文增量。不发思考 / reasoning。 */
  onDelta?: (text: string) => void;
  maxRounds?: number;
};

/** 去掉模型偶发夹带的思考标签，不发给用户。 */
export function stripThinking(text: string): string {
  return String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/<\/?think>/gi, "")
    .trim();
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

  /** Chat via configured provider. Returns empty string when no API key (no local echo). */
  async chat(messages: LlmMessage[], streamOpts?: LlmStreamOpts): Promise<string> {
    if (streamOpts?.onDelta) {
      const r = await this.chatTurnStream(messages, undefined, streamOpts.onDelta);
      return stripThinking(r.content);
    }
    const r = await this.chatTurn(messages);
    return stripThinking(r.content);
  }

  /**
   * OpenAI 风格 tools：模型可多轮调工具，再给最终文本。
   * 有 onDelta 时只把最终正文流式吐出，不把思考过程发出去。
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
    const maxRounds = Math.min(Math.max(opts?.maxRounds ?? 6, 1), 8);
    for (let i = 0; i < maxRounds; i++) {
      const turn = await this.chatTurn(history, tools);
      const leaked = turn.tool_calls?.length ? [] : leakedToolCalls(turn.content);
      const calls = turn.tool_calls?.length ? turn.tool_calls : leaked;
      if (!calls.length) {
        const text = stripToolMarkup(stripThinking(turn.content));
        if (opts?.onDelta && text) await emitSoftDeltas(text, opts.onDelta);
        return text;
      }

      history.push({
        role: "assistant",
        content: leaked.length ? "" : turn.content || "",
        tool_calls: calls,
      });
      for (const call of calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          args = {};
        }
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
    }
    history.push({
      role: "user",
      content: "工具已经执行完。用一两句中文告诉用户结果。不要再调用工具，也不要把工具调用写进正文。",
    });
    let last = opts?.onDelta
      ? await this.chatTurnStream(history, undefined, opts.onDelta)
      : await this.chatTurn(history);
    // 终稿若还泄出工具调用，再执行一轮并强制要人话
    const more = leakedToolCalls(last.content);
    if (more.length) {
      history.push({
        role: "assistant",
        content: "",
        tool_calls: more,
      });
      for (const call of more) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          args = {};
        }
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
      history.push({
        role: "user",
        content: "好了。只用人话回复用户，一两句即可。禁止再写工具调用。",
      });
      last = opts?.onDelta
        ? await this.chatTurnStream(history, undefined, opts.onDelta)
        : await this.chatTurn(history);
    }
    const text = stripToolMarkup(stripThinking(last.content));
    return text || "好了。";
  }

  private endpoint(): string {
    return (this.opts.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  }

  private buildBody(
    messages: LlmMessage[],
    tools: LlmToolDef[] | undefined,
    stream: boolean,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.opts.model ?? "gpt-4o-mini",
      messages: messages.map((m) => {
        const row: Record<string, unknown> = { role: m.role, content: m.content };
        if (m.name) row.name = m.name;
        if (m.tool_call_id) row.tool_call_id = m.tool_call_id;
        if (m.tool_calls?.length) row.tool_calls = m.tool_calls;
        return row;
      }),
      stream,
    };
    if (tools?.length) {
      body.tools = tools;
      body.tool_choice = "auto";
    }
    return body;
  }

  private async chatTurn(
    messages: LlmMessage[],
    tools?: LlmToolDef[],
  ): Promise<{ content: string; tool_calls?: LlmToolCall[] }> {
    if (!this.opts.apiKey) return { content: "" };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45_000);
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
          tool_calls?: LlmToolCall[];
        };
      }>;
    };
    const msg = data.choices?.[0]?.message;
    return {
      content: String(msg?.content ?? ""),
      tool_calls: msg?.tool_calls?.length ? msg.tool_calls : undefined,
    };
  }

  /** 流式一轮。只把 content 增量交给 onDelta；忽略 reasoning_content。 */
  private async chatTurnStream(
    messages: LlmMessage[],
    tools: LlmToolDef[] | undefined,
    onDelta?: (text: string) => void,
  ): Promise<{ content: string; tool_calls?: LlmToolCall[] }> {
    if (!this.opts.apiKey) return { content: "" };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90_000);
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
      // 兼容不支持流的供应商：退回非流式
      return this.chatTurn(messages, tools);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let content = "";
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
      // 思考过程不发
      const piece = delta.content;
      if (piece) {
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

    return { content, tool_calls };
  }
}
