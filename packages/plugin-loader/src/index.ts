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
 * Convention: plugin ids prefer `z.*` namespace.
 */
export async function loadPluginsFromDir(
  pluginsRoot: string,
  log?: (tip: LoadTip) => void,
): Promise<ScanResult> {
  const host = new PluginHost();
  const tips: LoadTip[] = [];
  const loaded: PluginManifest[] = [];
  const root = resolve(pluginsRoot);

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
    const mainRel = manifest.main ?? "index.js";
    const mainPath = join(dir, mainRel);
    const tsPath = join(dir, mainRel.replace(/\.js$/, ".ts"));
    const entry = existsSync(mainPath) ? mainPath : existsSync(tsPath) ? tsPath : null;
    if (!entry) {
      tip({ level: "error", id: manifest.id, message: `entry not found: ${mainRel}` });
      continue;
    }
    try {
      const mod = await import(pathToFileURL(entry).href);
      const plugin = (mod.default ?? mod.plugin) as NexusPlugin | undefined;
      if (!plugin?.manifest) {
        tip({ level: "error", id: manifest.id, message: "default export missing manifest" });
        continue;
      }
      // Prefer file manifest fields
      plugin.manifest = { ...manifest, ...plugin.manifest, id: manifest.id };
      host.register(plugin);
      loaded.push(plugin.manifest);
      tip({
        level: "ok",
        id: plugin.manifest.id,
        message: `loaded ${plugin.manifest.name}@${plugin.manifest.version}`,
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
