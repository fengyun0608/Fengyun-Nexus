/**
 * 启动台 / NapCat PM2 指令（供 CLI 调用）
 *   pnpm exec tsx scripts/nexus-ops.ts desk [qq] [port]
 *   pnpm exec tsx scripts/nexus-ops.ts nc start|stop|logs|status
 */
import { createInterface, type Interface } from "node:readline";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync, execSync } from "node:child_process";
import {
  buildReverseWsUrl,
  tryLaunchNapCat,
  stopNapCatPm2,
  getNapCatPm2Logs,
  getNapCatPm2Status,
  wireNapCatConfigs,
  wireNapCatForAccount,
  readNapCatMarker,
  napcatHome,
  ensureNapCatLaunchScripts,
} from "../apps/gateway/src/napcat-setup.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const ONEBOT_LOCAL = join(root, "configs/onebot.local.json");
const ONEBOT_DEFAULT = join(root, "configs/onebot.default.json");
const [cmd, ...rest] = process.argv.slice(2);

function ask(rl: Interface, q: string, def = ""): Promise<string> {
  const tip = def ? `${q}（默认 ${def}）: ` : `${q}: `;
  return new Promise((resolveAsk) => {
    rl.question(tip, (ans) => resolveAsk((ans || def).trim()));
  });
}

