#!/usr/bin/env node
/**
 * One-shot boot for desktop / server / Termux.
 * Loads local .env + runtime.local.json (never uploaded).
 */
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const pnpmCmd = isWin ? "pnpm.cmd" : "pnpm";

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

  const argMode = process.argv[2];
  if (argMode === "lite" || argMode === "full") {
    process.env.NEXUS_BOOT_MODE = argMode;
  }

  if (!process.env.NEXUS_ENV) {
    const hint = runtimeEnv();
    if (hint) process.env.NEXUS_ENV = hint;
    else if (isTermux()) process.env.NEXUS_ENV = "termux";
  }

  const mode =
    process.env.NEXUS_BOOT_MODE ||
    (isTermux() || process.env.NEXUS_ENV === "termux" || process.env.NEXUS_ENV === "server"
      ? "lite"
      : "full");

  if (!existsSync(join(root, "node_modules"))) {
    console.log("[Nexus] 首次启动：安装依赖…");
    await run(["install"]);
  }

  const sharedDist = join(root, "packages/shared/dist/index.js");
  if (!existsSync(sharedDist)) {
    console.log("[Nexus] 编译内部包…");
    await run(["run", "build:packages"]);
  }

  const port = process.env.PORT || "8787";
  console.log(`[Nexus] 姿态=${process.env.NEXUS_ENV || "desktop"} 模式=${mode}`);
  console.log(`[Nexus] 内置控制台 http://127.0.0.1:${port}/`);
  console.log("[Nexus] 初始账号 console / console；也可用: pnpm nexus setup");

  if (mode === "lite") {
    console.log("[Nexus] 精简启动：仅网关（适合 Termux / 服务器）");
    await run(["--filter", "@fengyun/nexus-gateway", "dev"]);
  } else {
    console.log("[Nexus] 完整启动：网关 + Web 开发界面 http://127.0.0.1:5173");
    await run(["run", "dev:all"]);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
