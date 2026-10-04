import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

/** 模型在念供应商 Agent 沙箱，或谎称本机工具没挂上 */
function looksLikeForeignAgentSandbox(speak: string, think: string): boolean {
  const t = `${speak}\n${think}`;
  return /sandbox:\/\/|\/mnt\/agents\/|<REF>\s*file[?✦?]sandbox|没有(?:.*)?(?:发)?文件(?:的)?工具|只能把文件链接给你|沙箱里?生成|沙箱路径|本机没有对应|无法直接发(?:到)?群|工具没挂到|工具没挂全|没挂到我手上|够不着你那台|无关的\s*Linux\s*沙箱|只看得到自己这边|这会儿真查不了|推不进群|看不到你本机|没法(?:给你)?读|等能力恢复|能力恢复我/i.test(
    t,
  );
}

function isRealKimiSignedFileUrl(url: string, name: string): boolean {
  const u = String(url || "").trim();
  const n = String(name || "").trim();
  if (!u || !n) return false;
  // 提示词/纠偏里的占位，绝不能当真链
  if (/^(文件名|filename|file|name|xxx|示例)$/i.test(n)) return false;
  if (/[…⋯]|真实签名|\.{3}/.test(u)) return false;
  if (/[…⋯]|真实签名|示例|placeholder/i.test(n)) return false;
  // 真链：必须走 sign-obj，且带签名参数或足够长的对象路径
  if (!/kimi\.com\/apiv2-files\/sign-obj\//i.test(u)) return false;
  if (!/[?&]sig=/i.test(u) && !/sign-obj\/[A-Za-z0-9_%-]{24,}/i.test(u)) return false;
  return true;
}

function hasKimiFileLink(text: string): boolean {
  return extractKimiFileLinks(text).length > 0;
}

/**
 * 定位符：回形针 emoji。格式：
 * 📎 [真实文件名](https://www.kimi.com/apiv2-files/sign-obj/…真实签名…)
 * 可出现在回话任意位置；只认带 sig= 的真链，忽略提示词占位。
 */
function extractKimiFileLinks(text: string): Array<{ name: string; url: string }> {
  const raw = String(text || "");
  const out: Array<{ name: string; url: string }> = [];
  const seen = new Set<string>();
  const re =
    /📎\s*\[([^\]]{1,200})\]\(\s*(https?:\/\/(?:www\.)?kimi\.com\/apiv2-files\/[^)\r\n]+)\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const name = String(m[1] || "file").trim() || "file";
    const url = String(m[2] || "")
      .trim()
      .replace(/[，。；;]+$/g, "");
    if (!isRealKimiSignedFileUrl(url, name)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ name, url });
  }
  return out;
}

function formatKimiPaperclips(links: Array<{ name: string; url: string }>): string {
  return links.map((x) => `📎 [${x.name}](${x.url})`).join("\n");
}

/** 只扫 assistant 正文/思考 + 本回合增量；不扫 system（会误中提示词示例） */
function harvestTextBlob(history: LlmMessage[], extra: string[]): string {
  const parts: string[] = [];
  for (const msg of history) {
    if (msg.role === "system" || msg.role === "tool") continue;
    // 框架纠偏 user 里也会写示例格式，跳过
    if (msg.role === "user" && /^系统：/.test(String(typeof msg.content === "string" ? msg.content : ""))) {
      continue;
    }
    if (msg.role !== "assistant" && msg.role !== "user") continue;
    if (typeof msg.content === "string") parts.push(msg.content);
    else if (Array.isArray(msg.content)) {
      for (const p of msg.content) {
        if (p && typeof p === "object" && p.type === "text") parts.push(String(p.text || ""));
      }
    }
    if (msg.reasoning_content) parts.push(String(msg.reasoning_content));
  }
  for (const x of extra) if (x) parts.push(x);
  return parts.join("\n");
}

