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
  async chat(messages: LlmMessage[]): Promise<string> {
    const r = await this.chatTurn(messages);
    return r.content;
  }

  /**
   * OpenAI 风格 tools：模型可多轮调工具，再给最终文本。
   * 无 apiKey 返回空串；无 tools 时等同 chat。
   */
  async chatWithTools(
    messages: LlmMessage[],
    tools: LlmToolDef[],
    onTool: LlmToolHandler,
    opts?: { maxRounds?: number },
  ): Promise<string> {
    if (!this.opts.apiKey) return "";
    if (!tools.length) return this.chat(messages);

    const history = messages.map((m) => ({ ...m }));
    const maxRounds = Math.min(Math.max(opts?.maxRounds ?? 4, 1), 8);
    for (let i = 0; i < maxRounds; i++) {
      const turn = await this.chatTurn(history, tools);
      if (!turn.tool_calls?.length) return turn.content.trim();

      history.push({
        role: "assistant",
        content: turn.content || "",
        tool_calls: turn.tool_calls,
      });
      for (const call of turn.tool_calls) {
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
          content: typeof result === "string" ? result : JSON.stringify(result),
        });
      }
    }
    const last = await this.chatTurn(history);
    return last.content.trim();
  }

  private async chatTurn(
    messages: LlmMessage[],
    tools?: LlmToolDef[],
  ): Promise<{ content: string; tool_calls?: LlmToolCall[] }> {
    if (!this.opts.apiKey) return { content: "" };

    const base = (this.opts.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    const model = this.opts.model ?? "gpt-4o-mini";
    const body: Record<string, unknown> = {
      model,
      messages: messages.map((m) => {
        const row: Record<string, unknown> = { role: m.role, content: m.content };
        if (m.name) row.name = m.name;
        if (m.tool_call_id) row.tool_call_id = m.tool_call_id;
        if (m.tool_calls?.length) row.tool_calls = m.tool_calls;
        return row;
      }),
      stream: false,
    };
    if (tools?.length) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45_000);
    let res: Response;
    try {
      res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.opts.apiKey}`,
        },
        body: JSON.stringify(body),
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
}
