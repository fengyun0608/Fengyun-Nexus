/**
 * 生态专仓：读 catalog.json，列出收录，把 path / git 包装进宿主 plugins/。
 * 本地 zip 上传只装进本机，不登记到生态仓。
 */
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
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
  /** 给人看的仓库地址（无 .git） */
  repoUrl?: string;
  /** 包在仓内的相对路径；git 根目录则为空 */
  packPath?: string;
  downloadable?: boolean;
};

type PackPlugin = { rel: string; name: string };

const DIR_OK = /^[A-Za-z0-9._-]+$/;

function git(cwd: string, args: string[], timeout = 90_000): { ok: boolean; out: string } {
  try {
    const out = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout,
      maxBuffer: 8 * 1024 * 1024,
    });
    return { ok: true, out: String(out || "").trim() };
  } catch (e) {
    const err = e as { stderr?: Buffer | string; stdout?: Buffer | string; message?: string };
    const msg = String(err.stderr || err.stdout || err.message || "").trim();
    return { ok: false, out: msg };
  }
}

function gitBuf(cwd: string, args: string[]): Buffer | null {
  try {
    return execFileSync("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 20_000,
      maxBuffer: 8 * 1024 * 1024,
    }) as Buffer;
  } catch {
    return null;
  }
}

function refNameFor(url: string): string {
  return `g${createHash("sha1").update(url).digest("hex").slice(0, 12)}`;
}

function stripGit(url: string): string {
  return url.trim().replace(/\.git$/i, "");
}

function ensureRemoteRef(
  root: string,
  repoUrl: string,
  branch: string,
  refName: string,
): { remoteRef: string; ok: boolean; error?: string } {
  const url = repoUrl.trim();
  if (!url) return { remoteRef: "", ok: false, error: "仓库地址为空" };
  const remoteRef = `refs/nexus-eco/${refName}`;
  const fetched = git(root, ["fetch", "--depth", "1", url, `+${branch}:${remoteRef}`]);
  const tip = git(root, ["rev-parse", "--verify", remoteRef]);
  if (!fetched.ok || !tip.ok) {
    const raw = fetched.out || tip.out || "拉取失败";
    const friendly = /unable to access|could not resolve|timed out|connection/i.test(raw)
      ? "拉取仓库失败，检查网络或地址"
      : raw.split("\n").slice(-3).join(" ").slice(0, 240) || "拉取仓库失败";
    return { remoteRef: "", ok: false, error: friendly };
  }
  return { remoteRef, ok: true };
}

function showText(root: string, remoteRef: string, path: string): string {
  const buf = gitBuf(root, ["show", `${remoteRef}:${path}`]);
  return buf ? buf.toString("utf8") : "";
}

