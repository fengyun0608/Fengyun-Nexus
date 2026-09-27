/**
 * AI 出站机密打码：IP / 密码 / token / 账密连接串等。
 * 用于思考合并转发、回话气泡、会话落库，降低误泄露。
 * 不会改写 [CQ:…] 段与 base64 媒体，避免发图坏掉。
 */

const IPV4_RE =
  /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})\b/g;

const SECRET_KEY =
  "(?:密码|口令|口令码|通行码|passwd|password|pwd|secret|token|api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|auth|credential|私钥|密钥|access_token|secret_key)";

function maskIpv4(ip: string): string {
  const p = ip.split(".");
  if (p.length !== 4) return "***.***.***.***";
  return `${p[0]}.***.***.${p[3]}`;
}

function maskTail(value: string, keep = 2): string {
  const v = String(value || "");
  if (v.length <= keep) return "***";
  if (v.length <= 6) return `${"*".repeat(Math.max(3, v.length - 1))}${v.slice(-1)}`;
  return `${"*".repeat(Math.min(12, v.length - keep))}${v.slice(-keep)}`;
}

function withPlaceholders(
  text: string,
  pattern: RegExp,
  fn: (body: string) => string,
): string {
  const slots: string[] = [];
  const marked = text.replace(pattern, (m) => {
    const i = slots.length;
    slots.push(m);
    return `\u0000KEEP${i}\u0000`;
  });
  const redacted = fn(marked);
  return redacted.replace(/\u0000KEEP(\d+)\u0000/g, (_m, n) => slots[Number(n)] ?? "");
}

/** 对单段文本打码；空串原样返回 */
export function redactSecrets(text: string): string {
  if (!text) return text;
  return withPlaceholders(
    String(text),
    /\[CQ:[^\]]*\]|data:[^\s"'`]+|base64:\/\/[^\s"'`\]]+/gi,
    (raw) => {
      let s = raw;

      // URL / 连接串 user:pass@host
      s = s.replace(
        /((?:[a-z][a-z0-9+.-]*:\/\/)?)([^:@\s/"'`\n]{1,64})(:[^@\s"'`\n]{1,200})(@)/gi,
        (_m, proto: string, user: string, _pass: string, at: string) =>
          `${proto || ""}${user}:***${at}`,
      );

      // 字段赋值：密码=xxx / password: "xxx"
      s = s.replace(
        new RegExp(
          `(${SECRET_KEY})(\\s*[=：:]\\s*)(["'\`]?)([^\\s,;，；"'\`\\n\\r]+)\\3`,
          "gi",
        ),
        (_m, key: string, sep: string, q: string, val: string) => {
          const masked = maskTail(val);
          return q ? `${key}${sep}${q}${masked}${q}` : `${key}${sep}${masked}`;
        },
      );

      // 中文「密码是 xxx」「口令为 xxx」
      s = s.replace(
        /(密码|口令|密钥|token|api[_-]?key)\s*(是|为|等于)\s*([^\s,;，；。！？"'`\n\r]{3,})/gi,
        (_m, key: string, verb: string, val: string) =>
          `${key}${verb}${maskTail(val)}`,
      );

      // Bearer / Basic
      s = s.replace(
        /\b(Bearer|Basic)\s+([A-Za-z0-9._\-+\/=]{8,})/gi,
        (_m, kind: string, tok: string) => `${kind} ${maskTail(tok, 4)}`,
      );

      // PEM 私钥
      s = s.replace(
        /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/gi,
        "-----BEGIN PRIVATE KEY----- ***已打码*** -----END PRIVATE KEY-----",
      );

      // IPv4（:端口保留，只打码 IP）
      s = s.replace(IPV4_RE, (ip) => maskIpv4(ip));

      return s;
    },
  );
}

export function redactSecretsList(items: string[]): string[] {
  return items.map((x) => redactSecrets(x));
}
