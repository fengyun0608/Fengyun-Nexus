#!/usr/bin/env node
/**
 * Fengyun Nexus boot — detect deps, build packages + Vite console, start gateway.
 */
import { existsSync, readFileSync } from "node:fs";
import { spawn, execSync } from "node:child_process";
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
  magenta: "\x1b[35m",
};

function bootLog(level, color, msg) {
  console.log(
    `${ANSI.gray}${new Date().toISOString().replace("T", " ").slice(0, 19)}${ANSI.reset} ${color}${ANSI.bold}${level.padEnd(5)}${ANSI.reset} ${msg}`,
  );
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

function which(bin) {
  try {
    execSync(isWin ? `where ${bin}` : `command -v ${bin}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function nodeMajor() {
  const m = process.versions.node.split(".")[0];
  return Number(m);
}

function run(args) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      // Termux/android-arm64: never fetch @pnpm/exe native binary
      NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS: "false",
    };
    const child = spawn(pnpmCmd, args, {
      cwd: root,
      stdio: "inherit",
      shell: isWin,
      env,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pnpm ${args.join(" ")} exited ${code}`));
    });
  });
}

async function detectDeps() {
  bootLog("INFO", ANSI.cyan, "── dependency check ──");
  if (nodeMajor() < 20) {
    throw new Error(`Node.js >= 20 required (got ${process.versions.node})`);
  }
  bootLog("OK", ANSI.green, `node ${process.versions.node}`);

  if (isTermux()) {
    process.env.NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS = "false";
    bootLog("OK", ANSI.green, "Termux: skip pnpm native binary switch");
  }

  if (!which("pnpm") && !which("pnpm.cmd")) {
    bootLog("WARN", ANSI.yellow, "pnpm not found — try: npm i -g pnpm@9.15.0");
    throw new Error("pnpm is required");
  }
  bootLog("OK", ANSI.green, "pnpm available");

  if (!which("git") && !which("git.exe")) {
    bootLog("WARN", ANSI.yellow, "git not found (optional for plugin updates)");
  } else {
    bootLog("OK", ANSI.green, "git available");
  }

  if (!existsSync(join(root, "node_modules"))) {
    bootLog("INFO", ANSI.cyan, "installing workspace dependencies…");
    await run(["install"]);
    bootLog("OK", ANSI.green, "dependencies installed");
  } else {
    bootLog("OK", ANSI.green, "node_modules present");
  }
}

async function ensureBuild() {
  const sharedDist = join(root, "packages/shared/dist/index.js");
  const dbDist = join(root, "packages/db/dist/index.js");
  const loaderDist = join(root, "packages/plugin-loader/dist/index.js");
  if (!existsSync(sharedDist) || !existsSync(dbDist) || !existsSync(loaderDist)) {
    bootLog("INFO", ANSI.cyan, "building internal packages…");
    await run(["run", "build:packages"]);
    bootLog("OK", ANSI.green, "packages built");
  } else {
    bootLog("OK", ANSI.green, "packages ready");
  }

  const webDist = join(root, "apps/web/dist/index.html");
  if (!existsSync(webDist)) {
    bootLog("INFO", ANSI.cyan, "building Vite console…");
    await run(["--filter", "@fengyun/nexus-web", "build"]);
    bootLog("OK", ANSI.green, "console built → apps/web/dist");
  } else {
    bootLog("OK", ANSI.green, "Vite console dist ready");
  }
}

async function main() {
  loadDotEnv();
  bootLog("INFO", ANSI.magenta, "Fengyun Nexus 启动器");

  if (!process.env.NEXUS_ENV) {
    const hint = runtimeEnv();
    if (hint) process.env.NEXUS_ENV = hint;
    else if (isTermux()) process.env.NEXUS_ENV = "termux";
    else process.env.NEXUS_ENV = "desktop";
  }

  await detectDeps();
  await ensureBuild();

  const port = process.env.PORT || "8787";
  bootLog("OK", ANSI.green, `姿态=${process.env.NEXUS_ENV}`);
  bootLog("INFO", ANSI.cyan, `即将拉起网关 → 先连数据库，再刷初始化日志`);
  bootLog("INFO", ANSI.cyan, `控制台 http://127.0.0.1:${port}/`);
  bootLog("INFO", ANSI.cyan, "初始账号 console / console  |  或: pnpm nexus setup");

  await run(["--filter", "@fengyun/nexus-gateway", "dev"]);
}

main().catch((e) => {
  const msg = e.message || String(e);
  bootLog("ERROR", ANSI.red, msg);
  if (/PNPM_ENGINE_NO_NATIVE_BINARY|android-arm64|@pnpm\/exe/i.test(msg)) {
    bootLog(
      "INFO",
      ANSI.cyan,
      "Termux 提示：这是 pnpm 去拉原生二进制失败。请执行：",
    );
    bootLog("INFO", ANSI.cyan, "  npm install -g pnpm@9.15.0");
    bootLog("INFO", ANSI.cyan, "  echo manage-package-manager-versions=false >> .npmrc");
    bootLog("INFO", ANSI.cyan, "  ./boot.sh");
    bootLog(
      "INFO",
      ANSI.cyan,
      "或一键重装环境：curl -fsSL https://gitcode.com/fengyunnb_admin/Fengyun-Nexus/raw/main/scripts/termux-env.sh | bash",
    );
  }
  process.exit(1);
});
