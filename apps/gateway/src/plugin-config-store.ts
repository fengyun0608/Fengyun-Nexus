/**
 * 插件配置落盘。保存后立刻套到运行中的插件，热更和重启都读这份。
 */
import { existsSync, mkdirSync, readFileSync, watch, writeFileSync } from "node:fs";
import { join } from "node:path";

export type PluginConfigMap = Record<string, Record<string, unknown>>;

type PluginLike = {
  manifest: { id: string };
  setConfig?: (cfg: Record<string, unknown>) => void | Promise<void>;
};

const FILE_NAME = "plugin-config.local.json";
let writingUntil = 0;

export function pluginConfigPath(root: string): string {
  return join(root, "configs", FILE_NAME);
}

export function loadPluginConfigMap(root: string): PluginConfigMap {
  const p = pluginConfigPath(root);
  if (!existsSync(p)) return {};
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as PluginConfigMap;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return raw;
  } catch {
    return {};
  }
}

export function savePluginConfig(root: string, id: string, values: Record<string, unknown>): void {
  const all = loadPluginConfigMap(root);
  all[id] = values;
  mkdirSync(join(root, "configs"), { recursive: true });
  writingUntil = Date.now() + 800;
  writeFileSync(pluginConfigPath(root), `${JSON.stringify(all, null, 2)}\n`, "utf8");
}

export async function applyStoredPluginConfigs(root: string, plugins: PluginLike[]): Promise<number> {
  const all = loadPluginConfigMap(root);
  let n = 0;
  for (const p of plugins) {
    const saved = all[p.manifest.id];
    if (!saved || typeof saved !== "object" || !p.setConfig) continue;
    await p.setConfig(saved);
    n += 1;
  }
  return n;
}

/** 手改配置文件后立刻套用。自己写入的那一下跳过，避免来回触发。 */
export function watchPluginConfigFile(root: string, onChange: () => void): void {
  const dir = join(root, "configs");
  mkdirSync(dir, { recursive: true });
  watch(dir, (_event, filename) => {
    const name = filename ? String(filename).replace(/\\/g, "/") : "";
    if (name !== FILE_NAME) return;
    if (Date.now() < writingUntil) return;
    onChange();
  });
}
