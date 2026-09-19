#!/usr/bin/env node
/**
 * 冒烟：另开一个端口拉起网关，确认能听，并且 #帮助 有回。
 * 不占用日常的 8787。
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = String(process.env.NEXUS_SMOKE_PORT || "8791");
const base = `http://127.0.0.1:${port}`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const child = spawn(
  process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "pnpm",
  process.platform === "win32"
    ? ["/d", "/s", "/c", "pnpm --filter @fengyun/nexus-gateway start"]
    : ["--filter", "@fengyun/nexus-gateway", "start"],
  {
    cwd: root,
    env: {
      ...process.env,
      PORT: port,
      HOST: "127.0.0.1",
      NEXUS_BOOT_FAST: "1",
      NEXUS_OPEN_PORT: "0",
    },
    detached: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);

let logBuf = "";
child.stdout?.on("data", (b) => {
  logBuf += String(b);
});
child.stderr?.on("data", (b) => {
  logBuf += String(b);
});

function stop() {
  const pid = child.pid;
  if (!pid) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
      detached: true,
    });
    killer.unref();
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

async function waitUp() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) {
      throw new Error(`网关提前退出 ${child.exitCode}\n${logBuf.slice(-800)}`);
    }
    try {
      const res = await fetch(`${base}/v1/meta`);
      if (res.ok) return;
    } catch {
      /* 还没听上 */
    }
    await sleep(500);
  }
  throw new Error(`超时还没听上 ${base}\n${logBuf.slice(-800)}`);
}

async function askHelp() {
  const res = await fetch(`${base}/v1/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      content: "#帮助",
      chatId: "smoke",
      userId: "smoke",
    }),
    signal: AbortSignal.timeout(70_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`#帮助 HTTP ${res.status} ${text.slice(0, 300)}`);
  if (!/框架菜单|#关机|CQ:image|出错了/.test(text)) {
    throw new Error(`#帮助 没有像样的回执：${text.slice(0, 400)}`);
  }
}

try {
  await waitUp();
  await askHelp();
  console.log(`冒烟通过：${base} 已听，#帮助 有回`);
  try {
    child.stdout?.destroy();
    child.stderr?.destroy();
  } catch {
    /* 管道已关 */
  }
  child.unref();
  stop();
  await sleep(400);
  process.exitCode = 0;
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  stop();
  process.exit(1);
}
