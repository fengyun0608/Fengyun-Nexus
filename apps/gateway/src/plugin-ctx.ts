import type {
  MasterLevel,
  PluginContext,
} from "@fengyun/nexus-plugin-sdk";
import type { OneBot11Bridge } from "./onebot11-bridge.js";
import {
  addChannelMaster,
  claimFirstMaster,
  getChannelSettings,
  isChannelMaster,
  masterLevelOf,
  removeChannelMaster,
  type ChannelsConfigFile,
} from "./channel-settings.js";
import { renderHtmlShot, renderMenuShot } from "./menu-shot.js";

export type PluginRuntimeHooks = {
  statusLines: () => string[];
  statusHtml: () => string | Promise<string>;
};

let runtimeHooks: PluginRuntimeHooks = {
  statusLines: () => ["状态暂不可用"],
  statusHtml: () => "<html><body><div id='panel'>状态暂不可用</div></body></html>",
};

type ChannelBag = {
  getCfg: () => ChannelsConfigFile;
  setCfg: (cfg: ChannelsConfigFile) => void;
  save: () => void;
};

let channelBag: ChannelBag | null = null;
let onebotRef: OneBot11Bridge | null = null;
let defaultChannelId = "onebot11";

/** 网关在收集完运行信息后注入，供系统插件读状态 */
export function setPluginRuntime(hooks: PluginRuntimeHooks): void {
  runtimeHooks = hooks;
}

export function setPluginChannelBag(bag: ChannelBag): void {
  channelBag = bag;
}

export function setPluginOneBot(bridge: OneBot11Bridge | null): void {
  onebotRef = bridge;
}

export function setPluginDefaultChannel(id: string): void {
  defaultChannelId = id || "onebot11";
}

/** 网关注入：日志 + 系统截图 + 运行时状态 + OneBot + 主人 */
export function makePluginCtx(
  id: string,
  logFn: (msg: string) => void,
  opts?: { channelId?: string; eventUserId?: string },
): PluginContext {
  const channelId = opts?.channelId || defaultChannelId;
  const ctx: PluginContext = {
    pluginId: id,
    reply: async () => undefined,
    log: logFn,
    channelId,
    shot: {
      renderMenu: (o) => renderMenuShot(o),
      renderHtml: (o) => renderHtmlShot(o),
    },
    runtime: {
      statusLines: () => runtimeHooks.statusLines(),
      statusHtml: () => runtimeHooks.statusHtml(),
    },
    isMaster: (userId?: string) => {
      if (!channelBag) return false;
      const uid = userId || opts?.eventUserId || "";
      if (!uid) return false;
      const s = getChannelSettings(channelBag.getCfg(), channelId);
      return isChannelMaster(s, uid);
    },
    masterLevel: (userId?: string) => {
      if (!channelBag) return null;
      const uid = userId || opts?.eventUserId || "";
      if (!uid) return null;
      const s = getChannelSettings(channelBag.getCfg(), channelId);
      return masterLevelOf(s, uid);
    },
    masters: {
      list: (ch?: string) => {
        const cid = ch || channelId;
        if (!channelBag) return { core: [], new: [], normal: [], all: [] };
        const s = getChannelSettings(channelBag.getCfg(), cid);
        return {
          core: [...s.coreMasters],
          new: [...s.newMasters],
          normal: [...s.normalMasters],
          all: [...s.masters],
        };
      },
      claim: (o?: { channelId?: string; actorId?: string }) => {
        if (!channelBag) return { ok: false, error: "通道未就绪" };
        const cid = o?.channelId || channelId;
        const actor = o?.actorId || opts?.eventUserId || "";
        const cfg = channelBag.getCfg();
        const prev = getChannelSettings(cfg, cid);
        const r = claimFirstMaster(prev, actor);
        if (!r.ok) return { ok: false, error: r.error };
        channelBag.setCfg({
          channels: { ...cfg.channels, [cid]: r.settings },
        });
        channelBag.save();
        return { ok: true };
      },
      add: (targetId, level, o) => {
        if (!channelBag) return { ok: false, error: "通道未就绪" };
        const cid = o?.channelId || channelId;
        const actor = o?.actorId || opts?.eventUserId || "";
        const cfg = channelBag.getCfg();
        const prev = getChannelSettings(cfg, cid);
        const r = addChannelMaster(prev, actor, targetId, level as MasterLevel);
        if (!r.ok) return { ok: false, error: r.error };
        channelBag.setCfg({
          channels: { ...cfg.channels, [cid]: r.settings },
        });
        channelBag.save();
        return { ok: true };
      },
      remove: (targetId, o) => {
        if (!channelBag) return { ok: false, error: "通道未就绪" };
        const cid = o?.channelId || channelId;
        const actor = o?.actorId || opts?.eventUserId || "";
        const cfg = channelBag.getCfg();
        const prev = getChannelSettings(cfg, cid);
        const r = removeChannelMaster(prev, actor, targetId);
        if (!r.ok) return { ok: false, error: r.error };
        channelBag.setCfg({
          channels: { ...cfg.channels, [cid]: r.settings },
        });
        channelBag.save();
        return { ok: true };
      },
    },
  };

  if (onebotRef) {
    const bridge = onebotRef;
    ctx.ob11 = {
      call: (action, params, callOpts) =>
        bridge.callAction(action, params || {}, { botId: callOpts?.botId }),
      selfId: () => bridge.status().selfId,
      listBots: () => bridge.status().bots,
    };
  }

  return ctx;
}