function wantsLocalDocSend(history: LlmMessage[], speak: string, think: string): boolean {
  const userBits = history
    .filter((m) => m.role === "user")
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .join("\n");
  const t = `${userBits}\n${speak}\n${think}`;
  return /出\s*pdf|生成\s*pdf|\.pdf|\.pptx|PPT|ppt|发(?:到)?群|发文件|安全(?:检测)?报告|检测报告|写(?:个|一份|份)?(?:随机)?(?:报告|PDF|pdf|PPT|ppt)|随便写|对世界的看法|简约/i.test(
    t,
  );
}

/** 只要干净中文回话，丢掉英文思考 / 工具空喊 */
function pickCleanChineseBody(speak: string): string {
  const cleaned = speakOutsideTags(speak)
    .replace(/<REF>[\s\S]*?<\/REF>/gi, "")
    .replace(/📎\s*\[[^\]]+\]\(\s*https?:\/\/(?:www\.)?kimi\.com\/apiv2-files\/[^)]+\)/gi, "")
    .replace(/sandbox:\/\/[^\s"'`<>）)\]]+/gi, "")
    .replace(/\/mnt\/agents\/[^\s"'`<>）)\]]+/gi, "")
    .replace(/nexus_[a-z0-9_]+/gi, "")
    .trim();
  const lines = cleaned
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => {
      if (!l) return false;
      if (
        /User asks|Steps:|Previous pattern|python-pptx|ipython|Deliver|file REF|WQY ZenHei|ASCII|I'll |Let me |Owner asks/i.test(
          l,
        )
      ) {
        return false;
      }
      if (/没挂上|推不进群|工具这轮|只能把文件/i.test(l)) return false;
      const cn = (l.match(/[\u4e00-\u9fff]/g) || []).length;
      const en = (l.match(/[A-Za-z]/g) || []).length;
      if (en >= 30 && cn < 8) return false;
      return cn >= 2;
    });
  let body = lines.join("\n").trim();
  if (body.length > 8000) body = `${body.slice(0, 8000)}\n…`;
  return body;
}

async function trySendLocalFile(
  onTool: LlmToolHandler,
  path: string,
  name: string,
  trace: (line: string) => void,
): Promise<{ ok: boolean; tip: string }> {
  trace(`AI 框架代跑  发送 ${path}`);
  const sent = (await onTool("nexus_qq_send_file", {
    path,
    name,
  })) as { ok?: boolean; message?: string; error?: string };
  if (sent?.ok) return { ok: true, tip: sent.message || `已发 ${name}` };
  return { ok: false, tip: `${name} 发送失败：${sent?.message || sent?.error || "未知"}` };
}

async function downloadUrlToAsciiTemp(
  url: string,
  filename: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const safe = filename.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "_").slice(0, 80) || "kimi-file";
  const dir = join(tmpdir(), "fengyun-nexus-kimi");
  mkdirSync(dir, { recursive: true });
  const abs = join(dir, `${Date.now()}-${safe}`);
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        accept: "*/*",
        referer: "https://www.kimi.com/",
      },
      signal: AbortSignal.timeout(90_000),
      redirect: "follow",
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 32) return { ok: false, error: `空文件 ${buf.length}B` };
    writeFileSync(abs, buf);
    return { ok: true, path: abs };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 下载朋友上游自动注入的 📎 kimi 签名链，再 upload 到群（不用本机造假 PPT） */
async function tryKimiDownloadAndSend(
  onTool: LlmToolHandler,
  blob: string,
  trace: (line: string) => void,
): Promise<string | null> {
  const links = extractKimiFileLinks(blob);
  if (!links.length) return null;
  const sentNames: string[] = [];
  const failTips: string[] = [];
  for (const link of links) {
    const safe = link.name.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "_").slice(0, 80) || "kimi-file";
    trace(`AI 框架代跑  下载上游文件 ${link.name}`);
    const dl = await downloadUrlToAsciiTemp(link.url, safe);
    if (!dl.ok) {
      failTips.push(`${link.name} 下载失败：${dl.error}`);
      continue;
    }
    const r = await trySendLocalFile(onTool, dl.path, safe, trace);
    if (r.ok) sentNames.push(safe);
    else failTips.push(r.tip);
  }
  if (sentNames.length) return `好了，已发到群里：${sentNames.join("、")}`;
  if (failTips.length) trace(`AI 框架代跑  上游文件下载未成 ${failTips.join("；")}`);
  return null;
}

