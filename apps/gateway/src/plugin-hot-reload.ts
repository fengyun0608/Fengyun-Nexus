import {
  existsSync,
  readdirSync,
  watch,
  type FSWatcher,
} from "node:fs";
import { join } from "node:path";
import { loadPluginFromDir, loadPluginsFromDir } from "@fengyun/nexus-plugin-loader";
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

/** 目录名 → 该目录当前挂着的插件 id（模块化一目录可多个） */
const dirPluginIds = new Map<string, string[]>();

type WatchBag = {
  rootWatcher: FSWatcher | null;
  dirWatchers: Map<string, FSWatcher>;
  debounceMs: number;
  timers: Map<string, ReturnType<typeof setTimeout>>;
  busy: Set<string>;
  pending: Set<string>;
};

let watchBag: WatchBag | null = null;

function listPluginDirs(pluginsDir: string): string[] {
  if (!existsSync(pluginsDir)) return [];
  return readdirSync(pluginsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== "templates" && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();
}

/** 忽略依赖、临时文件、隐藏路径，避免误触发热更 */
function shouldIgnoreRel(rel: string): boolean {
  const name = String(rel || "").replace(/\\/g, "/");
  if (!name) return true;
  const parts = name.split("/").filter(Boolean);
  if (parts.some((p) => p === "node_modules" || p === "dist" || p.startsWith("."))) {
    return true;
  }
  if (name.endsWith(".map") || name.endsWith(".log") || name.endsWith(".tmp")) return true;
  if (name.endsWith("~") || name.endsWith(".swp")) return true;
  return false;
}

function logTip(
  log: PluginReloadDeps["log"],
  tip: { level: string; id: string; message: string },
): void {
  const line = `[插件热更] ${tip.id}  ${tip.message}`;
  if (tip.level === "ok") log.ok(line);
  else if (tip.level === "warn") log.warn(line);
  else if (tip.level === "error") log.error(line);
  else log.info(line);
}

function rememberDirIds(dirName: string, ids: string[]): void {
  if (ids.length) dirPluginIds.set(dirName, ids);
  else dirPluginIds.delete(dirName);
}

function syncDirMap(byDir: Record<string, string[]>): void {
  dirPluginIds.clear();
  for (const [dir, ids] of Object.entries(byDir)) {
    rememberDirIds(dir, ids);
  }
}

/** 启动扫完插件后调用，把目录→id 记下来，供单目录热更使用 */
export function seedPluginDirMap(byDir: Record<string, string[]>): void {
  syncDirMap(byDir);
}

/**
 * 只热更某一个插件目录，不动其它插件。
 */
export async function reloadOnePlugin(
  deps: PluginReloadDeps,
  dirName: string,
): Promise<{ ok: boolean; loaded: number; message: string; ids: string[] }> {
  const { pluginsDir, host, listEnabled, upsertPlugin, log } = deps;
  const dirPath = join(pluginsDir, dirName);
  const prevEnabled = new Map(listEnabled().map((p) => [p.id, p.enabled !== false]));

  if (!existsSync(dirPath)) {
    const oldIds = dirPluginIds.get(dirName) || [];
    for (const id of oldIds) host.unregister(id);
    rememberDirIds(dirName, []);
    log.info(`插件目录已移除：${dirName}`);
    if (deps.remountChannels) await deps.remountChannels();
    return { ok: true, loaded: 0, message: `已卸下 ${dirName}`, ids: [] };
  }

  try {
    const oldIds = [...(dirPluginIds.get(dirName) || [])];
    for (const id of oldIds) host.unregister(id);

    const scan = await loadPluginFromDir(
      dirPath,
      (tip) => logTip(log, tip),
      { cacheBust: true },
    );

    const newIds: string[] = [];
    for (const p of scan.plugins) {
      const enabled = prevEnabled.has(p.manifest.id)
        ? prevEnabled.get(p.manifest.id) !== false
        : true;
      host.register(p);
      host.setEnabled(p.manifest.id, enabled);
      upsertPlugin({
        id: p.manifest.id,
        name: p.manifest.name,
        version: p.manifest.version,
        enabled,
        loadedAt: nowIso(),
      });
      newIds.push(p.manifest.id);
    }
    rememberDirIds(dirName, newIds);

    if (deps.root && newIds.length) {
      const applied = await applyStoredPluginConfigs(deps.root, host.values());
      if (applied) log.info(`插件配置已套用 ${applied} 项`);
    }

    if (newIds.length) {
      await host.emitReady(
        (id) => makePluginCtx(id, (m) => log.info(`[${id}] ${m}`)),
        (line) => log.info(line),
        newIds,
      );
    }

    if (deps.remountChannels) {
      await deps.remountChannels();
    }

    const label = newIds.length ? newIds.join(", ") : dirName;
    log.ok(`插件热更新完成：${label}（仅此目录）`);
    return {
      ok: true,
      loaded: newIds.length,
      message: `已热更新 ${label}`,
      ids: newIds,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error(`插件热更新失败（${dirName}）：${msg}`);
    return { ok: false, loaded: 0, message: msg, ids: [] };
  }
}

/**
 * 手动全量重载（控制台 / API）。监视触发走 reloadOnePlugin。
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
      (tip) => logTip(log, tip),
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
    syncDirMap(scan.byDir);

    if (deps.root) {
      const applied = await applyStoredPluginConfigs(deps.root, host.values());
      if (applied) log.info(`插件配置已套用 ${applied} 项`);
    }

    await host.emitReady(
      (id) => makePluginCtx(id, (m) => log.info(`[${id}] ${m}`)),
      (line) => log.info(line),
    );

    if (deps.remountChannels) {
      await deps.remountChannels();
    }

    // 全量后补齐各目录监视（新装的插件目录）
    if (watchBag) {
      reconcileDirWatchers(deps, watchBag);
    }

    const n = host.list().length;
    log.ok(`插件热更新完成：${n} 个（全量）`);
    return { ok: true, loaded: n, message: `已热更新 ${n} 个插件` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error(`插件热更新失败：${msg}`);
    return { ok: false, loaded: 0, message: msg };
  }
}

function kickDir(deps: PluginReloadDeps, bag: WatchBag, dirName: string): void {
  const prev = bag.timers.get(dirName);
  if (prev) clearTimeout(prev);
  bag.timers.set(
    dirName,
    setTimeout(async () => {
      bag.timers.delete(dirName);
      if (bag.busy.has(dirName)) {
        bag.pending.add(dirName);
        return;
      }
      bag.busy.add(dirName);
      try {
        await reloadOnePlugin(deps, dirName);
      } finally {
        bag.busy.delete(dirName);
        if (bag.pending.has(dirName)) {
          bag.pending.delete(dirName);
          kickDir(deps, bag, dirName);
        }
      }
    }, bag.debounceMs),
  );
}

function attachDirWatcher(
  deps: PluginReloadDeps,
  bag: WatchBag,
  dirName: string,
): void {
  if (bag.dirWatchers.has(dirName)) return;
  const dirPath = join(deps.pluginsDir, dirName);
  if (!existsSync(dirPath)) return;
  try {
    const w = watch(dirPath, { recursive: true }, (_event, filename) => {
      const rel = filename ? String(filename) : "";
      if (shouldIgnoreRel(rel)) return;
      deps.log.info(`插件变更：${dirName}/${rel.replace(/\\/g, "/") || "(目录)"}`);
      kickDir(deps, bag, dirName);
    });
    w.on("error", (err) => {
      deps.log.warn(
        `插件热更监视异常（${dirName}）：${err instanceof Error ? err.message : String(err)}`,
      );
    });
    bag.dirWatchers.set(dirName, w);
  } catch (e) {
    deps.log.warn(
      `无法监视插件目录 ${dirName}：${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

function detachDirWatcher(bag: WatchBag, dirName: string): void {
  const w = bag.dirWatchers.get(dirName);
  if (!w) return;
  try {
    w.close();
  } catch {
    /* ignore */
  }
  bag.dirWatchers.delete(dirName);
  const t = bag.timers.get(dirName);
  if (t) clearTimeout(t);
  bag.timers.delete(dirName);
}

