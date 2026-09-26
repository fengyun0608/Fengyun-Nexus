import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { findRepoRoot } from "./paths.js";

export type MediaParseCfg = {
  enabled: boolean;
  autoResolve: boolean;
  douyinEnabled: boolean;
  kuaishouEnabled: boolean;
  douyinCookie: string;
  douyinPreferSsr: boolean;
  maxDurationSec: number;
  kuaishouApis: string;
  loginPort: number;
  identifyPrefix: string;
};

export const DEFAULT_CFG: MediaParseCfg = {
  enabled: true,
  autoResolve: true,
  douyinEnabled: true,
  kuaishouEnabled: true,
  douyinCookie: "",
  douyinPreferSsr: true,
  maxDurationSec: 480,
  kuaishouApis: [
    "http://47.99.158.118/video-crack/v2/parse?content={}",
    "https://api.jkyai.top/API/jhspjx.php?url={}",
    "https://api.yujn.cn/api/pipixia.php?url={}",
    "https://api.bugpk.com/api/pipixia?url={}",
  ].join("\n"),
  loginPort: 17988,
  identifyPrefix: "识别：",
};

export function normalizeCfg(raw: Record<string, unknown> | null | undefined): MediaParseCfg {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    enabled: src.enabled !== false,
    autoResolve: src.autoResolve !== false,
    douyinEnabled: src.douyinEnabled !== false,
    kuaishouEnabled: src.kuaishouEnabled !== false,
    douyinCookie: String(src.douyinCookie ?? ""),
    douyinPreferSsr: src.douyinPreferSsr !== false,
    maxDurationSec: Math.max(30, Number(src.maxDurationSec) || DEFAULT_CFG.maxDurationSec),
    kuaishouApis: String(src.kuaishouApis ?? DEFAULT_CFG.kuaishouApis),
    loginPort: Math.max(1024, Math.min(65535, Number(src.loginPort) || DEFAULT_CFG.loginPort)),
    identifyPrefix: String(src.identifyPrefix ?? DEFAULT_CFG.identifyPrefix) || "识别：",
  };
}

function pluginConfigPath(root = findRepoRoot()): string {
  return join(root, "configs", "plugin-config.local.json");
}

/** 写入控制台同一份插件配置，重启/热更都能读到 Cookie */
export function persistPluginConfig(id: string, values: Record<string, unknown>): void {
  const root = findRepoRoot();
  const path = pluginConfigPath(root);
  mkdirSync(join(root, "configs"), { recursive: true });
  let all: Record<string, Record<string, unknown>> = {};
  if (existsSync(path)) {
    try {
      all = JSON.parse(readFileSync(path, "utf8")) as typeof all;
      if (!all || typeof all !== "object") all = {};
    } catch {
      all = {};
    }
  }
  all[id] = { ...(all[id] || {}), ...values };
  writeFileSync(path, `${JSON.stringify(all, null, 2)}\n`, "utf8");
}

export function listKuaishouApis(cfg: MediaParseCfg): string[] {
  return String(cfg.kuaishouApis || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.includes("{}") && /^https?:\/\//i.test(s));
}
