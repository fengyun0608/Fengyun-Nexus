/**
 * 对比本地 plugins/ 与远程仓库是否一致（内容指纹）。
 * 默认对照本仓 origin/<branch>；若配置了 pluginsRepo.url 则对照插件专仓，
 * 且只比对远端有的目录（避免通道插件全被标成「仅本地」）。
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

export type PluginUpdateItem = {
  id: string;
  dir: string;
  name?: string;
  localVersion?: string;
  remoteVersion?: string;
  /** 对照仓库地址 */
  repoUrl?: string;
  localFingerprint?: string;
  remoteFingerprint?: string;
  status: "same" | "update" | "local-only" | "remote-only" | "unknown";
  message?: string;
};

function sh(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000,
    }).trim();
  } catch {
    return "";
  }
}

function readPluginMeta(dirPath: string): { id: string; name?: string; version?: string } {
  const pkgPath = join(dirPath, "package.json");
  const manPath = join(dirPath, "nexus.plugin.json");
  let id = "";
  let name: string | undefined;
  let version: string | undefined;
  if (existsSync(manPath)) {
    try {
      const j = JSON.parse(readFileSync(manPath, "utf8")) as Record<string, unknown>;
      id = String(j.id || "");
      name = typeof j.name === "string" ? j.name : undefined;
      version = typeof j.version === "string" ? j.version : undefined;
    } catch {
      /* ignore */
    }
  }
  if (existsSync(pkgPath)) {
    try {
      const j = JSON.parse(readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
      if (!id) id = String(j.name || "").replace(/^@[^/]+\//, "") || "";
      if (!version && typeof j.version === "string") version = j.version;
      if (!name && typeof j.name === "string" && !String(j.name).startsWith("@")) name = j.name;
    } catch {
      /* ignore */
    }
  }
  return { id: id || dirPath.split(/[/\\]/).pop() || "unknown", name, version };
}

function shouldSkipName(name: string): boolean {
  return (
    name === "node_modules" ||
    name === "dist" ||
    name === ".git" ||
    name.startsWith(".")
  );
}

/** 比对时忽略：依赖清单 / monorepo 兼容再导出，避免每次 #更新都误判要重启 */
function shouldSkipFile(relPath: string): boolean {
  const n = relPath.replace(/\\/g, "/").split("/").pop() || "";
  if (
    n === "package.json" ||
    n === "package-lock.json" ||
    n === "pnpm-lock.yaml" ||
    n === "yarn.lock" ||
    n === "screenshot.ts" ||
    n === "screenshot.js"
  ) {
    return true;
  }
  return false;
}

function hashText(buf: Buffer | string): string {
  const text = (Buffer.isBuffer(buf) ? buf.toString("utf8") : String(buf)).replace(
    /\r\n/g,
    "\n",
  );
  return createHash("sha256").update(text).digest("hex");
}

/** 工作区目录内容指纹（与仓无关，同内容同 hash） */
function localContentFingerprint(absDir: string): string {
  if (!existsSync(absDir)) return "";
  const lines: string[] = [];
  function walk(dir: string, prefix: string) {
    let names: string[];
    try {
      names = readdirSync(dir).sort();
    } catch {
      return;
    }
    for (const name of names) {
      if (shouldSkipName(name)) continue;
      const p = join(dir, name);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      const rel = prefix ? `${prefix}/${name}` : name;
      if (st.isDirectory()) walk(p, rel);
      else {
        if (shouldSkipFile(rel)) continue;
        try {
          const h = hashText(readFileSync(p));
          lines.push(`${rel.replace(/\\/g, "/")}\0${h}`);
        } catch {
          /* skip */
        }
      }
    }
  }
  walk(absDir, "");
  if (!lines.length) return "";
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

/** 远端某目录内容指纹（文件内容 sha256，与本地一致） */
function remoteContentFingerprint(
  root: string,
  remoteRef: string,
  rel: string,
): string {
  const out = sh(root, ["ls-tree", "-r", remoteRef, "--", rel]);
  if (!out) return "";
  const lines: string[] = [];
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const m = line.match(/^\S+\s+blob\s+[0-9a-f]+\t(.+)$/i);
    if (!m) continue;
    const path = m[1].replace(/\\/g, "/");
    if (path.includes("/node_modules/") || path.includes("/dist/")) continue;
    const relPath = path.startsWith(`${rel}/`) ? path.slice(rel.length + 1) : path;
    if (shouldSkipFile(relPath)) continue;
    let buf: Buffer;
    try {
      buf = execFileSync("git", ["show", `${remoteRef}:${path}`], {
        cwd: root,
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 20_000,
        maxBuffer: 8 * 1024 * 1024,
      }) as Buffer;
    } catch {
      continue;
    }
    const h = hashText(buf);
    lines.push(`${relPath}\0${h}`);
  }
  if (!lines.length) return "";
  lines.sort();
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

function listRemotePluginDirs(root: string, remoteRef: string): string[] {
  // 专仓结构：plugins/z-menu …；也兼容根下直接放插件目录
  const underPlugins = sh(root, ["ls-tree", "--name-only", `${remoteRef}:plugins`]);
  if (underPlugins) {
    return underPlugins
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((n) => !shouldSkipName(n) && n !== "templates");
  }
  const top = sh(root, ["ls-tree", "--name-only", remoteRef]);
  return top
    .split("\n")
    .map((s) => s.trim())
    .filter((n) => n.startsWith("z-") || n.startsWith("plugin"));
}

function remotePathPrefix(root: string, remoteRef: string): "plugins" | "" {
  const underPlugins = sh(root, ["ls-tree", "--name-only", `${remoteRef}:plugins`]);
  return underPlugins ? "plugins" : "";
}

function ensureRemoteRef(
  root: string,
  opts?: { branch?: string; pluginsRepoUrl?: string; pluginsRepoBranch?: string },
): { remoteRef: string; source: string; branch: string } {
  const branch = opts?.pluginsRepoBranch || opts?.branch || "main";
  if (opts?.pluginsRepoUrl) {
    sh(root, [
      "fetch",
      "--depth",
      "1",
      opts.pluginsRepoUrl,
      `${branch}:refs/nexus-plugins-check/${branch}`,
    ]);
    return {
      remoteRef: `refs/nexus-plugins-check/${branch}`,
      source: opts.pluginsRepoUrl,
      branch,
    };
  }
  sh(root, ["fetch", "--depth", "1", "origin", branch]);
  return {
    remoteRef: `origin/${branch}`,
    source: "origin (本仓 plugins/)",
    branch,
  };
}

export function checkPluginUpdates(
  root: string,
  opts?: {
    branch?: string;
    pluginsRepoUrl?: string;
    pluginsRepoBranch?: string;
  },
): { ok: true; source: string; branch: string; items: PluginUpdateItem[] } {
  const pluginsDir = join(root, "plugins");
  const items: PluginUpdateItem[] = [];
  const { remoteRef, source, branch } = ensureRemoteRef(root, opts);

  if (!existsSync(pluginsDir)) {
    return { ok: true, source, branch, items: [] };
  }

  const dedicated = Boolean(opts?.pluginsRepoUrl);
  const prefix = remotePathPrefix(root, remoteRef);
  const remoteDirs = dedicated ? listRemotePluginDirs(root, remoteRef) : [];

  const localDirs = readdirSync(pluginsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !shouldSkipName(d.name) && d.name !== "templates")
    .map((d) => d.name);

  // 专仓：只比对远端有的目录；本仓：比对本地全部插件目录
  const checkSet = dedicated ? remoteDirs : localDirs;

  for (const dir of checkSet) {
    const localRel = `plugins/${dir}`;
    const remoteRel = prefix ? `${prefix}/${dir}` : dir;
    const absLocal = join(pluginsDir, dir);
    const meta = existsSync(absLocal)
      ? readPluginMeta(absLocal)
      : { id: dir, name: undefined, version: undefined };
    const localFingerprint = localContentFingerprint(absLocal);
    const remoteFingerprint = remoteContentFingerprint(root, remoteRef, remoteRel);

    let remoteVersion = meta.version;
    const manBlob = sh(root, ["show", `${remoteRef}:${remoteRel}/nexus.plugin.json`]);
    if (manBlob) {
      try {
        const j = JSON.parse(manBlob) as { version?: string; name?: string; id?: string };
        if (j.version) remoteVersion = j.version;
        if (!meta.name && j.name) meta.name = j.name;
        if (j.id) meta.id = j.id;
      } catch {
        /* ignore */
      }
    }

    let status: PluginUpdateItem["status"] = "unknown";
    let message: string | undefined;

    if (!remoteFingerprint && !localFingerprint) {
      status = "unknown";
      message = "两端都取不到内容";
    } else if (!remoteFingerprint) {
      status = "local-only";
      message = "远端没有对应目录";
    } else if (!localFingerprint) {
      status = "remote-only";
      message = "本地没有，可拉取";
    } else if (localFingerprint === remoteFingerprint) {
      status = "same";
      message = "无更新";
    } else {
      status = "update";
      message =
        meta.version && remoteVersion && meta.version !== remoteVersion
          ? `有更新 ${meta.version} → ${remoteVersion}`
          : "有更新";
    }

    items.push({
      id: meta.id,
      dir,
      name: meta.name,
      localVersion: meta.version,
      remoteVersion,
      repoUrl: source.replace(/\.git$/i, ""),
      localFingerprint: localFingerprint || undefined,
      remoteFingerprint: remoteFingerprint || undefined,
      status,
      message,
    });
  }

  return { ok: true, source, branch, items };
}

export function applyPluginUpdates(
  root: string,
  opts?: {
    branch?: string;
    pluginsRepoUrl?: string;
    pluginsRepoBranch?: string;
    /** 只拉这些目录；空则拉所有 update / remote-only */
    dirs?: string[];
  },
): {
  ok: boolean;
  applied: string[];
  failed: Array<{ dir: string; error: string }>;
  message: string;
  source: string;
} {
  const check = checkPluginUpdates(root, opts);
  const want = new Set(
    (opts?.dirs?.length
      ? opts.dirs
      : check.items.filter((i) => i.status === "update" || i.status === "remote-only").map((i) => i.dir)
    ).map((d) => d),
  );

  if (!want.size) {
    return {
      ok: true,
      applied: [],
      failed: [],
      message: "没有需要拉取的插件",
      source: check.source,
    };
  }

  const { remoteRef, source } = ensureRemoteRef(root, opts);
  const prefix = remotePathPrefix(root, remoteRef);
  const applied: string[] = [];
  const failed: Array<{ dir: string; error: string }> = [];

  for (const dir of want) {
    const remoteRel = prefix ? `${prefix}/${dir}` : dir;
    const dest = join(root, "plugins", dir);
    try {
      // 从远端 ref 导出文件到本地 plugins/<dir>
      const list = sh(root, ["ls-tree", "-r", "--name-only", remoteRef, "--", remoteRel]);
      if (!list) {
        failed.push({ dir, error: "远端无此目录" });
        continue;
      }
      if (existsSync(dest)) {
        // 清掉旧源码，保留 node_modules / package.json / screenshot 兼容层
        for (const name of readdirSync(dest)) {
          if (shouldSkipName(name)) continue;
          if (shouldSkipFile(name)) continue;
          rmSync(join(dest, name), { recursive: true, force: true });
        }
      } else {
        mkdirSync(dest, { recursive: true });
      }
      let wrote = false;
      for (const remotePath of list.split("\n").filter(Boolean)) {
        const norm = remotePath.replace(/\\/g, "/");
        if (norm.includes("/node_modules/") || norm.includes("/dist/")) continue;
        const relInside = norm.startsWith(`${remoteRel}/`)
          ? norm.slice(remoteRel.length + 1)
          : relative(remoteRel, norm);
        if (!relInside || relInside.startsWith("..")) continue;
        // 不覆盖本地 package.json / screenshot（比对也不看它们）
        if (shouldSkipFile(relInside)) continue;
        const outPath = join(dest, relInside);
        mkdirSync(dirname(outPath), { recursive: true });
        const buf = execFileSync("git", ["show", `${remoteRef}:${norm}`], {
          cwd: root,
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 20_000,
          maxBuffer: 8 * 1024 * 1024,
        }) as Buffer;
        writeFileSync(outPath, buf);
        wrote = true;
      }
      if (wrote) applied.push(dir);
      else failed.push({ dir, error: "远端无可同步源码" });
    } catch (e) {
      failed.push({ dir, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const message =
    applied.length > 0
      ? `已拉取 ${applied.length} 个插件：${applied.join("、")}${
          failed.length ? `；失败 ${failed.length}` : ""
        }`
      : failed.length
        ? `拉取失败：${failed.map((f) => f.dir).join("、")}`
        : "没有写入任何插件";

  return {
    ok: failed.length === 0,
    applied,
    failed,
    message,
    source,
  };
}