function reconcileDirWatchers(deps: PluginReloadDeps, bag: WatchBag): void {
  const live = new Set(listPluginDirs(deps.pluginsDir));
  for (const name of [...bag.dirWatchers.keys()]) {
    if (!live.has(name)) {
      detachDirWatcher(bag, name);
      void reloadOnePlugin(deps, name);
    }
  }
  for (const name of live) {
    if (!bag.dirWatchers.has(name)) {
      attachDirWatcher(deps, bag, name);
      // 新出现的目录：立刻加载一次
      if (!dirPluginIds.has(name)) {
        kickDir(deps, bag, name);
      }
    }
  }
}

/**
 * 每个插件目录单独 recursive 监视；根目录只盯「新增/删除文件夹」。
 * templates/ 不监视。改哪个目录就只重载哪个。
 */
export function watchPluginsHotReload(
  deps: PluginReloadDeps,
  opts?: { debounceMs?: number; enabled?: boolean },
): FSWatcher | null {
  if (opts?.enabled === false) return null;
  if (!existsSync(deps.pluginsDir)) {
    deps.log.warn(`插件热更监视跳过：目录不存在 ${deps.pluginsDir}`);
    return null;
  }

  const bag: WatchBag = {
    rootWatcher: null,
    dirWatchers: new Map(),
    debounceMs: opts?.debounceMs ?? 600,
    timers: new Map(),
    busy: new Set(),
    pending: new Set(),
  };
  watchBag = bag;

  for (const dirName of listPluginDirs(deps.pluginsDir)) {
    attachDirWatcher(deps, bag, dirName);
  }
  deps.log.info(`插件热更：已单独监视 ${bag.dirWatchers.size} 个插件目录`);

  // 根目录非递归：只关心新增/删除插件文件夹
  try {
    const rootW = watch(deps.pluginsDir, { recursive: false }, (_event, filename) => {
      const name = filename ? String(filename).replace(/\\/g, "/") : "";
      if (!name || name.includes("/") || name === "templates" || name.startsWith(".")) {
        return;
      }
      deps.log.info(`插件目录变动：${name}`);
      reconcileDirWatchers(deps, bag);
    });
    rootW.on("error", (err) => {
      deps.log.warn(
        `插件热更根监视异常：${err instanceof Error ? err.message : String(err)}`,
      );
    });
    bag.rootWatcher = rootW;
    return rootW;
  } catch (e) {
    deps.log.warn(
      `插件热更根监视失败：${e instanceof Error ? e.message : String(e)}`,
    );
    return null;
  }
}
