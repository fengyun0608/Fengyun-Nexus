/**
 * 生态专仓：读 catalog.json，列出收录，可把仓内 path 型包装进宿主 plugins/。
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { ensurePluginSdkLinks } from "./registry-check.js";

export type EcoSource =
  | { type: "path"; path: string }
  | { type: "git"; url: string; branch?: string; path?: string };

export type EcoCatalogEntry = {
  id: string;
  name: string;
  kind?: string;
  category?: string;
  version?: string;
  description?: string;
  source: EcoSource;
  menus?: string[];
  homepage?: string;
};

export type EcoCatalog = {
  version?: number;
  updatedAt?: string;
  hub?: { name?: string; gitcode?: string; github?: string; description?: string };
  categories?: Array<{ id: string; label: string }>;
  entries?: EcoCatalogEntry[];
};

export type EcoListItem = EcoCatalogEntry & {
  status: "not-installed" | "installed" | "update" | "unknown";
  localVersion?: string;
  message?: string;
  pluginDirs?: string[];
};

function sh(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 90_000,
    }).trim();
  } catch {
    return "";
  }
}

function ensureEcoRef(
  root: string,
  repoUrl: string,
  branch: string,
): { remoteRef: string; ok: boolean; error?: string } {
  const url = repoUrl.trim();
  if (!url) return { remoteRef: "", ok: false, error: "未配置生态专仓" };
  const out = sh(root, [
    "fetch",
    "--depth",
    "1",
    url,
    `${branch}:refs/nexus-eco-check/${branch}`,
  ]);
  // fetch 失败时 sh 返回空，再探一下 ref
  const tip = sh(root, ["rev-parse", "--verify", `refs/nexus-eco-check/${branch}`]);
  if (!tip) {
    return {
      remoteRef: "",
      ok: false,
      error: out || "拉取生态专仓失败（检查网络与仓库地址）",
    };
  }
  return { remoteRef: `refs/nexus-eco-check/${branch}`, ok: true };
}

function showFile(root: string, remoteRef: string, path: string): string {
  try {
    return execFileSync("git", ["show", `${remoteRef}:${path}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 20_000,
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch {
    return "";
  }
}

function readLocalPluginVersion(pluginsRoot: string, dir: string): string {
  const man = join(pluginsRoot, dir, "nexus.plugin.json");
  if (!existsSync(man)) return "";
  try {
    const j = JSON.parse(readFileSync(man, "utf8")) as { version?: string; id?: string };
    return String(j.version || "");
  } catch {
    return "";
  }
}

/** 从包的 nexus.pack.json 读出插件子目录名 */
function packPluginDirs(
  root: string,
  remoteRef: string,
  packRel: string,
): string[] {
  const raw = showFile(root, remoteRef, `${packRel.replace(/\/$/, "")}/nexus.pack.json`);
  if (!raw) return [];
  try {
    const j = JSON.parse(raw) as {
      plugins?: Array<{ dir?: string; id?: string }>;
    };
    return (j.plugins || [])
      .map((p) => {
        const d = String(p.dir || "").replace(/\\/g, "/");
        const base = d.split("/").pop() || "";
        return base;
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function cmpVer(a: string, b: string): number {
  const pa = a.split(/[.+-]/).map((x) => Number(x) || 0);
  const pb = b.split(/[.+-]/).map((x) => Number(x) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

export function loadEcosystemCatalog(
  root: string,
  opts?: { ecosystemRepoUrl?: string; ecosystemRepoBranch?: string },
): {
  ok: boolean;
  catalog?: EcoCatalog;
  items: EcoListItem[];
  source: string;
  message: string;
} {
  const url = String(opts?.ecosystemRepoUrl || "").trim();
  const branch = opts?.ecosystemRepoBranch || "main";
  if (!url) {
    return { ok: false, items: [], source: "", message: "未配置生态专仓" };
  }
  const { remoteRef, ok, error } = ensureEcoRef(root, url, branch);
  if (!ok || !remoteRef) {
    return { ok: false, items: [], source: url, message: error || "拉取失败" };
  }
  const raw = showFile(root, remoteRef, "catalog.json");
  if (!raw) {
    return { ok: false, items: [], source: url, message: "专仓没有 catalog.json" };
  }
  let catalog: EcoCatalog;
  try {
    catalog = JSON.parse(raw) as EcoCatalog;
  } catch {
    return { ok: false, items: [], source: url, message: "catalog.json 解析失败" };
  }
  const pluginsRoot = join(root, "plugins");
  const items: EcoListItem[] = [];
  for (const e of catalog.entries || []) {
    if (!e?.id) continue;
    const src = e.source;
    if (!src || (src.type !== "path" && src.type !== "git")) {
      items.push({ ...e, status: "unknown", message: "不支持的 source" });
      continue;
    }
    if (src.type === "git") {
      items.push({
        ...e,
        status: "unknown",
        message: "社区 git 包：请按投稿说明自行克隆，宿主稍后支持一键装",
      });
      continue;
    }
    const packRel = String(src.path || "").replace(/^\/+|\/+$/g, "");
    const dirs = packPluginDirs(root, remoteRef, packRel);
    if (!dirs.length) {
      items.push({ ...e, status: "unknown", message: "包内没有 plugins 登记", pluginDirs: [] });
      continue;
    }
    const localVers = dirs.map((d) => readLocalPluginVersion(pluginsRoot, d)).filter(Boolean);
    const installed = dirs.every((d) => existsSync(join(pluginsRoot, d, "nexus.plugin.json")));
    const remoteVer = String(e.version || "");
    let status: EcoListItem["status"] = "not-installed";
    let message = "未安装";
    let localVersion: string | undefined;
    if (installed) {
      localVersion = localVers[0] || remoteVer;
      if (remoteVer && localVers.some((v) => cmpVer(remoteVer, v) > 0)) {
        status = "update";
        message = `可更新 ${localVersion} → ${remoteVer}`;
      } else {
        status = "installed";
        message = "已安装";
      }
    }
    items.push({
      ...e,
      status,
      localVersion,
      message,
      pluginDirs: dirs,
    });
  }
  const hub = url.replace(/\.git$/i, "");
  return {
    ok: true,
    catalog,
    items,
    source: hub,
    message: `生态收录 ${items.length} 条`,
  };
}

export function installEcosystemPack(
  root: string,
  packId: string,
  opts?: { ecosystemRepoUrl?: string; ecosystemRepoBranch?: string },
): { ok: boolean; message: string; applied: string[] } {
  const listed = loadEcosystemCatalog(root, opts);
  if (!listed.ok || !listed.catalog) {
    return { ok: false, message: listed.message, applied: [] };
  }
  const entry = (listed.catalog.entries || []).find((e) => e.id === packId);
  if (!entry) return { ok: false, message: `收录里没有 ${packId}`, applied: [] };
  if (entry.source?.type !== "path") {
    return { ok: false, message: "目前只支持专仓内 path 型包一键安装", applied: [] };
  }
  const url = String(opts?.ecosystemRepoUrl || "").trim();
  const branch = opts?.ecosystemRepoBranch || "main";
  const { remoteRef, ok, error } = ensureEcoRef(root, url, branch);
  if (!ok || !remoteRef) return { ok: false, message: error || "拉取失败", applied: [] };

  const packRel = String(entry.source.path || "").replace(/^\/+|\/+$/g, "");
  const dirs = packPluginDirs(root, remoteRef, packRel);
  if (!dirs.length) return { ok: false, message: "包内无插件目录", applied: [] };

  const applied: string[] = [];
  for (const dir of dirs) {
    const remoteRel = `${packRel}/plugins/${dir}`;
    const list = sh(root, ["ls-tree", "-r", "--name-only", remoteRef, "--", remoteRel]);
    if (!list) continue;
    const dest = join(root, "plugins", dir);
    if (existsSync(dest)) {
      for (const name of readdirSync(dest)) {
        if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
        if (name === "package.json") continue;
        rmSync(join(dest, name), { recursive: true, force: true });
      }
    } else {
      mkdirSync(dest, { recursive: true });
    }
    for (const remotePath of list.split("\n").filter(Boolean)) {
      const norm = remotePath.replace(/\\/g, "/");
      const prefix = `${remoteRel}/`;
      if (!norm.startsWith(prefix) && norm !== remoteRel) continue;
      const relInside = norm === remoteRel ? "" : norm.slice(prefix.length);
      if (!relInside || relInside.includes("node_modules")) continue;
      const outPath = join(dest, relInside);
      mkdirSync(dirname(outPath), { recursive: true });
      try {
        const buf = execFileSync("git", ["show", `${remoteRef}:${norm}`], {
          cwd: root,
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 20_000,
          maxBuffer: 8 * 1024 * 1024,
        }) as Buffer;
        writeFileSync(outPath, buf);
      } catch {
        /* 单个文件跳过 */
      }
    }
    applied.push(dir);
  }
  if (applied.length) ensurePluginSdkLinks(root, applied);
  return {
    ok: applied.length > 0,
    message: applied.length
      ? `已安装 ${entry.name || packId}：${applied.join("、")}`
      : "没有写出任何插件文件",
    applied,
  };
}
