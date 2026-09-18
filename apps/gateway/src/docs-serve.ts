/**
 * 控制台「编写文档」：只读打开仓库内教程 / 模板，路径白名单防穿越。
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

const ALLOW_PREFIXES = ["docs/", "plugins/templates/", "workflows/"] as const;

export type DocLink = {
  title: string;
  path: string;
  /** 控制台点开用：新窗口打开此地址 */
  url: string;
};

export function docLink(title: string, path: string): DocLink {
  const p = path.replace(/\\/g, "/").replace(/^\/+/, "");
  return {
    title,
    path: p,
    url: `/v1/docs/view?path=${encodeURIComponent(p)}`,
  };
}

/** 白名单比对只用正斜杠。Windows 的 path.normalize 会把 / 改成 \\，startsWith("docs/") 会误判。 */
function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

function underRoot(root: string, rel: string): string | null {
  const clean = toPosix(rel)
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");
  if (!clean || clean.includes("\0") || clean.split("/").includes("..")) return null;
  const ok = ALLOW_PREFIXES.some(
    (pre) => clean === pre.slice(0, -1) || clean.startsWith(pre),
  );
  if (!ok) return null;
  const abs = resolve(root, ...clean.split("/"));
  const rootAbs = resolve(root);
  const relToRoot = toPosix(relative(rootAbs, abs));
  if (!relToRoot || relToRoot === ".." || relToRoot.startsWith("../")) {
    return null;
  }
  return abs;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 够教程用的轻量 Markdown → HTML，不引入依赖 */
export function mdToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inCode = false;
  let codeLang = "";
  let codeBuf: string[] = [];
  let inUl = false;

  const flushUl = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
  };

  const inline = (t: string) => {
    let s = escapeHtml(t);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    );
    return s;
  };

  for (const raw of lines) {
    if (raw.startsWith("```")) {
      if (!inCode) {
        flushUl();
        inCode = true;
        codeLang = raw.slice(3).trim();
        codeBuf = [];
      } else {
        out.push(
          `<pre class="code"><code class="lang-${escapeHtml(codeLang)}">${escapeHtml(codeBuf.join("\n"))}</code></pre>`,
        );
        inCode = false;
        codeLang = "";
        codeBuf = [];
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(raw);
      continue;
    }
    if (/^\s*[-*]\s+/.test(raw)) {
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${inline(raw.replace(/^\s*[-*]\s+/, ""))}</li>`);
      continue;
    }
    flushUl();
    if (!raw.trim()) {
      out.push("");
      continue;
    }
    const h = raw.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      const n = h[1].length;
      out.push(`<h${n}>${inline(h[2])}</h${n}>`);
      continue;
    }
    out.push(`<p>${inline(raw)}</p>`);
  }
  flushUl();
  if (inCode) {
    out.push(`<pre class="code"><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
  }
  return out.filter((x) => x !== "").join("\n");
}

function pageShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · Fengyun Nexus</title>
  <style>
    :root {
      --bg: #f7fcf9;
      --ink: #1c322c;
      --muted: #5f7a70;
      --line: rgba(45, 140, 110, 0.18);
      --accent: #2f9b78;
      --card: #ffffff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(800px 400px at 0% 0%, rgba(76,175,138,.14), transparent 50%),
        linear-gradient(165deg, #f7fcf9, #eef8f3);
      line-height: 1.65;
    }
    ::selection { background: #2f9b78; color: #fff; }
    header {
      position: sticky; top: 0; z-index: 2;
      padding: 14px 22px;
      border-bottom: 1px solid var(--line);
      background: rgba(255,255,255,.92);
      backdrop-filter: blur(10px);
      display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap;
    }
    header strong { color: var(--accent); font-size: 1.05rem; }
    header span { color: var(--muted); font-size: 0.85rem; }
    main {
      max-width: 860px;
      margin: 0 auto;
      padding: 28px 22px 64px;
    }
    article {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 22px 26px;
      box-shadow: 0 12px 40px rgba(40,90,70,.06);
    }
    h1,h2,h3 { color: var(--accent); line-height: 1.3; }
    h1 { font-size: 1.55rem; margin: 0 0 16px; }
    h2 { font-size: 1.25rem; margin: 28px 0 10px; }
    h3 { font-size: 1.08rem; margin: 22px 0 8px; }
    p { margin: 0 0 12px; }
    ul { margin: 0 0 14px; padding-left: 1.25rem; }
    li { margin: 4px 0; }
    a { color: var(--accent); }
    code {
      font-family: ui-monospace, Consolas, monospace;
      font-size: 0.9em;
      background: #eef8f3;
      padding: 1px 6px;
      border-radius: 6px;
      color: #247a5e;
    }
    pre.code {
      overflow: auto;
      padding: 14px 16px;
      border-radius: 10px;
      background: #12201b;
      color: #e8f5ef;
      border: 1px solid rgba(47,155,120,.35);
    }
    pre.code code { background: transparent; color: inherit; padding: 0; }
    .file-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
    .file-list a {
      display: block;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid var(--line);
      text-decoration: none;
      background: #f3faf6;
    }
    .file-list a:hover { border-color: rgba(47,155,120,.45); background: #e8f6ef; }
    .err { color: #d4644a; }
  </style>
</head>
<body>
  <header>
    <strong>Fengyun Nexus</strong>
    <span>${escapeHtml(title)}</span>
  </header>
  <main><article>${body}</article></main>
</body>
</html>`;
}

export type DocViewResult =
  | { ok: true; html: string }
  | { ok: false; status: number; html: string };

export function renderDocView(root: string, rawPath: string): DocViewResult {
  const rel = String(rawPath || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  if (!rel) {
    return {
      ok: false,
      status: 400,
      html: pageShell("无效路径", `<p class="err">缺少 path 参数</p>`),
    };
  }
  const abs = underRoot(root, rel);
  if (!abs || !existsSync(abs)) {
    return {
      ok: false,
      status: 404,
      html: pageShell("未找到", `<p class="err">找不到：${escapeHtml(rel)}</p>`),
    };
  }

  const st = statSync(abs);
  if (st.isDirectory()) {
    const readme = ["README.md", "readme.md", "README.zh.md"].map((n) => join(abs, n)).find((p) => existsSync(p));
    if (readme) {
      const md = readFileSync(readme, "utf8");
      const title = `${basename(abs)} · ${basename(readme)}`;
      return {
        ok: true,
        html: pageShell(title, `<h1>${escapeHtml(title)}</h1>\n${mdToHtml(md)}`),
      };
    }
    const entries = readdirSync(abs)
      .filter((n) => !n.startsWith(".") && n !== "node_modules")
      .sort();
    const links = entries
      .map((name) => {
        const child = `${rel.replace(/\/$/, "")}/${name}`;
        const href = `/v1/docs/view?path=${encodeURIComponent(child)}`;
        return `<li><a href="${href}" target="_blank" rel="noopener">${escapeHtml(name)}</a></li>`;
      })
      .join("\n");
    return {
      ok: true,
      html: pageShell(
        rel,
        `<h1>${escapeHtml(rel)}</h1><p>示例 / 模板目录，点文件在新窗口打开：</p><ul class="file-list">${links}</ul>`,
      ),
    };
  }

  const text = readFileSync(abs, "utf8");
  const name = basename(abs);
  if (/\.(md|markdown)$/i.test(name)) {
    return {
      ok: true,
      html: pageShell(name, `<h1>${escapeHtml(name)}</h1>\n${mdToHtml(text)}`),
    };
  }
  return {
    ok: true,
    html: pageShell(
      name,
      `<h1>${escapeHtml(name)}</h1><pre class="code"><code>${escapeHtml(text)}</code></pre>`,
    ),
  };
}
