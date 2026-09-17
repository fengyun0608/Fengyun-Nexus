#!/usr/bin/env node
/**
 * One console only: gateway serves the unique control UI at :8787
 */
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const pnpmCmd = isWin ? "pnpm.cmd" : "pnpm";

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

function bootLog(level, color, msg) {
  console.log(`${ANSI.gray}${new Date().toISOString().replace("T", " ").slice(0, 19)}${ANSI.reset} ${color}${ANSI.bold}${level.padEnd(5)}${ANSI.reset} ${msg}`);
}

function loadDotEnv() {
  for (const name of [".env", ".env.local"]) {
    const p = join(root, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i <= 0) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

function isTermux() {
  return Boolean(
    process.env.TERMUX_VERSION ||
      process.env.PREFIX?.includes("com.termux") ||
      process.env.NEXUS_FORCE_TERMUX === "1",
  );
}

function runtimeEnv() {
  const p = join(root, "configs/runtime.local.json");
  if (!existsSync(p)) return undefined;
  try {
    return JSON.parse(readFileSync(p, "utf8")).env;
  } catch {
    return undefined;
  }
}

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(pnpmCmd, args, {
      cwd: root,
      stdio: "inherit",
      shell: isWin,
      env: process.env,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pnpm ${args.join(" ")} exited ${code}`));
    });
  });
}

async function main() {
  loadDotEnv();

  if (!process.env.NEXUS_ENV) {
    const hint = runtimeEnv();
    if (hint) process.env.NEXUS_ENV = hint;
    else if (isTermux()) process.env.NEXUS_ENV = "termux";
    else process.env.NEXUS_ENV = "desktop";
  }

  if (!existsSync(join(root, "node_modules"))) {
    bootLog("INFO", ANSI.cyan, "首次启动：安装依赖…");
    await run(["install"]);
  }

  const sharedDist = join(root, "packages/shared/dist/index.js");
  if (!existsSync(sharedDist)) {
    bootLog("INFO", ANSI.cyan, "编译内部包…");
    await run(["run", "build:packages"]);
  }

  const port = process.env.PORT || "8787";
  bootLog("OK", ANSI.green, `姿态=${process.env.NEXUS_ENV}`);
  bootLog("INFO", ANSI.cyan, `控制台（唯一） http://127.0.0.1:${port}/`);
  bootLog("INFO", ANSI.cyan, "初始账号 console / console  |  或: pnpm nexus setup");

  await run(["--filter", "@fengyun/nexus-gateway", "dev"]);
}

main().catch((e) => {
  bootLog("ERROR", ANSI.red, e.message || String(e));
  process.exit(1);
});
