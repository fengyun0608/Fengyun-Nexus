import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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

/** 分目录约定：adapter / plugin / workflow / http / events / commonconfig / www */
export const MODULAR_DIRS = [
  "adapter",
  "plugin",
  "workflow",
  "http",
  "events",
  "commonconfig",
  "www",
] as const;

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

function listTsEntries(folder: string): string[] {
  if (!existsSync(folder) || !statSync(folder).isDirectory()) return [];
  return readdirSync(folder)
    .filter((n) => /\.(ts|js|mjs)$/i.test(n) && !n.startsWith(".") && !n.endsWith(".d.ts"))
    .map((n) => join(folder, n))
    .sort();
}

/**
 * 解析入口：
 * - 有 main / index → 单文件（老写法）
 * - 否则扫 plugin/*.ts（无根 index 时的分目录写法）
 */
export function resolvePluginEntries(
  dir: string,
  manifest: PluginManifest,
): { entries: string[]; mode: "single" | "modular" } {
  const mainRel = manifest.main;
  if (mainRel) {
    const mainPath = join(dir, mainRel);
    const tsPath = join(dir, mainRel.replace(/\.js$/, ".ts"));
    const hit = existsSync(mainPath) ? mainPath : existsSync(tsPath) ? tsPath : null;
    return { entries: hit ? [hit] : [], mode: "single" };
  }
  const indexTs = join(dir, "index.ts");
  const indexJs = join(dir, "index.js");
  if (existsSync(indexTs) || existsSync(indexJs)) {
    return { entries: [existsSync(indexTs) ? indexTs : indexJs], mode: "single" };
  }
  const fromPlugin = listTsEntries(join(dir, "plugin"));
  if (fromPlugin.length) return { entries: fromPlugin, mode: "modular" };
  return { entries: [], mode: "single" };
}

export function detectModularLayout(dir: string): string[] {
  return MODULAR_DIRS.filter((name) => {
    const p = join(dir, name);
    return existsSync(p) && statSync(p).isDirectory();
  });
}

/**
 * Scan `plugins/*` directories (skip templates/) and load ESM entry.
 * Convention: id = English (`z.*`); name = console display label (Chinese OK).
 * Modular：可无根 index，只放 plugin/*.ts；另可有 adapter/workflow/http/…
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

    const layout = detectModularLayout(dir);
    if (layout.length) {
      tip({
        level: "info",
        id: manifest.id,
        message: `分目录：${layout.join(", ")}`,
      });
    }

    const { entries: files, mode } = resolvePluginEntries(dir, manifest);
    if (!files.length) {
      tip({
        level: "error",
        id: manifest.id,
        message: "找不到入口：放 index.ts，或写 main，或用 plugin/*.ts",
      });
      continue;
    }

    for (const entry of files) {
      try {
        const href = `${pathToFileURL(entry).href}${bust}`;
        const mod = await import(href);
        const plugin = (mod.default ?? mod.plugin) as NexusPlugin | undefined;
        if (!plugin?.manifest) {
          tip({
            level: "error",
            id: manifest.id,
            message: `${entry.split(/[/\\]/).pop()} 缺 default.manifest`,
          });
          continue;
        }
        const mergedName =
          (plugin.manifest.name || manifest.name || manifest.id).trim() || manifest.id;
        // 模块化多文件时：子插件可用自己的 id；须仍是英文
        const childId = plugin.manifest.id || manifest.id;
        if (!isValidPluginId(childId)) {
          tip({
            level: "error",
            id: childId,
            message: "插件 id 必须是英文，中文请写在 name",
          });
          continue;
        }
        plugin.manifest = {
          ...manifest,
          ...plugin.manifest,
          id: childId,
          name: mergedName,
        };
        host.register(plugin);
        loaded.push(plugin.manifest);
        tip({
          level: "ok",
          id: plugin.manifest.id,
          message: `已加载 ${plugin.manifest.name}（${plugin.manifest.id}@${plugin.manifest.version}${mode === "modular" ? " · modular" : ""}）`,
        });
      } catch (e) {
        tip({
          level: "error",
          id: manifest.id,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  tip({
    level: "info",
    id: "scanner",
    message: `scan done: ${loaded.length} plugin(s) active`,
  });
  return { host, tips, loaded };
}
