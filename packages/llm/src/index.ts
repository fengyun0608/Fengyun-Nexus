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
      apiKeyMasked: key ? `${key.slice(0, 4)}${"*".repeat(Math.min(8, Math.max(0, key.length - 4)))}` : "",
      baseUrl: this.opts.baseUrl ?? "",
      model: this.opts.model ?? "",
    };
  }

  /** Chat via configured provider. Returns empty string when no API key (no local echo). */
  async chat(messages: LlmMessage[]): Promise<string> {
    if (!this.opts.apiKey) {
      return "";
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
