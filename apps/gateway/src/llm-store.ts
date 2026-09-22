import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type LlmProviderCategory = "cloud" | "local" | "custom";

export type LlmProvider = {
  id: string;
  name: string;
  category: LlmProviderCategory;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
};

export type LlmProvidersFile = {
  activeId: string;
  providers: LlmProvider[];
};

export function loadProvidersFile(root: string): LlmProvidersFile {
  const defPath = join(root, "configs/llm.providers.default.json");
  const localPath = join(root, "configs/llm.local.json");
  const def = JSON.parse(readFileSync(defPath, "utf8")) as LlmProvidersFile;

  if (!existsSync(localPath)) return def;
  try {
    const local = JSON.parse(readFileSync(localPath, "utf8")) as Partial<LlmProvidersFile> & {
      apiKey?: string;
      baseUrl?: string;
      model?: string;
    };
    // Migrate legacy single-provider llm.local.json
    if (Array.isArray(local.providers) && local.providers.length) {
      // 发行默认里新增的预设，补进本机列表（不覆盖用户已改过的同 id）
      const seen = new Set(local.providers.map((p) => p.id));
      const merged = local.providers.map((p) => {
        // 曾误写「千万」→ 纠正为「千问」
        if (p.id === "qianwen-maas" && p.name === "千万平台") {
          return { ...p, name: "千问平台" };
        }
        return { ...p };
      });
      for (const p of def.providers) {
        if (!seen.has(p.id)) merged.push({ ...p });
      }
      return {
        activeId: local.activeId || def.activeId,
        providers: merged,
      };
    }
    if (local.apiKey || local.baseUrl || local.model) {
      const providers = def.providers.map((p) =>
        p.id === def.activeId
          ? {
              ...p,
              apiKey: local.apiKey ?? p.apiKey,
              baseUrl: local.baseUrl ?? p.baseUrl,
              model: local.model ?? p.model,
            }
          : p,
      );
      return { activeId: def.activeId, providers };
    }
  } catch {
    /* ignore */
  }
  return def;
}

export function saveProvidersFile(root: string, data: LlmProvidersFile): void {
  writeFileSync(join(root, "configs/llm.local.json"), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function activeProvider(file: LlmProvidersFile): LlmProvider | undefined {
  return file.providers.find((p) => p.id === file.activeId) ?? file.providers[0];
}

export function maskKey(key?: string): string {
  if (!key) return "";
  return `${key.slice(0, 4)}${"*".repeat(Math.min(8, Math.max(0, key.length - 4)))}`;
}

export function publicProviders(file: LlmProvidersFile) {
  return {
    activeId: file.activeId,
    providers: file.providers.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      baseUrl: p.baseUrl ?? "",
      model: p.model ?? "",
      hasKey: Boolean(p.apiKey),
      apiKeyMasked: maskKey(p.apiKey),
    })),
  };
}
