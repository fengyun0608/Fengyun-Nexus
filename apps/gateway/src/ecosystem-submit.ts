/**
 * 投稿：用投稿人自己的 GitCode / GitHub 令牌列出仓库，改 fork 上的 catalog.json，向上游提 PR。
 * 令牌只在本次请求里用，不落盘。
 */
export type GitHost = "github" | "gitcode";

export type GitRepo = {
  fullName: string;
  url: string;
  description: string;
  private: boolean;
  defaultBranch: string;
};

const HUB: Record<GitHost, { owner: string; repo: string; web: string }> = {
  github: {
    owner: "fengyun0608",
    repo: "fengyun-nexus-ecosystem",
    web: "https://github.com/fengyun0608/fengyun-nexus-ecosystem",
  },
  gitcode: {
    owner: "fengyunnb_admin",
    repo: "fengyun-nexus-ecosystem",
    web: "https://gitcode.com/fengyunnb_admin/fengyun-nexus-ecosystem",
  },
};

type HttpResult = { ok: boolean; status: number; json: unknown; text: string };

function redact(text: string, token: string): string {
  if (!token) return text;
  return text.split(token).join("***");
}

async function http(
  url: string,
  token: string,
  init?: { method?: string; body?: unknown; host?: GitHost },
): Promise<HttpResult> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "user-agent": "Fengyun-Nexus",
  };
  if (token) {
    headers.authorization = init?.host === "github" ? `Bearer ${token}` : `Bearer ${token}`;
  }
  if (init?.host === "github") headers.accept = "application/vnd.github+json";
  let body: string | undefined;
  if (init?.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(init.body);
  }
  const res = await fetch(url, {
    method: init?.method || "GET",
    headers,
    body,
    signal: AbortSignal.timeout(40_000),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text: redact(text, token).slice(0, 500) };
}

function errMsg(res: HttpResult, fallback: string): string {
  const j = res.json as { message?: string; error?: string } | null;
  return String(j?.message || j?.error || res.text || fallback).slice(0, 240);
}

function asHost(raw: string): GitHost | null {
  return raw === "github" || raw === "gitcode" ? raw : null;
}

export async function loginGitAccount(
  hostRaw: string,
  token: string,
): Promise<{ ok: boolean; login?: string; name?: string; message: string }> {
  const host = asHost(hostRaw);
  const tok = token.trim();
  if (!host) return { ok: false, message: "请选择 GitCode 或 GitHub" };
  if (!tok) return { ok: false, message: "请填写私人令牌" };
  const url = host === "github" ? "https://api.github.com/user" : "https://api.gitcode.com/api/v5/user";
  const res = await http(url, tok, { host });
  if (!res.ok) return { ok: false, message: errMsg(res, "登录失败，检查令牌权限") };
  const j = res.json as { login?: string; name?: string; username?: string };
  const login = String(j.login || j.username || "").trim();
  if (!login) return { ok: false, message: "登录成功但没有读到用户名" };
  return { ok: true, login, name: String(j.name || login), message: `已登录 ${login}` };
}

