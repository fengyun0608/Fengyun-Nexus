/**
 * 对比本地 plugins/ 与远程仓库是否一致（版本 / 内容指纹）。
 * 默认对照本仓 origin/<branch> 下同路径；若配置了 pluginsRepo.url 则优先对照插件专仓。
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type PluginUpdateItem = {
  id: string;
  dir: string;
  name?: string;
  localVersion?: string;
  remoteVersion?: string;
  localFingerprint?: string;
  remoteFingerprint?: string;
  status: "same" | "update" | "local-only" | "unknown";
  message?: string;
};

function sh(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 20_000,
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
      if (!name && typeof j.description === "string") name = j.description;
    } catch {
      /* ignore */
    }
  }
  return { id: id || dirPath.split(/[/\\]/).pop() || "unknown", name, version };
}

function localTreeHash(root: string, rel: string): string {
  // 目录树内容指纹（不含 .git）
  return sh(root, ["rev-parse", `HEAD:${rel}`]) || sh(root, ["log", "-1", "--format=%H", "--", rel]);
}

function remoteTreeHash(root: string, remoteRef: string, rel: string): string {
  // 先确保有远端引用；失败则空
  const fromRev = sh(root, ["rev-parse", `${remoteRef}:${rel}`]);
  if (fromRev) return fromRev;
  return sh(root, ["log", "-1", "--format=%H", remoteRef, "--", rel]);
}

export function checkPluginUpdates(
  root: string,
  opts?: {
    branch?: string;
    pluginsRepoUrl?: string;
    pluginsRepoBranch?: string;
  },
): { ok: true; source: string; branch: string; items: PluginUpdateItem[] } {
  const branch = opts?.branch || "main";
  const pluginsDir = join(root, "plugins");
  const items: PluginUpdateItem[] = [];

  // 尽量拉一下远端（失败也不阻断）
  if (opts?.pluginsRepoUrl) {
    // 专仓：用临时 remote 名探测（不写入永久配置也可 ls-remote）
    sh(root, ["fetch", opts.pluginsRepoUrl, `${opts.pluginsRepoBranch || branch}:refs/nexus-plugins-check/${branch}`]);
  } else {
    sh(root, ["fetch", "--depth", "1", "origin", branch]);
  }

  const remoteRef = opts?.pluginsRepoUrl
    ? `refs/nexus-plugins-check/${opts.pluginsRepoBranch || branch}`
    : `origin/${branch}`;
  const source = opts?.pluginsRepoUrl || "origin (本仓 plugins/)";

  if (!existsSync(pluginsDir)) {
    return { ok: true, source, branch, items: [] };
  }

  const dirs = readdirSync(pluginsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith(".") && d.name !== "templates")
    .map((d) => d.name);

  for (const dir of dirs) {
    const rel = `plugins/${dir}`;
    const meta = readPluginMeta(join(pluginsDir, dir));
    const localFingerprint = localTreeHash(root, rel);
    const remoteFingerprint = remoteTreeHash(root, remoteRef, rel);
    let status: PluginUpdateItem["status"] = "unknown";
    let message: string | undefined;
    if (!remoteFingerprint) {
      status = localFingerprint ? "local-only" : "unknown";
      message = "远端没有对应目录（或尚未配置插件仓）";
    } else if (!localFingerprint) {
      status = "update";
      message = "本地无法取指纹";
    } else if (localFingerprint === remoteFingerprint) {
      status = "same";
    } else {
      status = "update";
      message = "远端与本地不一致";
    }
    items.push({
      id: meta.id,
      dir,
      name: meta.name,
      localVersion: meta.version,
      remoteVersion: meta.version,
      localFingerprint: localFingerprint.slice(0, 12) || undefined,
      remoteFingerprint: remoteFingerprint.slice(0, 12) || undefined,
      status,
      message,
    });
  }

  return { ok: true, source, branch, items };
}