/** 无参：正文点名即可当调用 */
const KEYWORD_ZERO_ARG = new Set([
  "nexus_host_info",
  "nexus_host_uptime",
  "nexus_screen",
  "nexus_list_caps",
  "nexus_list_mcp",
  "nexus_open_apps",
  "nexus_onebot_get",
]);

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
    if (/^(用户|我需要|让我|接下来|策略|计划|分析一下|先看情况)/.test(p)) return true;
    if (
      /系统标注说话人|这看起来主人|我应该幽默回应|不需要真的调|关于["“]?#/.test(p)
    ) {
      return true;
    }
    if (p.length >= 80 && /主人问|这条消息前面有个|可能是主人打的字|作为 bot/.test(p)) {
      return true;
    }
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

/**
 * 正文关键词兼容：正式 tool_calls 没有时，从正文抠本机工具再执行。
 * 支持 DSML/XML、CALL nexus_xxx {json}、nexus_xxx({...})、点名无参工具。
 */
function leakedToolCalls(text: string, allowedNames?: Set<string>): LlmToolCall[] {
  const raw = String(text || "");
  const out: LlmToolCall[] = [];
  const seen = new Set<string>();
  const allow = (name: string) => !allowedNames || allowedNames.has(name);
  const push = (name: string, args: Record<string, unknown>) => {
    const n = name.trim().replace(/\./g, "_").toLowerCase();
    if (!/^nexus_[a-z0-9_]+$/i.test(n)) return;
    if (!allow(n)) return;
    const key = `${n}:${JSON.stringify(args)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      id: `leak_${out.length}_${n}`,
      type: "function",
      function: { name: n, arguments: JSON.stringify(args) },
    });
  };

  if (/DSML|tool_calls|invoke\s+name\s*=|function_calls/i.test(raw)) {
    const invokeRe =
      /name\s*=\s*["'](nexus_[a-zA-Z0-9_.]+)["']([^]*?)(?:<\/[^>\n]*invoke>|<\/invoke>|(?=<[^>\n]*tool_calls)|$)/gi;
    let m: RegExpExecArray | null;
    while ((m = invokeRe.exec(raw))) {
      const args: Record<string, unknown> = {};
      const paramRe = /name\s*=\s*["']([A-Za-z0-9_]+)["'][^>]*>([^<]*)/g;
      let p: RegExpExecArray | null;
      const body = m[2] || "";
      while ((p = paramRe.exec(body))) {
        if (p[1] === "name") continue;
        args[p[1]!] = (p[2] || "").trim();
      }
      push(m[1]!, args);
    }
    const jsonRe =
      /"name"\s*:\s*"(nexus_[a-zA-Z0-9_.]+)"\s*,\s*"arguments"\s*:\s*(\{[\s\S]*?\})/g;
    while ((m = jsonRe.exec(raw))) {
      try {
        push(m[1]!, JSON.parse(m[2]!) as Record<string, unknown>);
      } catch {
        push(m[1]!, {});
      }
    }
  }

  const callRe =
    /(?:^|\n)\s*(?:CALL|调用|调)\s+(nexus_[a-z0-9_]+)\s*(\{[\s\S]*?\})?\s*(?=$|\n)/gi;
  let cm: RegExpExecArray | null;
  while ((cm = callRe.exec(raw))) {
    let args: Record<string, unknown> = {};
    if (cm[2]) {
      try {
        args = JSON.parse(cm[2]) as Record<string, unknown>;
      } catch {
        args = {};
      }
    }
    push(cm[1]!, args);
  }

  const fnRe = /\b(nexus_[a-z0-9_]+)\s*\(\s*(\{[\s\S]*?\})?\s*\)/gi;
  while ((cm = fnRe.exec(raw))) {
    let args: Record<string, unknown> = {};
    if (cm[2]) {
      try {
        args = JSON.parse(cm[2]) as Record<string, unknown>;
      } catch {
        args = {};
      }
    }
    push(cm[1]!, args);
  }

  // 点名无参：常念「要调 nexus_host_info」却不下正式 call
  {
    const named = new Set<string>();
    const nameRe = /\b(nexus_[a-z0-9_]+)\b/gi;
    let nm: RegExpExecArray | null;
    while ((nm = nameRe.exec(raw))) {
      const n = nm[1]!.toLowerCase();
      if (KEYWORD_ZERO_ARG.has(n) && allow(n)) named.add(n);
    }
    const missingClaim = looksLikeForeignAgentSandbox(raw, "");
    const asksRun =
      missingClaim ||
      /要调|调用|用\s*nexus_|CALL\s+nexus_|查(?:看)?(?:一下)?|系统状态|uptime|内存|磁盘|截屏|截图|什么协议|协议端|OneBot|NapCat/i.test(
        raw,
      );
    if (asksRun) {
      for (const n of named) push(n, {});
    }
    // 谎称工具没挂全、又提日志/配置：直接代跑读日志
    if (
      missingClaim &&
      allow("nexus_shell") &&
      /gateway\.log|配置文件|configs[/\\]|反向\s*WS|HTTP\s*还是|实际配置/i.test(raw)
    ) {
      push("nexus_shell", {
        command:
          "Get-Content -Tail 60 data\\logs\\gateway.log | Select-String -Pattern 'OneBot|反向|ws://|HTTP|clients='",
      });
    }
    // 提协议 / OneBot 但没点名工具：补 nexus_onebot_get
    if (
      missingClaim &&
      allow("nexus_onebot_get") &&
      /OneBot|协议|NapCat|反向\s*WS/i.test(raw) &&
      !out.some((c) => c.function.name === "nexus_onebot_get")
    ) {
      push("nexus_onebot_get", {});
    }
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
    const allowedToolNames = new Set(
      tools.map((t) => String(t.function?.name || "").toLowerCase()).filter((n) => /^nexus_/.test(n)),
    );
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
    let foreignAgentNudge = 0;
    /** 下一回合强制 tool_choice=required，逼走本机 tools */
    let forceToolRequired = false;
    /** 追回形针链时不要塞 tools，避免模型又念「没挂工具」 */
    let forceToolNone = false;
    const nudge = (content: string, why: string) => {
      history.push({ role: "user", content });
      trace(`AI 纠偏  ${why}`);
    };
    const oneTurn = async (
      round: number,
      allowTools: boolean,
    ): Promise<"done" | "cont" | string> => {
      const toolMode = forceToolNone
        ? ("none" as const)
        : forceToolRequired
          ? ("required" as const)
          : ("auto" as const);
      forceToolRequired = false;
      forceToolNone = false;
      const turn = await this.chatTurn(
        history,
        allowTools && toolMode !== "none" ? tools : undefined,
        toolMode,
      );
      const peeled = peelPlainThinkingFromContent(turn.content || "");
      const turnThink = [turn.reasoning?.trim(), peeled.think].filter(Boolean).join("\n\n");
      const turnSpeak = peeled.think ? peeled.speak : turn.content || "";
      if (turnThink) thoughts.push(turnThink);
      const contentForTools = `${turnSpeak || turn.content || ""}\n${turnThink}`;
      const leaked = turn.tool_calls?.length
        ? []
        : leakedToolCalls(contentForTools, allowedToolNames);
      const calls = allowTools
        ? turn.tool_calls?.length
          ? turn.tool_calls
          : leaked
        : [];
      const speakNow = speakOutsideTags(turnSpeak);
      if (leaked.length && !turn.tool_calls?.length) {
        trace(`AI 关键词工具  ${leaked.map((c) => c.function.name).join("、")}`);
      }
      trace(
        `AI 回合 ${round}  工具 ${calls.map((c) => c.function.name).join("、") || "无"}  正文 ${clipLine(speakNow) || "空"}  思考 ${clipLine(turnThink || "") || "无"}`,
      );
      if (!calls.length) {
        const text = composeSpeak(thoughts.join("\n\n"), turnSpeak);
        const speak = speakOutsideTags(text);

        // 整段对话扫 📎 [名](kimi.com/apiv2-files/…) —— 可能不在本回合末尾
        const huntBlob = harvestTextBlob(history, [
          thoughts.join("\n"),
          speak || turnSpeak,
          turnThink,
        ]);
        if (allowTools && hasKimiFileLink(huntBlob)) {
          const links = extractKimiFileLinks(huntBlob);
          const paper = formatKimiPaperclips(links);
          const body = pickCleanChineseBody(speak || turnSpeak);
          trace(`AI 截到 📎 文件链  ${links.length} 条`);
          const via = links.length ? await tryKimiDownloadAndSend(onTool, huntBlob, trace) : null;
          const parts = [body, paper, via].filter((x) => String(x || "").trim());
          return composeSpeak(
            thoughts.join("\n\n"),
            parts.join("\n\n") || paper || "文件链已截到。",
          );
        }

        // 只有沙箱 REF、没有 📎：追一次回形针，绝不本机造假 PPT
        if (
          allowTools &&
          looksLikeForeignAgentSandbox(speak || turnSpeak, turnThink) &&
          wantsLocalDocSend(history, speak || turnSpeak, turnThink)
        ) {
          if (foreignAgentNudge < 1) {
            foreignAgentNudge += 1;
            const assist: LlmMessage = {
              role: "assistant",
              content: turnSpeak || turn.content || "",
            };
            if (turnThink) assist.reasoning_content = turnThink;
            history.push(assist);
            forceToolNone = true;
            nudge(
              "系统：文件已在上游生成。请只输出一行可下载链：先写回形针emoji，再写方括号里的真实文件名，再写括号里的 https://www.kimi.com/apiv2-files/sign-obj/ 完整签名URL（须带 sig=）。禁止 sandbox、<REF>、禁止说工具没挂、禁止写占位省略号。",
              "追📎下载链",
            );
            return "cont";
          }
          const body = pickCleanChineseBody(speak || turnSpeak);
          return composeSpeak(
            thoughts.join("\n\n"),
            [
              body,
              "上游回包里没有可用的回形针签名下载链，没法下真文件；不会再用本机假 PPT 顶替。",
            ]
              .filter(Boolean)
              .join("\n\n"),
          );
        }

        if (
          allowTools &&
          foreignAgentNudge < 2 &&
          looksLikeForeignAgentSandbox(speak || turnSpeak, turnThink) &&
          !wantsLocalDocSend(history, speak || turnSpeak, turnThink)
        ) {
          foreignAgentNudge += 1;
          const assist: LlmMessage = {
            role: "assistant",
            content: turnSpeak || turn.content || "",
          };
          if (turnThink) assist.reasoning_content = turnThink;
          else if (isDeepSeekProvider(this.opts.baseUrl || "", this.opts.model || "")) {
            assist.reasoning_content = turn.reasoning || "";
          }
          history.push(assist);
          forceToolRequired = true;
          nudge(
            [
              "停：刚才那是供应商侧 Agent/沙箱，不是本机 Fengyun Nexus。",
              "禁止再提 /mnt/agents、sandbox://、<REF>file。那些群友下不到。",
              "立刻用本机 function tools（nexus_shell / nexus_workspace_* / nexus_qq_send_*），不要空喊工具名。",
            ].join(""),
            "禁供应商沙箱·强制本机工具",
          );
          return "cont";
        }

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
    toolChoice: "auto" | "required" | "none" = "auto",
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
      body.tool_choice = toolChoice === "none" ? "none" : toolChoice;
    }
    // DeepSeek V4 等：显式开思考（官方默认也开，写死避免被兼容层关掉）
    if (deepseek) {
      body.thinking = { type: "enabled" };
      body.reasoning_effort = "high";
    }
    return body;
  }

  /** 当前是否 DeepSeek（思考模式默认开） */
  usesDeepSeekThinking(): boolean {
    return isDeepSeekProvider(this.opts.baseUrl || "", this.opts.model || "");
  }

  private async chatTurn(
    messages: LlmMessage[],
    tools?: LlmToolDef[],
    toolChoice: "auto" | "required" | "none" = "auto",
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
        body: JSON.stringify(this.buildBody(messages, tools, false, toolChoice)),
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
