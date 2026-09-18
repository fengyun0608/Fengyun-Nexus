import type { PluginContext } from "@fengyun/nexus-plugin-sdk";
import { renderHtmlShot, renderMenuShot } from "./menu-shot.js";

/** 网关注入：日志 + 系统截图 */
export function makePluginCtx(
  id: string,
  logFn: (msg: string) => void,
): PluginContext {
  return {
    pluginId: id,
    reply: async () => undefined,
    log: logFn,
    shot: {
      renderMenu: (o) => renderMenuShot(o),
      renderHtml: (o) => renderHtmlShot(o),
    },
  };
}
