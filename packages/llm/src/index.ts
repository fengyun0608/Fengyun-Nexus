export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmRouterOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export class LlmRouter {
  constructor(private opts: LlmRouterOptions = {}) {}

  /** Offline-friendly reply when no key is configured. */
  async chat(messages: LlmMessage[]): Promise<string> {
    const last = [...messages].reverse().find((m) => m.role === "user");
    const text = last?.content?.trim() ?? "";

    if (!this.opts.apiKey) {
      return text
        ? `【风云枢纽 · 本地回复】已收到：${text}\n（未配置模型密钥时使用本地回声。可用 pnpm nexus set llm-key 配置。）`
        : "你好，我是风云枢纽。在控制台对话、管理适配器与插件，从这里开始。";
    }

    const base = (this.opts.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    const model = this.opts.model ?? "gpt-4o-mini";
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.opts.apiKey}`,
      },
      body: JSON.stringify({ model, messages, stream: false }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`LLM error ${res.status}: ${err}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? "";
  }
}
