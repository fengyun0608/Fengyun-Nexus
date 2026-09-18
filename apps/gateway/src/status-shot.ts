/**
 * #状态 / 重启成功图：统一拼运行信息行（再交给系统截图）。
 */
import { networkInterfaces } from "node:os";

export type StatusShotInput = {
  version: string;
  commit?: string;
  envId: string;
  envLabel: string;
  powerOff: boolean;
  uptime: string;
  gatewayPort?: number;
  onebot: {
    enabled: boolean;
    connected: boolean;
    selfId: string;
    clients: number;
  };
  ai: {
    hasKey: boolean;
    activeName?: string;
    model?: string;
  };
  pluginsEnabled: number;
  pluginsTotal: number;
  replyGroupIds: string[];
  notifyGroupIds: string[];
};

function localIpv4List(): string[] {
  const out: string[] = [];
  const nets = networkInterfaces();
  for (const list of Object.values(nets)) {
    if (!list) continue;
    for (const n of list) {
      if (n.family !== "IPv4" || n.internal) continue;
      out.push(n.address);
    }
  }
  return out;
}

function fmtGroups(ids: string[], empty: string): string {
  if (!ids.length) return empty;
  if (ids.length <= 3) return ids.join("、");
  return `${ids.slice(0, 3).join("、")} 等 ${ids.length} 个`;
}

/** #状态 图文行 */
export function buildStatusLines(s: StatusShotInput): string[] {
  const lines: string[] = [];
  lines.push(`框架 Fengyun Nexus ${s.version}`);
  if (s.commit) lines.push(`提交 ${s.commit}`);
  lines.push(`姿态 ${s.envLabel}（${s.envId}）`);
  lines.push(s.powerOff ? "电源 已关机" : `电源 运行中 · ${s.uptime}`);

  const ips = localIpv4List();
  if (s.gatewayPort) {
    lines.push(
      ips.length
        ? `网络 本机 ${ips[0]} · 网关 :${s.gatewayPort}`
        : `网络 网关 :${s.gatewayPort}`,
    );
  } else if (ips.length) {
    lines.push(`网络 本机 ${ips[0]}`);
  }

  if (s.onebot.enabled) {
    lines.push(
      s.onebot.connected
        ? `OneBot 已连接 · QQ ${s.onebot.selfId || "—"} · ${s.onebot.clients} 路`
        : `OneBot 未连接 · QQ ${s.onebot.selfId || "—"}`,
    );
  } else {
    lines.push("OneBot 未启用");
  }

  if (s.ai.hasKey) {
    const name = s.ai.activeName || "已配置";
    lines.push(s.ai.model ? `AI ${name} · ${s.ai.model}` : `AI ${name}`);
  } else {
    lines.push("AI 未配置密钥");
  }

  lines.push(`插件 ${s.pluginsEnabled}/${s.pluginsTotal} 已启用`);
  lines.push(`AI 回复群 ${fmtGroups(s.replyGroupIds, "不限")}`);
  lines.push(`通知群 ${fmtGroups(s.notifyGroupIds, "无")}`);
  return lines;
}

/** 重启成功 · 插件加载报告行（再渲成图） */
export function buildRestartOkLines(
  plugins: Array<{ id: string; name: string; version?: string }>,
  opts?: { previousUptime?: string; version?: string; commit?: string },
): string[] {
  const lines: string[] = ["重启成功"];
  if (opts?.version) lines.push(`框架 ${opts.version}`);
  if (opts?.commit) lines.push(`提交 ${opts.commit}`);
  if (opts?.previousUptime) lines.push(`上次运行 ${opts.previousUptime}`);
  lines.push("本次加载插件");
  if (!plugins.length) {
    lines.push("· 无");
  } else {
    for (const p of plugins) {
      const ver = p.version ? ` @${p.version}` : "";
      lines.push(`· ${p.name}${ver}`);
    }
  }
  lines.push(`共 ${plugins.length} 个`);
  return lines;
}
