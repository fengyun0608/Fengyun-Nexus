import { existsSync, watch, type FSWatcher } from "node:fs";
import { loadPluginsFromDir } from "@fengyun/nexus-plugin-loader";
import type { PluginHost } from "@fengyun/nexus-plugin-sdk";
import { nowIso } from "@fengyun/nexus-shared";
import { makePluginCtx } from "./plugin-ctx.js";
import { applyStoredPluginConfigs } from "./plugin-config-store.js";

export type PluginReloadDeps = {
  pluginsDir: string;
  host: PluginHost;
  /** Persist / read enabled flags */
  listEnabled: () => Array<{ id: string; enabled: boolean }>;
  upsertPlugin: (row: {
    id: string;
    name: string;
    version: string;
    enabled: boolean;
    loadedAt: string;
  }) => void;
  log: {
    ok: (m: string) => void;
    warn: (m: string) => void;
    error: (m: string) => void;
    info: (m: string) => void;
  };
  /** 插件热更后：重新扫描 adapter/ 并挂到 ChannelRegistry */
  remountChannels?: () => Promise<void>;
  /** 热更后把已保存的插件配置再套回去，避免次数回到初始值 */
  root?: string;
};

/**
 * Hot-reload plugins only — never restarts the gateway process.
 * Framework/core code still needs `#重启` / restart.bat|sh when required.
 */
export async function reloadPlugins(deps: PluginReloadDeps): Promise<{
  ok: boolean;
  loaded: number;
  message: string;
}> {
  const { pluginsDir, host, listEnabled, upsertPlugin, log } = deps;
  const prevEnabled = new Map(listEnabled().map((p) => [p.id, p.enabled !== false]));

  try {
    const scan = await loadPluginsFromDir(
      pluginsDir,
      (tip) => {
        if (tip.level === "ok") log.ok(`[插件热更] ${tip.id}  ${tip.message}`);
        else if (tip.level === "warn") log.warn(`[插件热更] ${tip.id}  ${tip.message}`);
        else if (tip.level === "error") log.error(`[插件热更] ${tip.id}  ${tip.message}`);
        else log.info(`[插件热更] ${tip.id}  ${tip.message}`);
      },
      { cacheBust: true },
    );

    host.clear();
    for (const p of scan.host.values()) {
      host.register(p);
      const enabled = prevEnabled.has(p.manifest.id)
        ? prevEnabled.get(p.manifest.id) !== false
        : true;
      host.setEnabled(p.manifest.id, enabled);
      upsertPlugin({
        id: p.manifest.id,
        name: p.manifest.name,
        version: p.manifest.version,
        enabled,
        loadedAt: nowIso(),
      });
    }

    if (deps.root) {
      const applied = await applyStoredPluginConfigs(deps.root, host.values());
      if (applied) log.info(`插件配置已套用 ${applied} 项`);
    }

    await host.emitReady((id) => makePluginCtx(id, (m) => log.info(`[${id}] ${m}`)));

    if (deps.remountChannels) {
      await deps.remountChannels();
    }

    const n = host.list().length;
    log.ok(`插件热更新完成：${n} 个`);
    return { ok: true, loaded: n, message: `已热更新 ${n} 个插件` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error(`插件热更新失败：${msg}`);
    return { ok: false, loaded: 0, message: msg };
  }
}

/** Watch plugins/ — debounce file changes then reloadPlugins. */
export function watchPluginsHotReload(
  deps: PluginReloadDeps,
  opts?: { debounceMs?: number; enabled?: boolean },
): FSWatcher | null {
  if (opts?.enabled === false) return null;
  if (!existsSync(deps.pluginsDir)) {
    deps.log.warn(`插件热更监视跳过：目录不存在 ${deps.pluginsDir}`);
    return null;
  }

  const debounceMs = opts?.debounceMs ?? 600;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let busy = false;
  let pending = false;

  const kick = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      if (busy) {
        pending = true;
        return;
      }
      busy = true;
      try {
        await reloadPlugins(deps);
      } finally {
        busy = false;
        if (pending) {
          pending = false;
          kick();
        }
      }
    }, debounceMs);
  };

  const watcher = watch(deps.pluginsDir, { recursive: true }, (_event, filename) => {
    const name = filename ? String(filename).replace(/\\/g, "/") : "";
    if (!name) return;
    if (name.includes("node_modules/") || name.includes("/.")) return;
    if (name.endsWith(".map") || name.endsWith(".log")) return;
    deps.log.info(`插件变更：${name}`);
    kick();
  });

  watcher.on("error", (err) => {
    deps.log.warn(`插件热更监视异常：${err instanceof Error ? err.message : String(err)}`);
  });

  return watcher;
}