function readPackPlugins(raw: string): PackPlugin[] {
  try {
    const j = JSON.parse(raw) as { plugins?: Array<{ dir?: string }> };
    const out: PackPlugin[] = [];
    for (const p of j.plugins || []) {
      const rel = String(p.dir || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
      const name = rel.split("/").filter(Boolean).pop() || "";
      if (!rel || rel.includes("..") || !DIR_OK.test(name)) continue;
      out.push({ rel, name });
    }
    return out;
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

function readLocalPluginVersion(pluginsRoot: string, dir: string): string {
  const man = join(pluginsRoot, dir, "nexus.plugin.json");
  if (!existsSync(man)) return "";
  try {
    const j = JSON.parse(readFileSync(man, "utf8")) as { version?: string };
    return String(j.version || "");
  } catch {
    return "";
  }
}

function inside(parent: string, child: string): boolean {
  const rel = relative(resolve(parent), resolve(child));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function resetPluginDir(dest: string) {
  if (existsSync(dest)) {
    for (const name of readdirSync(dest)) {
      if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
      rmSync(join(dest, name), { recursive: true, force: true });
    }
  } else {
    mkdirSync(dest, { recursive: true });
  }
}

function materialize(
  root: string,
  remoteRef: string,
  packRel: string,
  plugins: PackPlugin[],
): string[] {
  const applied: string[] = [];
  for (const plug of plugins) {
    const remoteDir = [packRel, plug.rel].filter(Boolean).join("/").replace(/\/+/g, "/");
    const listed = git(root, ["ls-tree", "-r", "--name-only", remoteRef, "--", remoteDir]);
    if (!listed.ok || !listed.out) continue;
    const dest = join(root, "plugins", plug.name);
    resetPluginDir(dest);
    let wrote = 0;
    for (const remotePath of listed.out.split("\n").filter(Boolean)) {
      const norm = remotePath.replace(/\\/g, "/");
      const prefix = `${remoteDir}/`;
      if (!norm.startsWith(prefix)) continue;
      const relInside = norm.slice(prefix.length);
      if (!relInside || relInside.includes("..") || relInside.includes("node_modules")) continue;
      const outPath = join(dest, relInside);
      if (!inside(dest, outPath)) continue;
      mkdirSync(join(outPath, ".."), { recursive: true });
      const buf = gitBuf(root, ["show", `${remoteRef}:${norm}`]);
      if (!buf) continue;
      writeFileSync(outPath, buf);
      wrote += 1;
    }
    if (wrote > 0 && existsSync(join(dest, "nexus.plugin.json"))) applied.push(plug.name);
  }
  if (applied.length) ensurePluginSdkLinks(root, applied);
  return applied;
}

function statusOf(
  pluginsRoot: string,
  names: string[],
  remoteVer: string,
): Pick<EcoListItem, "status" | "message" | "localVersion" | "pluginDirs"> {
  if (!names.length) {
    return { status: "unknown", message: "包内没有插件登记", pluginDirs: [] };
  }
  const localVers = names.map((d) => readLocalPluginVersion(pluginsRoot, d));
  const installed = names.every((d) => existsSync(join(pluginsRoot, d, "nexus.plugin.json")));
  if (!installed) {
    return { status: "not-installed", message: "未安装", pluginDirs: names };
  }
  const localVersion = localVers.find(Boolean) || remoteVer;
  if (remoteVer && localVers.some((v) => v && cmpVer(remoteVer, v) > 0)) {
    return {
      status: "update",
      message: `可更新 ${localVersion} → ${remoteVer}`,
      localVersion,
      pluginDirs: names,
    };
  }
  return { status: "installed", message: "已安装", localVersion, pluginDirs: names };
}

function repoOf(entry: EcoCatalogEntry, hubUrl: string): { repoUrl: string; packPath: string } {
  const src = entry.source;
  if (src?.type === "git") {
    return {
      repoUrl: stripGit(String(src.url || "")),
      packPath: String(src.path || "").replace(/^\/+|\/+$/g, ""),
    };
  }
  return {
    repoUrl: stripGit(hubUrl),
    packPath: String(src?.type === "path" ? src.path : "").replace(/^\/+|\/+$/g, ""),
  };
}

function pluginsInRef(root: string, remoteRef: string, packRel: string): PackPlugin[] {
  const packFile = [packRel, "nexus.pack.json"].filter(Boolean).join("/");
  const raw = showText(root, remoteRef, packFile);
  return raw ? readPackPlugins(raw) : [];
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
  if (!url) return { ok: false, items: [], source: "", message: "未配置生态专仓" };
  const hub = ensureRemoteRef(root, url, branch, "hub");
  if (!hub.ok || !hub.remoteRef) {
    return { ok: false, items: [], source: stripGit(url), message: hub.error || "拉取失败" };
  }
  const raw = showText(root, hub.remoteRef, "catalog.json");
  if (!raw) return { ok: false, items: [], source: stripGit(url), message: "专仓没有 catalog.json" };
  let catalog: EcoCatalog;
  try {
    catalog = JSON.parse(raw) as EcoCatalog;
  } catch {
    return { ok: false, items: [], source: stripGit(url), message: "catalog.json 解析失败" };
  }
  const pluginsRoot = join(root, "plugins");
  const hubUrl = stripGit(url);
  const items: EcoListItem[] = [];
  for (const e of catalog.entries || []) {
    if (!e?.id) continue;
    const src = e.source;
    const { repoUrl, packPath } = repoOf(e, hubUrl);
    const base = { ...e, repoUrl, packPath, downloadable: src?.type === "path" || src?.type === "git" };
    if (!src || (src.type !== "path" && src.type !== "git")) {
      items.push({ ...base, status: "unknown", message: "不支持的来源", downloadable: false });
      continue;
    }
    let remoteRef = hub.remoteRef;
    let packRel = packPath;
    if (src.type === "git") {
      const gitUrl = String(src.url || "").trim();
      if (!gitUrl) {
        items.push({ ...base, status: "unknown", message: "缺少仓库地址", downloadable: false });
        continue;
      }
      const got = ensureRemoteRef(root, gitUrl, src.branch || "main", refNameFor(gitUrl));
      if (!got.ok || !got.remoteRef) {
        items.push({ ...base, status: "unknown", message: got.error || "拉取该仓库失败" });
        continue;
      }
      remoteRef = got.remoteRef;
      packRel = String(src.path || "").replace(/^\/+|\/+$/g, "");
    }
    const plugs = pluginsInRef(root, remoteRef, packRel);
    const st = statusOf(pluginsRoot, plugs.map((p) => p.name), String(e.version || ""));
    items.push({ ...base, ...st });
  }
  return {
    ok: true,
    catalog,
    items,
    source: hubUrl,
    message: `生态收录 ${items.length} 条`,
  };
}

export function installEcosystemPack(
  root: string,
  packId: string,
  opts?: { ecosystemRepoUrl?: string; ecosystemRepoBranch?: string },
): { ok: boolean; message: string; applied: string[] } {
  const url = String(opts?.ecosystemRepoUrl || "").trim();
  const branch = opts?.ecosystemRepoBranch || "main";
  const hub = ensureRemoteRef(root, url, branch, "hub");
  if (!hub.ok || !hub.remoteRef) return { ok: false, message: hub.error || "拉取失败", applied: [] };
  const raw = showText(root, hub.remoteRef, "catalog.json");
  if (!raw) return { ok: false, message: "专仓没有 catalog.json", applied: [] };
  let catalog: EcoCatalog;
  try {
    catalog = JSON.parse(raw) as EcoCatalog;
  } catch {
    return { ok: false, message: "catalog.json 解析失败", applied: [] };
  }
  const entry = (catalog.entries || []).find((e) => e.id === packId);
  if (!entry) return { ok: false, message: `收录里没有 ${packId}`, applied: [] };
  const src = entry.source;
  if (!src || (src.type !== "path" && src.type !== "git")) {
    return { ok: false, message: "这条收录不能下载", applied: [] };
  }
  let remoteRef = hub.remoteRef;
  let packRel = src.type === "path" ? String(src.path || "").replace(/^\/+|\/+$/g, "") : "";
  if (src.type === "git") {
    const gitUrl = String(src.url || "").trim();
    if (!gitUrl) return { ok: false, message: "缺少仓库地址", applied: [] };
    const got = ensureRemoteRef(root, gitUrl, src.branch || "main", refNameFor(gitUrl));
    if (!got.ok || !got.remoteRef) return { ok: false, message: got.error || "拉取该仓库失败", applied: [] };
    remoteRef = got.remoteRef;
    packRel = String(src.path || "").replace(/^\/+|\/+$/g, "");
  }
  const plugs = pluginsInRef(root, remoteRef, packRel);
  if (!plugs.length) return { ok: false, message: "包内没有 plugins 登记", applied: [] };
  const applied = materialize(root, remoteRef, packRel, plugs);
  return {
    ok: applied.length > 0,
    message: applied.length
      ? `已下载 ${entry.name || packId}：${applied.join("、")}`
      : "没有写出任何插件文件",
    applied,
  };
}

function skipName(name: string): boolean {
  return name === "node_modules" || name === ".git" || name === "dist" || name.startsWith(".") || name === "__MACOSX";
}

function findNamed(dir: string, fileName: string, depth: number, out: string[]) {
  if (depth < 0 || !existsSync(dir)) return;
  const hit = join(dir, fileName);
  if (existsSync(hit) && statSync(hit).isFile()) out.push(hit);
  let names: string[] = [];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (skipName(name)) continue;
    const p = join(dir, name);
    try {
      if (statSync(p).isDirectory()) findNamed(p, fileName, depth - 1, out);
    } catch {
      /* skip */
    }
  }
}

function placeLocalPlugin(root: string, srcDir: string, name: string): boolean {
  if (!DIR_OK.test(name) || !existsSync(join(srcDir, "nexus.plugin.json"))) return false;
  const dest = join(root, "plugins", name);
  if (!inside(join(root, "plugins"), dest)) return false;
  resetPluginDir(dest);
  cpSync(srcDir, dest, {
    recursive: true,
    filter: (from) => {
      const n = from.replace(/\\/g, "/");
      return !n.includes("/node_modules") && !n.includes("/.git") && !n.includes("/__MACOSX");
    },
  });
  return existsSync(join(dest, "nexus.plugin.json"));
}

function installFromLocalTree(root: string, scan: string): string[] {
  const packs: string[] = [];
  findNamed(scan, "nexus.pack.json", 4, packs);
  const applied: string[] = [];
  if (packs.length) {
    for (const packFile of packs) {
      const packRoot = join(packFile, "..");
      let plugs: PackPlugin[] = [];
      try {
        plugs = readPackPlugins(readFileSync(packFile, "utf8"));
      } catch {
        continue;
      }
      for (const plug of plugs) {
        const srcDir = join(packRoot, plug.rel);
        if (!inside(packRoot, srcDir)) continue;
        if (placeLocalPlugin(root, srcDir, plug.name)) applied.push(plug.name);
      }
    }
    return [...new Set(applied)];
  }
  const mans: string[] = [];
  findNamed(scan, "nexus.plugin.json", 4, mans);
  for (const man of mans) {
    const srcDir = join(man, "..");
    const name = srcDir.split(/[/\\]/).pop() || "";
    if (placeLocalPlugin(root, srcDir, name)) applied.push(name);
  }
  return [...new Set(applied)];
}

function unzipTo(zipPath: string, dest: string) {
  mkdirSync(dest, { recursive: true });
  if (process.platform === "win32") {
    const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Expand-Archive -LiteralPath ${q(zipPath)} -DestinationPath ${q(dest)} -Force`,
      ],
      { windowsHide: true, timeout: 120_000, stdio: "ignore" },
    );
    return;
  }
  execFileSync("unzip", ["-o", zipPath, "-d", dest], { timeout: 120_000, stdio: "ignore" });
}

/** 把用户上传的 zip 装进 plugins/。不写入生态仓。 */
export function installUploadedZip(
  root: string,
  zip: Buffer,
): { ok: boolean; message: string; applied: string[] } {
  if (!zip?.length) return { ok: false, message: "空文件", applied: [] };
  if (zip.length > 32 * 1024 * 1024) return { ok: false, message: "压缩包超过 32MB", applied: [] };
  if (zip[0] !== 0x50 || zip[1] !== 0x4b) return { ok: false, message: "请上传 zip", applied: [] };
  const stamp = randomBytes(6).toString("hex");
  const zipPath = join(tmpdir(), `nexus-up-${stamp}.zip`);
  const dest = join(tmpdir(), `nexus-up-${stamp}`);
  try {
    writeFileSync(zipPath, zip);
    unzipTo(zipPath, dest);
    let scan = dest;
    const kids = readdirSync(dest).filter((n) => !skipName(n));
    if (
      kids.length === 1 &&
      statSync(join(dest, kids[0]!)).isDirectory() &&
      !existsSync(join(dest, "nexus.pack.json")) &&
      !existsSync(join(dest, "nexus.plugin.json"))
    ) {
      scan = join(dest, kids[0]!);
    }
    const applied = installFromLocalTree(root, scan);
    if (applied.length) ensurePluginSdkLinks(root, applied);
    return {
      ok: applied.length > 0,
      message: applied.length
        ? `已上传并安装：${applied.join("、")}`
        : "压缩包里没有插件，需要 nexus.pack.json 或 nexus.plugin.json",
      applied,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: /unzip|Expand-Archive/i.test(msg) ? "解压失败，请确认是 zip" : msg || "上传失败",
      applied: [],
    };
  } finally {
    rmSync(zipPath, { force: true });
    rmSync(dest, { recursive: true, force: true });
  }
}
