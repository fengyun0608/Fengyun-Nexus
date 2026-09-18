/**
 * 控制台外观：壁纸地址等。默认指向本仓 /wallpapers/default.jpg。
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type ConsoleAppearance = {
  /** 壁纸地址：相对路径（如 /wallpapers/default.jpg）或 http(s) */
  wallpaperUrl: string;
  wallpaperFit: "cover" | "contain" | "fill";
  /** 主区遮罩透明度，越大字越清晰 */
  wallpaperDim: number;
  note?: string;
};

export const DEFAULT_WALLPAPER_URL = "/wallpapers/default.jpg";

function clampDim(n: number): number {
  if (!Number.isFinite(n)) return 0.42;
  return Math.min(0.85, Math.max(0, n));
}

function normalize(raw: Partial<ConsoleAppearance> | undefined): ConsoleAppearance {
  const fit = raw?.wallpaperFit;
  return {
    wallpaperUrl:
      typeof raw?.wallpaperUrl === "string" && raw.wallpaperUrl.trim()
        ? raw.wallpaperUrl.trim()
        : DEFAULT_WALLPAPER_URL,
    wallpaperFit: fit === "contain" || fit === "fill" || fit === "cover" ? fit : "cover",
    wallpaperDim: clampDim(
      typeof raw?.wallpaperDim === "number" ? raw.wallpaperDim : Number(raw?.wallpaperDim),
    ),
    note: typeof raw?.note === "string" ? raw.note : "",
  };
}

export function loadConsoleAppearance(root: string): ConsoleAppearance {
  const defPath = join(root, "configs/console.default.json");
  const localPath = join(root, "configs/console.local.json");
  let def: Partial<ConsoleAppearance> = {};
  if (existsSync(defPath)) {
    try {
      def = JSON.parse(readFileSync(defPath, "utf8")) as Partial<ConsoleAppearance>;
    } catch {
      /* ignore */
    }
  }
  if (!existsSync(localPath)) return normalize(def);
  try {
    const local = JSON.parse(readFileSync(localPath, "utf8")) as Partial<ConsoleAppearance>;
    return normalize({ ...def, ...local });
  } catch {
    return normalize(def);
  }
}

export function saveConsoleAppearance(root: string, cfg: ConsoleAppearance): void {
  writeFileSync(
    join(root, "configs/console.local.json"),
    `${JSON.stringify(normalize(cfg), null, 2)}\n`,
    "utf8",
  );
}

/** 校验用户提交的壁纸地址：相对 /… 或 http(s) */
export function isAllowedWallpaperUrl(url: string): boolean {
  const u = String(url || "").trim();
  if (!u) return false;
  if (u.startsWith("/") && !u.startsWith("//") && !u.includes("..")) return true;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