export async function listOwnRepos(
  hostRaw: string,
  token: string,
): Promise<{ ok: boolean; repos: GitRepo[]; message: string }> {
  const host = asHost(hostRaw);
  const tok = token.trim();
  if (!host) return { ok: false, repos: [], message: "请选择 GitCode 或 GitHub" };
  const url =
    host === "github"
      ? "https://api.github.com/user/repos?per_page=100&affiliation=owner&sort=updated"
      : "https://api.gitcode.com/api/v5/user/repos?affiliation=owner&per_page=100&sort=updated";
  const res = await http(url, tok, { host });
  if (!res.ok) return { ok: false, repos: [], message: errMsg(res, "读取仓库失败") };
  const rows = Array.isArray(res.json) ? res.json : [];
  const repos: GitRepo[] = [];
  for (const row of rows as Array<Record<string, unknown>>) {
    const full = String(row.full_name || "").trim();
    const html = String(row.html_url || "").trim();
    if (!full || !html) continue;
    const isPrivate = Boolean(row.private || row.internal);
    repos.push({
      fullName: full,
      url: html.replace(/\.git$/i, ""),
      description: String(row.description || ""),
      private: isPrivate,
      defaultBranch: String(row.default_branch || "main"),
    });
  }
  const pub = repos.filter((r) => !r.private);
  return {
    ok: true,
    repos: pub,
    message: pub.length ? `公开仓库 ${pub.length} 个` : "没有公开仓库。投稿的插件仓需要公开",
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFork(
  host: GitHost,
  token: string,
  login: string,
): Promise<{ ok: boolean; message: string }> {
  const hub = HUB[host];
  for (let i = 0; i < 8; i++) {
    const url =
      host === "github"
        ? `https://api.github.com/repos/${login}/${hub.repo}`
        : `https://api.gitcode.com/api/v5/repos/${login}/${hub.repo}`;
    const res = await http(url, token, { host });
    if (res.ok) return { ok: true, message: "" };
    await sleep(1500);
  }
  return { ok: false, message: "Fork 还没准备好，过一会儿再提交" };
}

async function ensureFork(host: GitHost, token: string, login: string): Promise<{ ok: boolean; message: string }> {
  const hub = HUB[host];
  const exists =
    host === "github"
      ? `https://api.github.com/repos/${login}/${hub.repo}`
      : `https://api.gitcode.com/api/v5/repos/${login}/${hub.repo}`;
  const got = await http(exists, token, { host });
  if (got.ok) return { ok: true, message: "" };
  const forkUrl =
    host === "github"
      ? `https://api.github.com/repos/${hub.owner}/${hub.repo}/forks`
      : `https://api.gitcode.com/api/v5/repos/${hub.owner}/${hub.repo}/forks`;
  const made = await http(forkUrl, token, { method: "POST", body: {}, host });
  if (!made.ok && made.status !== 202) {
    return { ok: false, message: errMsg(made, "Fork 生态仓失败，令牌需要仓库权限") };
  }
  return waitFork(host, token, login);
}

async function readCatalog(
  host: GitHost,
  token: string,
  owner: string,
  ref: string,
): Promise<{ ok: boolean; sha: string; json?: Record<string, unknown>; message: string }> {
  const hub = HUB[host];
  const url =
    host === "github"
      ? `https://api.github.com/repos/${owner}/${hub.repo}/contents/catalog.json?ref=${encodeURIComponent(ref)}`
      : `https://api.gitcode.com/api/v5/repos/${owner}/${hub.repo}/contents/catalog.json?ref=${encodeURIComponent(ref)}`;
  const res = await http(url, token, { host });
  if (!res.ok) return { ok: false, sha: "", message: errMsg(res, "读不到 catalog.json") };
  const j = res.json as { sha?: string; content?: string; encoding?: string };
  const sha = String(j.sha || "");
  let text = "";
  if (j.content) {
    text = Buffer.from(String(j.content).replace(/\n/g, ""), "base64").toString("utf8");
  }
  if (!text || !sha) return { ok: false, sha, message: "catalog.json 内容为空" };
  try {
    return { ok: true, sha, json: JSON.parse(text) as Record<string, unknown>, message: "" };
  } catch {
    return { ok: false, sha, message: "catalog.json 解析失败" };
  }
}

async function createBranch(
  host: GitHost,
  token: string,
  login: string,
  branch: string,
  base: string,
): Promise<{ ok: boolean; message: string }> {
  const hub = HUB[host];
  if (host === "github") {
    const refUrl = `https://api.github.com/repos/${login}/${hub.repo}/git/ref/heads/${encodeURIComponent(base)}`;
    const ref = await http(refUrl, token, { host });
    const sha = String((ref.json as { object?: { sha?: string } } | null)?.object?.sha || "");
    if (!ref.ok || !sha) return { ok: false, message: errMsg(ref, "读不到上游分支") };
    const made = await http(`https://api.github.com/repos/${login}/${hub.repo}/git/refs`, token, {
      method: "POST",
      host,
      body: { ref: `refs/heads/${branch}`, sha },
    });
    if (!made.ok) return { ok: false, message: errMsg(made, "创建分支失败") };
    return { ok: true, message: "" };
  }
  const made = await http(`https://api.gitcode.com/api/v5/repos/${login}/${hub.repo}/branches`, token, {
    method: "POST",
    host,
    body: { refs: base, branch_name: branch },
  });
  if (!made.ok) return { ok: false, message: errMsg(made, "创建分支失败") };
  return { ok: true, message: "" };
}

function buildEntry(input: {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  menus: string[];
  repoUrl: string;
  branch: string;
}) {
  return {
    id: input.id,
    name: input.name,
    kind: "pack",
    category: input.category,
    version: input.version,
    heat: 0,
    description: input.description,
    source: {
      type: "git",
      url: input.repoUrl.endsWith(".git") ? input.repoUrl : `${input.repoUrl}.git`,
      branch: input.branch || "main",
      path: "",
    },
    menus: input.menus,
    homepage: input.repoUrl.replace(/\.git$/i, ""),
  };
}

export async function submitEcosystemPr(
  hostRaw: string,
  token: string,
  input: {
    repoUrl?: string;
    branch?: string;
    id?: string;
    name?: string;
    description?: string;
    version?: string;
    category?: string;
    menus?: string[];
  },
): Promise<{ ok: boolean; message: string; prUrl?: string }> {
  const host = asHost(hostRaw);
  const tok = token.trim();
  if (!host) return { ok: false, message: "请选择 GitCode 或 GitHub" };
  const who = await loginGitAccount(host, tok);
  if (!who.ok || !who.login) return { ok: false, message: who.message };

  const id = String(input.id || "").trim();
  const name = String(input.name || "").trim();
  const description = String(input.description || "").trim();
  const version = String(input.version || "0.1.0").trim() || "0.1.0";
  const category = input.category === "template" ? "template" : "community";
  const repoUrl = String(input.repoUrl || "").trim().replace(/\.git$/i, "");
  const branch = String(input.branch || "main").trim() || "main";
  const menus = (input.menus || [])
    .map((m) => String(m || "").trim())
    .filter(Boolean)
    .map((m) => (m.startsWith("#") ? m : `#${m}`));

  if (!/^[a-z][a-z0-9.-]{1,48}$/.test(id) || id.startsWith("z.")) {
    return { ok: false, message: "id 用英文小写，不要用 z. 开头" };
  }
  if (!name) return { ok: false, message: "请填写中文名称" };
  if (!description) return { ok: false, message: "请填写简介" };
  if (!/^https:\/\/(github\.com|gitcode\.com)\//i.test(repoUrl)) {
    return { ok: false, message: "请选择自己的公开仓库" };
  }

  const hub = HUB[host];
  const upstream = await readCatalog(host, tok, hub.owner, "main");
  if (!upstream.ok || !upstream.json) return { ok: false, message: upstream.message };
  const entries = Array.isArray(upstream.json.entries) ? [...(upstream.json.entries as unknown[])] : [];
  if (entries.some((e) => String((e as { id?: string })?.id || "") === id)) {
    return { ok: false, message: `收录里已经有 ${id}` };
  }
  entries.push(
    buildEntry({ id, name, description, version, category, menus, repoUrl, branch }),
  );
  const next = { ...upstream.json, updatedAt: new Date().toISOString().slice(0, 10), entries };
  const content = Buffer.from(`${JSON.stringify(next, null, 2)}\n`, "utf8").toString("base64");

  const forked = await ensureFork(host, tok, who.login);
  if (!forked.ok) return forked;

  const forkCat = await readCatalog(host, tok, who.login, "main");
  const sha = forkCat.sha || upstream.sha;
  if (!sha) return { ok: false, message: forkCat.message || "Fork 上没有 catalog.json" };

  const br = `eco-${id.replace(/[^a-z0-9]+/g, "-").slice(0, 24)}-${Date.now().toString(36)}`;
  const branched = await createBranch(host, tok, who.login, br, "main");
  if (!branched.ok) return branched;

  const putUrl =
    host === "github"
      ? `https://api.github.com/repos/${who.login}/${hub.repo}/contents/catalog.json`
      : `https://api.gitcode.com/api/v5/repos/${who.login}/${hub.repo}/contents/catalog.json`;
  const put = await http(putUrl, tok, {
    method: "PUT",
    host,
    body: {
      message: `收录 ${name}`,
      content,
      sha,
      branch: br,
    },
  });
  if (!put.ok) return { ok: false, message: errMsg(put, "写入 catalog.json 失败") };

  const prUrl =
    host === "github"
      ? `https://api.github.com/repos/${hub.owner}/${hub.repo}/pulls`
      : `https://api.gitcode.com/api/v5/repos/${hub.owner}/${hub.repo}/pulls`;
  const head =
    host === "github" ? `${who.login}:${br}` : `${who.login}/${hub.repo}:${br}`;
  const prBody: Record<string, unknown> = {
    title: `收录 ${name}`,
    head,
    base: "main",
    body: [`投稿人：${who.login}`, `插件：${name}（${id}）`, `仓库：${repoUrl}`, description, "", "请审核后再合并。"].join(
      "\n",
    ),
  };
  if (host === "gitcode") prBody.fork_path = `${who.login}/${hub.repo}`;
  const pr = await http(prUrl, tok, { method: "POST", host, body: prBody });
  if (!pr.ok) return { ok: false, message: errMsg(pr, "提交 PR 失败") };
  const link = String((pr.json as { html_url?: string; web_url?: string } | null)?.html_url
    || (pr.json as { web_url?: string } | null)?.web_url
    || "");
  return {
    ok: true,
    prUrl: link,
    message: link ? `已提交审核：${link}` : "已提交审核，请到仓库查看 PR",
  };
}

export type ReviewItem = {
  title: string;
  url: string;
  user: string;
  host: GitHost;
};

export async function listOpenReviews(): Promise<{ ok: boolean; items: ReviewItem[]; message: string }> {
  const items: ReviewItem[] = [];
  try {
    const gh = await http(
      `https://api.github.com/repos/${HUB.github.owner}/${HUB.github.repo}/pulls?state=open&per_page=20`,
      "",
      { host: "github" },
    );
    if (gh.ok && Array.isArray(gh.json)) {
      for (const row of gh.json as Array<{ title?: string; html_url?: string; user?: { login?: string } }>) {
        if (!row.html_url) continue;
        items.push({
          title: String(row.title || "未命名"),
          url: row.html_url,
          user: String(row.user?.login || ""),
          host: "github",
        });
      }
    }
  } catch {
    /* 一边失败不挡另一边 */
  }
  try {
    const gc = await http(
      `https://api.gitcode.com/api/v5/repos/${HUB.gitcode.owner}/${HUB.gitcode.repo}/pulls?state=open&per_page=20`,
      "",
      { host: "gitcode" },
    );
    if (gc.ok && Array.isArray(gc.json)) {
      for (const row of gc.json as Array<{ title?: string; html_url?: string; web_url?: string; user?: { login?: string } }>) {
        const url = String(row.html_url || row.web_url || "");
        if (!url) continue;
        items.push({
          title: String(row.title || "未命名"),
          url,
          user: String(row.user?.login || ""),
          host: "gitcode",
        });
      }
    }
  } catch {
    /* 同上 */
  }
  return {
    ok: true,
    items,
    message: items.length ? `${items.length} 条待审核` : "没有待审核的投稿",
  };
}