function readJson<T>(p: string, fallback: T): T {
  if (!existsSync(p)) return fallback;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(p: string, data: unknown): void {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function hasPm2(): boolean {
  try {
    execSync(isWin ? "where pm2" : "command -v pm2", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function ensurePm2(): boolean {
  if (hasPm2()) return true;
  console.log(">>> 安装 PM2…");
  const r = spawnSync(process.execPath, [join(root, "scripts/ensure-runtime.mjs"), "--pm2-only"], {
    cwd: root,
    stdio: "inherit",
  });
  return (r.status ?? 1) === 0 && hasPm2();
}

function startFramework(): void {
  spawnSync(process.execPath, [join(root, "scripts/pm2-nexus.mjs"), "start"], {
    cwd: root,
    stdio: "inherit",
  });
}

function writeOneBotDesk(qq: string, port: number): string {
  const base = readJson<Record<string, unknown>>(
    existsSync(ONEBOT_LOCAL) ? ONEBOT_LOCAL : ONEBOT_DEFAULT,
    {
      enabled: true,
      accessToken: "",
      reverseWsPath: "/onebot/v11/ws",
      httpPath: "/onebot/v11/http",
      bots: [],
    },
  );
  const bots = Array.isArray(base.bots) ? [...(base.bots as object[])] : [];
  const idx = bots.findIndex(
    (b) =>
      String((b as { selfId?: string }).selfId || "") === qq ||
      !(b as { selfId?: string }).selfId,
  );
  const bot = {
    selfId: qq,
    label: "主号",
    listenPort: port,
    apiBase: "",
    accessToken: "",
  };
  if (idx >= 0) bots[idx] = { ...(bots[idx] as object), ...bot };
  else bots.unshift(bot);
  const next = {
    ...base,
    enabled: true,
    reverseWsPath: String(base.reverseWsPath || "/onebot/v11/ws"),
    httpPath: String(base.httpPath || "/onebot/v11/http"),
    bots,
  };
  writeJson(ONEBOT_LOCAL, next);
  const url = buildReverseWsUrl({
    port,
    path: String(next.reverseWsPath || "/onebot/v11/ws"),
  });
  try {
    ensureNapCatLaunchScripts(root);
  } catch {
    /* ignore */
  }
  const home = readNapCatMarker(root)?.home || napcatHome(root);
  mkdirSync(home, { recursive: true });
  wireNapCatConfigs(home, url, "");
  wireNapCatForAccount(root, qq, url, "");
  return url;
}

function followLogs(name: string, lines = 80): void {
  if (!hasPm2()) {
    console.log("未安装 PM2");
    return;
  }
  console.log("");
  console.log("—— 跟随日志（Ctrl+C 只退出日志，不停止后台）——");
  console.log("扫码页一般在 http://127.0.0.1:6099/webui");
  console.log("");
  const child = spawn(isWin ? "pm2.cmd" : "pm2", ["logs", name, "--lines", String(lines)], {
    cwd: root,
    stdio: "inherit",
    shell: isWin,
    env: process.env,
  });
  child.on("exit", () => {
    console.log("");
    console.log("OK  后台仍在跑。nexus logs -f · nexus nc logs -f");
  });
}

async function desk(qqArg?: string, portArg?: string): Promise<void> {
  console.log("");
  console.log("=== Fengyun Nexus · 启动台 ===");
  console.log("填 QQ 与端口 → 自动写好 OneBot / NapCat → PM2 后台启框架与 NC");
  console.log("");

  if (!ensurePm2()) {
    throw new Error("PM2 不可用。也可 NEXUS_FOREGROUND=1 ./boot.sh");
  }
  startFramework();

  const prev = readJson<{ bots?: Array<{ selfId?: string; listenPort?: number }> }>(ONEBOT_LOCAL, {});
  const prevBot = prev.bots?.find((b) => b.selfId) || prev.bots?.[0];
  let qq = String(qqArg || "").trim();
  let port = Math.floor(Number(portArg) || 0);

  if (!qq || !port) {
    if (!process.stdin.isTTY) {
      if (prevBot?.selfId && Number(prevBot.listenPort) > 0) {
        qq = String(prevBot.selfId);
        port = Math.floor(Number(prevBot.listenPort));
        console.log(`非交互：沿用 QQ=${qq} 端口=${port}`);
      } else {
        console.log("非交互且无 QQ。请执行：nexus desk");
        console.log(`控制台：http://127.0.0.1:${process.env.PORT || 8787}/`);
        return;
      }
    } else {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try {
        qq = qq || (await ask(rl, "机器人 QQ", prevBot?.selfId || ""));
        const portDef = String(prevBot?.listenPort || process.env.PORT || 8787);
        const portAns = await ask(rl, "反向 WS 端口（框架监听）", portDef);
        port = Math.floor(Number(portAns) || Number(portDef) || 8787);
      } finally {
        rl.close();
      }
    }
  }

  if (!/^\d{5,12}$/.test(qq)) throw new Error("QQ 号须为 5–12 位数字");
  if (!(port > 0 && port < 65536)) throw new Error("端口不合法");

  const url = writeOneBotDesk(qq, port);
  console.log(`OK  已写入配置  QQ=${qq}  反向=${url}`);

  const launch = tryLaunchNapCat(root);
  console.log(launch.message);
  if (launch.webuiUrl) console.log(`扫码：${launch.webuiUrl}`);

  if (process.env.NEXUS_DESK_NO_FOLLOW === "1") {
    console.log("已跳过跟日志。可用：nexus nc logs -f");
    return;
  }
  followLogs("nexus-napcat", 100);
}

async function nc(action: string, extra: string[]): Promise<void> {
  if (action === "start") {
    const r = tryLaunchNapCat(root);
    console.log(r.message);
    if (r.webuiUrl) console.log(r.webuiUrl);
    if (!r.ok) process.exit(1);
    return;
  }
  if (action === "stop") {
    const r = stopNapCatPm2();
    console.log(r.message);
    if (!r.ok) process.exit(1);
    return;
  }
  if (action === "status") {
    const s = getNapCatPm2Status();
    console.log(
      s.available ? `${s.name} · ${s.status}${s.pid ? ` · pid ${s.pid}` : ""}` : "未安装 PM2",
    );
    return;
  }
  if (action === "logs") {
    if (extra.includes("-f") || extra.includes("--follow")) {
      followLogs("nexus-napcat", 80);
      return;
    }
    const n = Number(extra.find((x) => /^\d+$/.test(x)) || 80);
    const r = getNapCatPm2Logs(n);
    console.log(r.logs || r.message);
    if (!r.ok) process.exit(1);
    return;
  }
  console.error("用法：nexus nc start|stop|logs|status");
  process.exit(1);
}

async function main() {
  if (cmd === "desk") {
    await desk(rest[0], rest[1]);
    return;
  }
  if (cmd === "nc") {
    await nc(rest[0] || "status", rest.slice(1));
    return;
  }
  console.error("用法：tsx scripts/nexus-ops.ts desk|nc …");
  process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
