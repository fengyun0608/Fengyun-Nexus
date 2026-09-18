/**
 * 按运行姿态自动放行网关 TCP 端口（防火墙）。
 * 仅在 server / 监听 0.0.0.0 时尝试；失败不挡启动。
 * 关闭：NEXUS_OPEN_PORT=0
 */
import { execFileSync } from "node:child_process";
import { platform } from "node:os";

export type OpenPortResult = {
  attempted: boolean;
  ok: boolean;
  skipped?: boolean;
  message: string;
};

function sh(bin: string, args: string[], opts?: { timeout?: number }): { ok: boolean; out: string } {
  try {
    const out = execFileSync(bin, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: opts?.timeout ?? 15_000,
      windowsHide: true,
    });
    return { ok: true, out: String(out || "").trim() };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const out = `${err.stdout || ""}${err.stderr || err.message || ""}`.trim();
    return { ok: false, out };
  }
}

function which(bin: string): boolean {
  if (platform() === "win32") {
    return sh("where", [bin]).ok;
  }
  return sh("sh", ["-c", `command -v ${bin}`]).ok;
}

function shouldOpen(envId: string, host: string): boolean {
  if (process.env.NEXUS_OPEN_PORT === "0" || process.env.NEXUS_OPEN_PORT === "false") {
    return false;
  }
  if (process.env.NEXUS_OPEN_PORT === "1" || process.env.NEXUS_OPEN_PORT === "true") {
    return true;
  }
  const h = String(host || "").trim().toLowerCase();
  if (h === "0.0.0.0" || h === "::" || h === "[::]") return true;
  return String(envId || "").toLowerCase() === "server";
}

function openWindows(port: number): OpenPortResult {
  const name = `Fengyun Nexus ${port}`;
  const check = sh("netsh", ["advfirewall", "firewall", "show", "rule", `name=${name}`]);
  if (check.ok && /启用|Yes|Enabled/i.test(check.out)) {
    return { attempted: true, ok: true, skipped: true, message: `防火墙规则已存在：${name}` };
  }
  // 先删同名旧规则再加，避免半残规则
  sh("netsh", ["advfirewall", "firewall", "delete", "rule", `name=${name}`]);
  const add = sh("netsh", [
    "advfirewall",
    "firewall",
    "add",
    "rule",
    `name=${name}`,
    "dir=in",
    "action=allow",
    "protocol=TCP",
    `localport=${port}`,
    "profile=any",
  ]);
  if (add.ok) {
    return { attempted: true, ok: true, message: `已开放入站 TCP ${port}（Windows 防火墙）` };
  }
  return {
    attempted: true,
    ok: false,
    message: `开放端口失败（可能需要管理员权限）：${add.out.slice(0, 160) || "netsh 失败"}`,
  };
}

function openLinux(port: number): OpenPortResult {
  if (which("firewall-cmd")) {
    const add = sh("firewall-cmd", [`--add-port=${port}/tcp`, "--permanent"]);
    sh("firewall-cmd", ["--reload"]);
    if (add.ok || /ALREADY_ENABLED/i.test(add.out)) {
      return { attempted: true, ok: true, message: `已开放入站 TCP ${port}（firewalld）` };
    }
    return {
      attempted: true,
      ok: false,
      message: `firewalld 放行失败：${add.out.slice(0, 160) || "无权限"}`,
    };
  }
  if (which("ufw")) {
    const status = sh("ufw", ["status"]);
    if (status.ok && /inactive|未启用/i.test(status.out)) {
      return {
        attempted: true,
        ok: true,
        skipped: true,
        message: "ufw 未启用，跳过放行（监听已对公网开放时由系统决定）",
      };
    }
    const add = sh("ufw", ["allow", `${port}/tcp`, "comment", "Fengyun Nexus"]);
    if (add.ok || /Skipping|existing|已存在/i.test(add.out)) {
      return { attempted: true, ok: true, message: `已开放入站 TCP ${port}（ufw）` };
    }
    return {
      attempted: true,
      ok: false,
      message: `ufw 放行失败：${add.out.slice(0, 160) || "无权限"}`,
    };
  }
  return {
    attempted: true,
    ok: true,
    skipped: true,
    message: "未检测到 firewalld/ufw，跳过自动放行",
  };
}

/**
 * 检测环境后尝试开放网关端口。
 * desktop / 仅本机监听默认不开放；server 或 0.0.0.0 会试。
 */
export function ensureGatewayPortOpen(opts: {
  envId: string;
  host: string;
  port: number;
}): OpenPortResult {
  const port = Math.floor(Number(opts.port) || 0);
  if (port < 1 || port > 65535) {
    return { attempted: false, ok: false, skipped: true, message: "端口无效，跳过" };
  }
  if (!shouldOpen(opts.envId, opts.host)) {
    return {
      attempted: false,
      ok: true,
      skipped: true,
      message: "本机姿态或仅监听本地，跳过防火墙放行",
    };
  }

  const os = platform();
  if (os === "win32") return openWindows(port);
  if (os === "linux") return openLinux(port);
  return {
    attempted: false,
    ok: true,
    skipped: true,
    message: `当前系统 ${os} 不自动改防火墙`,
  };
}
