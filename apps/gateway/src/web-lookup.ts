/**
 * 主人让 AI 搜公开网页、读一个网址。
 * 只走 http/https，不碰本机和内网。
 */

export type WebHit = { title: string; url: string; snippet: string };

const UA = "FengyunNexus/1.0";

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/\s+/g, " ")
    .trim();
}

export function publicHttpUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(String(raw || "").trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".localhost")) {
    return null;
  }
  if (host === "0.0.0.0" || host === "::" || host === "::1") return null;
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    ) {
      return null;
    }
  }
  if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return null;
  return url;
}

async function pull(url: string, accept: string): Promise<{ finalUrl: string; status: number; text: string }> {
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
    headers: { "user-agent": UA, accept },
  });
  const buf = Buffer.from(await res.arrayBuffer()).subarray(0, 500_000);
  return { finalUrl: res.url, status: res.status, text: buf.toString("utf8") };
}

function parseRss(xml: string): WebHit[] {
  const out: WebHit[] = [];
  for (const block of xml.match(/<item\b[\s\S]*?<\/item>/gi) || []) {
    const title = decodeEntities(block.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
    const link = decodeEntities(block.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i)?.[1] || "");
    const snippet = decodeEntities(
      block.match(/<description\b[^>]*>([\s\S]*?)<\/description>/i)?.[1] || "",
    );
    if (!title || !publicHttpUrl(link)) continue;
    out.push({ title: clip(title, 120), url: link, snippet: clip(snippet, 180) });
    if (out.length >= 5) break;
  }
  return out;
}

function parseDdg(html: string): WebHit[] {
  const out: WebHit[] = [];
  const re = /<a[^>]*class="[^"]*result-link[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(re)) {
    let href = decodeEntities(m[1] || "");
    try {
      const wrapped = new URL(href, "https://duckduckgo.com");
      const uddg = wrapped.searchParams.get("uddg");
      if (uddg) href = uddg;
    } catch {
      /* keep href */
    }
    const title = decodeEntities(m[2] || "");
    if (!title || !publicHttpUrl(href)) continue;
    out.push({ title: clip(title, 120), url: href, snippet: "" });
    if (out.length >= 5) break;
  }
  return out;
}

export async function webSearch(rawQuery: string): Promise<{
  ok: boolean;
  query: string;
  items: WebHit[];
  message: string;
}> {
  const query = clip(String(rawQuery || ""), 120);
  if (!query) return { ok: false, query: "", items: [], message: "缺少搜索词" };
  const q = encodeURIComponent(query);
  try {
    const bing = await pull(
      `https://www.bing.com/search?q=${q}&format=rss&setlang=zh-Hans`,
      "application/rss+xml, application/xml, text/xml",
    );
    let items = parseRss(bing.text);
    if (!items.length) {
      const ddg = await pull(
        `https://lite.duckduckgo.com/lite/?q=${q}`,
        "text/html",
      );
      items = parseDdg(ddg.text);
    }
    if (!items.length) {
      return { ok: false, query, items: [], message: "没搜到公开结果" };
    }
    return { ok: true, query, items, message: `搜到 ${items.length} 条` };
  } catch (e) {
    return {
      ok: false,
      query,
      items: [],
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function webRead(rawUrl: string): Promise<{
  ok: boolean;
  url?: string;
  title?: string;
  text?: string;
  message: string;
}> {
  const url = publicHttpUrl(rawUrl);
  if (!url) return { ok: false, message: "只读公开的 http/https 网页，不读本机和内网" };
  try {
    const page = await pull(url.toString(), "text/html, text/plain");
    if (!publicHttpUrl(page.finalUrl)) {
      return { ok: false, message: "页面跳到了不允许的地址" };
    }
    if (page.status >= 400) {
      return { ok: false, url: page.finalUrl, message: `网页返回 ${page.status}` };
    }
    const title = clip(decodeEntities(page.text.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ""), 120);
    const body = page.text
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ");
    const text = clip(decodeEntities(body), 1800);
    if (!text) return { ok: false, url: page.finalUrl, title, message: "页面没有可读正文" };
    return { ok: true, url: page.finalUrl, title, text, message: title || "已读到正文" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
