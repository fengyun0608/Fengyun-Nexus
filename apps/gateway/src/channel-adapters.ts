import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  type ChannelAdapter,
  type ChannelRegistry,
  defineAdapter,
} from "@fengyun/nexus-channel";

export type AdapterLoadTip = {
  level: "ok" | "warn" | "error" | "info";
  id: string;
  message: string;
};

function listAdapterFiles(folder: string): string[] {
  if (!existsSync(folder) || !statSync(folder).isDirectory()) return [];
  return readdirSync(folder)
    .filter(
      (n) =>
        /\.(ts|js|mjs)$/i.test(n) &&
        !n.startsWith(".") &&
        !n.endsWith(".d.ts") &&
        !n.startsWith("_"),
    )
    .map((n) => join(folder, n))
    .sort();
}

function isAdapterLike(v: unknown): v is ChannelAdapter {
  if (!v || typeof v !== "object") return false;
  const a = v as Record<string, unknown>;
  return (
    typeof a.id === "string" &&
    a.id.trim().length > 0 &&
    typeof a.normalizeInbound === "function" &&
    typeof a.formatOutbound === "function"
  );
}

function pickAdapters(mod: Record<string, unknown>): ChannelAdapter[] {
  const out: ChannelAdapter[] = [];
  const candidates = [
    mod.default,
    mod.adapter,
    mod.channel,
    ...(Object.values(mod) as unknown[]),
  ];
  for (const c of candidates) {
    if (!isAdapterLike(c)) continue;
    const id = String(c.id).trim();
    if (out.some((x) => x.id === id)) continue;
    out.push(defineAdapter(c));
  }
  return out;
}

/**
 * 扫描各插件包下的 adapter 目录（*.ts / *.js），收集通道适配器。
 * 开发者只需放适配器文件，宿主启动/热更时自动挂载。
 */
export async function loadChannelAdaptersFromPluginsDir(
  pluginsRoot: string,
  opts?: { cacheBust?: boolean },
): Promise<{ adapters: ChannelAdapter[]; tips: AdapterLoadTip[] }> {
  const root = resolve(pluginsRoot);
  const tips: AdapterLoadTip[] = [];
  const adapters: ChannelAdapter[] = [];
  const seen = new Set<string>();
  const bust = opts?.cacheBust ? `?t=${Date.now()}` : "";

  if (!existsSync(root)) {
    tips.push({
      level: "warn",
      id: "adapter-scan",
      message: `plugins 目录不存在：${root}`,
    });
    return { adapters, tips };
  }

  const entries = readdirSync(root, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (ent.name === "templates" || ent.name.startsWith(".")) continue;
    const pluginDir = join(root, ent.name);
    const adapterDir = join(pluginDir, "adapter");
    const files = listAdapterFiles(adapterDir);
    if (!files.length) continue;

    tips.push({
      level: "info",
      id: ent.name,
      message: `发现 adapter/（${files.length} 个文件）`,
    });

    for (const file of files) {
      const base = file.split(/[/\\]/).pop() || file;
      try {
        const href = `${pathToFileURL(file).href}${bust}`;
        const mod = (await import(href)) as Record<string, unknown>;
        const found = pickAdapters(mod);
        if (!found.length) {
          tips.push({
            level: "warn",
            id: ent.name,
            message: `${base} 未导出 ChannelAdapter（需 id + normalizeInbound + formatOutbound）`,
          });
          continue;
        }
        for (const a of found) {
          if (seen.has(a.id)) {
            tips.push({
              level: "warn",
              id: a.id,
              message: `通道 id 重复，跳过 ${ent.name}/${base}`,
            });
            continue;
          }
          seen.add(a.id);
          adapters.push(a);
          tips.push({
            level: "ok",
            id: a.id,
            message: `已检测通道 ${a.label || a.id}（来自 ${ent.name}/${base}）`,
          });
        }
      } catch (e) {
        tips.push({
          level: "error",
          id: ent.name,
          message: `${base}：${e instanceof Error ? e.message : String(e)}`,
        });
      }
    }
  }

  tips.push({
    level: "info",
    id: "adapter-scan",
    message: `adapter 扫描完成：${adapters.length} 个通道`,
  });
  return { adapters, tips };
}

export async function remountPluginChannels(
  pluginsDir: string,
  channels: ChannelRegistry,
  log: {
    ok: (m: string) => void;
    warn: (m: string) => void;
    error: (m: string) => void;
    info: (m: string) => void;
  },
  opts?: { cacheBust?: boolean },
): Promise<{ mounted: string[]; skipped: string[] }> {
  const { adapters, tips } = await loadChannelAdaptersFromPluginsDir(pluginsDir, opts);
  for (const t of tips) {
    const line = `[通道] ${t.id}  ${t.message}`;
    if (t.level === "ok") log.ok(line);
    else if (t.level === "warn") log.warn(line);
    else if (t.level === "error") log.error(line);
    else log.info(line);
  }
  const result = channels.remountPlugins(adapters);
  if (result.mounted.length) {
    log.ok(`[通道] 已自动挂载：${result.mounted.join(", ")}`);
  }
  if (result.skipped.length) {
    log.warn(`[通道] 与内置冲突已跳过：${result.skipped.join(", ")}`);
  }
  return result;
}
