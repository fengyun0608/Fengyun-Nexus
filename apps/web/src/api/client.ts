const KEY = "nexus.admin.token";

export function readToken(): string {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function writeToken(token: string): void {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export async function api<T = unknown>(
  path: string,
  init?: RequestInit & { token?: string; timeoutMs?: number },
): Promise<T> {
  const { token, timeoutMs, headers: initHeaders, ...rest } = init ?? {};
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(initHeaders as Record<string, string> | undefined),
  };
  const t = token ?? readToken();
  if (t) headers.authorization = `Bearer ${t}`;

  const ctrl = new AbortController();
  const ms = timeoutMs ?? 45_000;
  const timer = window.setTimeout(() => ctrl.abort(), ms);
  let res: Response;
  try {
    res = await fetch(path, { ...rest, headers, signal: ctrl.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error(`请求超时（${Math.round(ms / 1000)} 秒）`);
    }
    throw e;
  } finally {
    window.clearTimeout(timer);
  }

  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(res.ok ? "响应不是 JSON" : `HTTP ${res.status}`);
    }
  }
  if (!res.ok) {
    throw new Error(String(data.error || data.message || res.statusText || "请求失败"));
  }
  return data as T;
}
