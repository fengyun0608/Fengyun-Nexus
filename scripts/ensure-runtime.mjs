#!/usr/bin/env node
/**
 * 一键安装后：确保 PM2 可用，并按机型安装 NapCat（可跳过）。
 * 用法：node scripts/ensure-runtime.mjs [--skip-napcat] [--pm2-only]
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const args = new Set(process.argv.slice(2));
const skipNapcat =
  args.has("--skip-napcat") ||
  process.env.NEXUS_SKIP_NAPCAT === "1" ||
  args.has("--pm2-only");

function log(msg) {
  console.log(`>>> ${msg}`);
}
function ok(msg) {
  console.log(`OK  ${msg}`);
}
function warn(msg) {
  console.log(`!!  ${msg}`);
}

function which(bin) {
  try {
    execSync(isWin ? `where ${bin}` : `command -v ${bin}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function ensurePm2() {
  if (which("pm2")) {
    ok(`PM2 已就绪  ${(execSync("pm2 -v", { encoding: "utf8" }) || "").trim()}`);
    return true;
  }
  log("安装 PM2（npm i -g pm2）…");
  try {
    execSync("npm install -g pm2", { stdio: "inherit", cwd: root });
  } catch (e) {
    warn(`PM2 安装失败：${e instanceof Error ? e.message : e}`);
    return false;
  }
  if (!which("pm2")) {
    warn("PM2 仍不可用（PATH 未刷新时可重开终端）");
    return false;
  }
  ok("PM2 已安装");
  return true;
}

function ensureNapCat() {
  if (skipNapcat) {
    ok("已跳过 NapCat（NEXUS_SKIP_NAPCAT / --skip-napcat）");
    return true;
  }
  const runner = join(root, "scripts", "install-napcat-once.ts");
  if (!existsSync(runner)) {
    warn("缺少 install-napcat-once.ts，跳过 NapCat");
    return false;
  }
  log("按机型安装 NapCat…");
  const r = spawnSync(
    isWin ? "pnpm.cmd" : "pnpm",
    ["exec", "tsx", runner],
    { cwd: root, stdio: "inherit", shell: isWin, env: process.env },
  );
  if ((r.status ?? 1) !== 0) {
    warn("NapCat 安装未完全成功；框架仍可启动，稍后可用 nexus desk / 环境配置重试");
    return false;
  }
  ok("NapCat 已就绪");
  return true;
}

function writeStamp(pm2Ok, ncOk) {
  const dir = join(root, "data");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "runtime-ensure.json"),
    `${JSON.stringify(
      {
        at: new Date().toISOString(),
        pm2: pm2Ok,
        napcat: ncOk,
        skipNapcat,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

const pm2Ok = ensurePm2();
const ncOk = ensureNapCat();
writeStamp(pm2Ok, ncOk);
if (!pm2Ok) process.exitCode = 2;
