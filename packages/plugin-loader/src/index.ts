import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  type NexusPlugin,
  type PluginManifest,
  PluginHost,
} from "@fengyun/nexus-plugin-sdk";

export type LoadTip = {
  level: "ok" | "warn" | "error" | "info";
  id: string;
  message: string;
};

export interface ScanResult {
  host: PluginHost;
  tips: LoadTip[];
  loaded: PluginManifest[];
}

/** Plugin id must be English ASCII: start with letter, then letters/digits/._- */
export function isValidPluginId(id: string): boolean {
  return /^[a-z][a-z0-9._-]*$/i.test(id) && !/[^\x00-\x7F]/.test(id);
}

function readManifest(dir: string): PluginManifest | null {
  const file = join(dir, "nexus.plugin.json");
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as PluginManifest;
  } catch {
    return null;
  }
}

/**
 * Scan `plugins/*` directories (skip templates/) and load ESM entry.
 * Convention: id = English (`z.*`); name = console display label (Chinese OK).
 */
export async function loadPluginsFromDir(
  pluginsRoot: string,
  log?: (tip: LoadTip) => void,
  opts?: { cacheBust?: boolean },
): Promise<ScanResult> {
  const host = new PluginHost();
  const tips: LoadTip[] = [];
  const loaded: PluginManifest[] = [];
  const root = resolve(pluginsRoot);
  const bust = opts?.cacheBust ? `?t=${Date.now()}` : "";

  const tip = (t: LoadTip) => {
    tips.push(t);
    log?.(t);
  };

  if (!existsSync(root)) {
    tip({ level: "warn", id: "scanner", message: `plugins dir missing: ${root}` });
    return { host, tips, loaded };
  }

  const entries = readdirSync(root, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (ent.name === "templates" || ent.name.startsWith(".")) continue;
    const dir = join(root, ent.name);
    const manifest = readManifest(dir);
    if (!manifest) {
      tip({ level: "warn", id: ent.name, message: "skip: no nexus.plugin.json" });
      continue;
    }
    if (!manifest.id || !isValidPluginId(manifest.id)) {
      tip({
        level: "error",
        id: manifest.id || ent.name,
        message: "插件 id 必须是英文（字母开头，仅 a-z 0-9 . _ -），中文请写在 name 显示名",
      });
      continue;
    }
    if (!manifest.name?.trim()) {
      tip({
        level: "warn",
        id: manifest.id,
        message: "未设置 name 显示名，控制台将只显示 id；建议填写中文名称",
      });
    }
    const mainRel = manifest.main ?? "index.js";
    const mainPath = join(dir, mainRel);
    const tsPath = join(dir, mainRel.replace(/\.js$/, ".ts"));
    const entry = existsSync(mainPath) ? mainPath : existsSync(tsPath) ? tsPath : null;
    if (!entry) {
      tip({ level: "error", id: manifest.id, message: `entry not found: ${mainRel}` });
      continue;
    }
    try {
      const href = `${pathToFileURL(entry).href}${bust}`;
      const mod = await import(href);
      const plugin = (mod.default ?? mod.plugin) as NexusPlugin | undefined;
      if (!plugin?.manifest) {
        tip({ level: "error", id: manifest.id, message: "default export missing manifest" });
        continue;
      }
      // id 以目录清单为准；name 优先代码里的显示名，否则用 json
      const mergedName =
        (plugin.manifest.name || manifest.name || manifest.id).trim() || manifest.id;
      plugin.manifest = {
        ...manifest,
        ...plugin.manifest,
        id: manifest.id,
        name: mergedName,
      };
      if (!isValidPluginId(plugin.manifest.id)) {
        tip({
          level: "error",
          id: plugin.manifest.id,
          message: "插件 id 必须是英文，中文请写在 name",
        });
        continue;
      }
      host.register(plugin);
      loaded.push(plugin.manifest);
      tip({
        level: "ok",
        id: plugin.manifest.id,
        message: `已加载 ${plugin.manifest.name}（${plugin.manifest.id}@${plugin.manifest.version}）`,
      });
    } catch (e) {
      tip({
        level: "error",
        id: manifest.id,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  tip({
    level: "info",
    id: "scanner",
    message: `scan done: ${loaded.length} plugin(s) active`,
  });
  return { host, tips, loaded };
}
