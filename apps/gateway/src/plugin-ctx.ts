import type { PluginContext } from "@fengyun/nexus-plugin-sdk";
import { renderHtmlShot, renderMenuShot } from "./menu-shot.js";

export type PluginRuntimeHooks = {
  statusLines: () => string[];
};

let runtimeHooks: PluginRuntimeHooks = {
  statusLines: () => ["状态暂不可用"],
};

/** 网关在收集完运行信息后注入，供系统插件读状态行 */
export function setPluginRuntime(hooks: PluginRuntimeHooks): void {
  runtimeHooks = hooks;
}

/** 网关注入：日志 + 系统截图 + 运行时状态 */
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
    runtime: {
      statusLines: () => runtimeHooks.statusLines(),
    },
  };
}
