import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DbDriver } from "@fengyun/nexus-db";

export type DbBackendCfg = {
  enabled: boolean;
  label: string;
  path?: string;
};

export type DbConfigFile = {
  active: DbDriver;
  backends: Record<string, DbBackendCfg>;
};

export function loadDbConfig(root: string): DbConfigFile {
  const def = JSON.parse(
    readFileSync(join(root, "configs/db.default.json"), "utf8"),
  ) as DbConfigFile;
  const local = join(root, "configs/db.local.json");
  if (!existsSync(local)) return def;
  try {
    const j = JSON.parse(readFileSync(local, "utf8")) as Partial<DbConfigFile>;
    return {
      active: (j.active as DbDriver) || def.active,
      backends: { ...def.backends, ...(j.backends ?? {}) },
    };
  } catch {
    return def;
  }
}

export function saveDbConfig(root: string, cfg: DbConfigFile): void {
  writeFileSync(join(root, "configs/db.local.json"), `${JSON.stringify(cfg, null, 2)}\n`, "utf8");
}

/** Resolve with absolute paths under project root. Active = enabled backend. */
export function resolveDbOpenOpts(
  root: string,
  cfg: DbConfigFile,
): {
  driver: DbDriver;
  filePath?: string;
  label: string;
  active: DbDriver;
} {
  let active = cfg.active;
  let b = cfg.backends[active];
  if (!b?.enabled) {
    const hit = Object.entries(cfg.backends).find(([, v]) => v.enabled);
    if (hit) {
      active = hit[0] as DbDriver;
      b = hit[1];
    } else {
      active = "json";
      b = cfg.backends.json;
    }
  }
  return {
    driver: active,
    filePath: b?.path ? join(root, b.path) : undefined,
    label: b?.label ?? active,
    active,
  };
}
