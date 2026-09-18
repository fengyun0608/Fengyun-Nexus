/**
 * 本机开发用：读写 plugins/ 下源码，供控制台在线编辑。
 * 路径限制在 plugins/ 内，禁止 .. 逃逸。
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const TEXT_EXT = new Set([
  ".ts",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".txt",
  ".css",
  ".html",
  ".yaml",
  ".yml",
]);

function pluginsRoot(root: string): string {
  return resolve(join(root, "plugins"));
}

function safeResolve(root: string, rel: string): string | null {
  const base = pluginsRoot(root);
  const cleaned = rel.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!cleaned || cleaned.includes("\0") || cleaned.split("/").includes("..")) {
    return null;
  }
  const abs = resolve(join(base, cleaned));
  const relTo = relative(base, abs);
  if (relTo.startsWith("..") || resolve(abs) === resolve(base) && cleaned.includes("..")) {
    return null;
  }
  if (!abs.startsWith(base + sep) && abs !== base) return null;
  return abs;
}

export function listPluginDirs(root: string): Array<{
  id: string;
  dir: string;
  hasIndex: boolean;
}> {
  const base = pluginsRoot(root);
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith(".") && d.name !== "templates")
    .map((d) => {
      const dir = d.name;
      const indexTs = join(base, dir, "index.ts");
      const indexJs = join(base, dir, "index.js");
      return {
        id: dir,
        dir,
        hasIndex: existsSync(indexTs) || existsSync(indexJs),
      };
    });
}

export function listPluginFiles(
  root: string,
  pluginDir: string,
): Array<{ path: string; size: number }> {
  const abs = safeResolve(root, pluginDir);
  if (!abs || !existsSync(abs) || !statSync(abs).isDirectory()) return [];
  const out: Array<{ path: string; size: number }> = [];
  const walk = (dir: string, prefix: string) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === "node_modules" || ent.name.startsWith(".")) continue;
      const p = join(dir, ent.name);
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(p, rel);
      else {
        const ext = ent.name.includes(".") ? ent.name.slice(ent.name.lastIndexOf(".")) : "";
        if (!TEXT_EXT.has(ext)) continue;
        out.push({ path: `${pluginDir}/${rel}`.replace(/\\/g, "/"), size: statSync(p).size });
      }
    }
  };
  walk(abs, "");
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export function readPluginFile(
  root: string,
  relPath: string,
): { ok: true; path: string; content: string } | { ok: false; error: string } {
  const abs = safeResolve(root, relPath);
  if (!abs || !existsSync(abs) || !statSync(abs).isFile()) {
    return { ok: false, error: "文件不存在或路径非法" };
  }
  const ext = abs.slice(abs.lastIndexOf("."));
  if (!TEXT_EXT.has(ext)) return { ok: false, error: "不支持的文件类型" };
  if (statSync(abs).size > 800_000) return { ok: false, error: "文件过大" };
  return {
    ok: true,
    path: relPath.replace(/\\/g, "/"),
    content: readFileSync(abs, "utf8"),
  };
}

export function writePluginFile(
  root: string,
  relPath: string,
  content: string,
): { ok: true; path: string } | { ok: false; error: string } {
  const abs = safeResolve(root, relPath);
  if (!abs) return { ok: false, error: "路径非法" };
  const ext = abs.slice(abs.lastIndexOf("."));
  if (!TEXT_EXT.has(ext)) return { ok: false, error: "不支持的文件类型" };
  if (content.length > 800_000) return { ok: false, error: "内容过大" };
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, "utf8");
  return { ok: true, path: relPath.replace(/\\/g, "/") };
}

export function scaffoldPluginGuide(root: string): {
  pluginsDir: string;
  templateDir: string;
  steps: string[];
} {
  const pluginsDir = pluginsRoot(root);
  const templateDir = join(pluginsDir, "templates", "ts-plugin");
  return {
    pluginsDir,
    templateDir: existsSync(templateDir) ? templateDir : pluginsDir,
    steps: [
      `在 ${pluginsDir} 下新建目录，例如 my-plugin`,
      existsSync(templateDir)
        ? `可复制模板：${templateDir}`
        : "目录内放 index.ts，导出 Plugin 实例",
      "manifest.id 用英文；manifest.name 写中文显示名",
      "保存后框架会热重载插件；也可发 POST /v1/plugins/reload",
      "群里用 #帮助 / #菜单 验证指令是否挂上",
    ],
  };
}
