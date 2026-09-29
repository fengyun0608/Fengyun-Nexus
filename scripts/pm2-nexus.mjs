#!/usr/bin/env node
/**
 * PM2 启停框架 / 读日志（供 CLI 与 boot 薄封装共用）。
 * 用法：
 *   node scripts/pm2-nexus.mjs start|stop|restart|logs|status [lines]
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, spawn, spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
export const NEXUS_PM2_NAME = "nexus";
const ECO = join(root, "ecosystem.config.cjs");

function whichPm2() {
  try {
    const out = execSync(isWin ? "where pm2" : "command -v pm2", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
      .trim()
      .split(/\r?\n/)[0];
    return out || null;
  } catch {
    return null;
  }
}

function runPm2(args, inherit = false) {
  const bin = whichPm2();
  if (!bin) throw new Error("未安装 PM2。请先：npm i -g pm2  或 node scripts/ensure-runtime.mjs --pm2-only");
  if (inherit) {
    const r = spawnSync(bin, args, { cwd: root, stdio: "inherit", shell: isWin, env: process.env });
    return r.status ?? 1;
  }
  return execSync(`"${bin}" ${args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" ")}`, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
}

function jlist() {
  try {
    const raw = runPm2(["jlist"]);
    return JSON.parse(String(raw || "[]"));
  } catch {
    return [];
  }
}

function statusOf(name = NEXUS_PM2_NAME) {
  const list = jlist();
  const hit = list.find((p) => p?.name === name);
  if (!hit) return { name, online: false, status: "stopped", available: Boolean(whichPm2()), pid: undefined };
  const st = hit.pm2_env?.status || "unknown";
  return {
    name,
    online: st === "online",
    status: st,
    pid: hit.pid,
    available: true,
    restarts: hit.pm2_env?.restart_time,
  };
}

function start() {
  if (!existsSync(ECO)) throw new Error(`缺少 ${ECO}`);
  const st = statusOf();
  if (st.online) {
    console.log(`OK  ${NEXUS_PM2_NAME} 已在跑（pid ${st.pid || "?"}）`);
    return 0;
  }
  try {
    runPm2(["delete", NEXUS_PM2_NAME], false);
  } catch {
    /* no old */
  }
  console.log(`>>> PM2 启动 ${NEXUS_PM2_NAME}…`);
  const code = runPm2(["start", ECO], true);
  try {
    runPm2(["save"], false);
  } catch {
    /* ignore */
  }
  const after = statusOf();
  if (after.online) {
    const port = String(process.env.PORT || "8787").trim() || "8787";
    console.log(`OK  已后台运行  控制台 http://127.0.0.1:${port}/`);
    console.log(`    日志：pnpm nexus logs   停止：pnpm nexus stop`);
    return 0;
  }
  console.error(`!!  启动后状态：${after.status}`);
  return code || 1;
}

function stop() {
  try {
    runPm2(["stop", NEXUS_PM2_NAME], true);
    console.log(`OK  已停止 ${NEXUS_PM2_NAME}`);
    return 0;
  } catch {
    try {
      runPm2(["delete", NEXUS_PM2_NAME], true);
      console.log(`OK  已移除 ${NEXUS_PM2_NAME}`);
      return 0;
    } catch (e) {
      console.error(`!!  ${e instanceof Error ? e.message : e}`);
      return 1;
    }
  }
}

function restart() {
  const st = statusOf();
  if (!st.online && st.status === "stopped") return start();
  const code = runPm2(["restart", NEXUS_PM2_NAME], true);
  console.log(`OK  已重启 ${NEXUS_PM2_NAME}`);
  return code;
}

function logs(lines = 80, follow = false) {
  const n = Math.min(500, Math.max(20, Math.floor(Number(lines) || 80)));
  const bin = whichPm2();
  if (!bin) throw new Error("未安装 PM2");
  const args = follow
    ? ["logs", NEXUS_PM2_NAME, "--lines", String(n)]
    : ["logs", NEXUS_PM2_NAME, "--nostream", "--lines", String(n)];
  if (follow) {
    const child = spawn(bin, args, { cwd: root, stdio: "inherit", shell: isWin, env: process.env });
    child.on("exit", (c) => process.exit(c ?? 0));
    return;
  }
  return runPm2(args, true);
}

function printStatus() {
  if (!whichPm2()) {
    console.log("PM2: 未安装");
    return 1;
  }
  const st = statusOf();
  console.log(
    `框架 PM2: ${st.name} · ${st.status}${st.pid ? ` · pid ${st.pid}` : ""}${st.restarts != null ? ` · 重启 ${st.restarts}` : ""}`,
  );
  return 0;
}

const cmd = process.argv[2] || "status";
const a1 = process.argv[3];
const a2 = process.argv[4];

try {
  if (cmd === "start") process.exit(start());
  if (cmd === "stop") process.exit(stop());
  if (cmd === "restart") process.exit(restart());
  if (cmd === "status") process.exit(printStatus());
  if (cmd === "logs") {
    const follow = a1 === "-f" || a1 === "--follow" || a2 === "-f" || a2 === "--follow";
    let lines = 80;
    if (a1 && /^\d+$/.test(a1)) lines = Number(a1);
    else if (a2 && /^\d+$/.test(a2)) lines = Number(a2);
    const r = logs(lines, follow);
    if (typeof r === "number") process.exit(r);
    return;
  }
  console.error("用法：node scripts/pm2-nexus.mjs start|stop|restart|logs|status");
  process.exit(1);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
