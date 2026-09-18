/**
 * 网关侧调用插件生图：运行时动态加载，避免 tsc rootDir 跨包报错。
 */
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type ShotResult =
  | { ok: true; pngPath: string; message?: string }
  | { ok: false; message: string; pngPath?: string };

type ShotOpts = { title: string; lines: string[] };

export async function renderMenuShot(opts: ShotOpts): Promise<ShotResult> {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "../../../plugins/z-draw/screenshot.js"),
    join(here, "../../../plugins/z-draw/screenshot.ts"),
  ];
  const errors: string[] = [];
  for (const shotPath of candidates) {
    try {
      const mod = (await import(pathToFileURL(shotPath).href)) as {
        renderMenuShot: (o: ShotOpts) => Promise<ShotResult>;
      };
      return await mod.renderMenuShot(opts);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { ok: false, message: `帮助图加载失败：${errors.join("; ")}` };
}
