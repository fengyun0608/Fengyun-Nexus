#!/usr/bin/env node
/**
 * One-shot boot: install (if needed) → build packages → start gateway + web.
 * Personal configs (*.local.json, .env) are never part of this script's upload path.
 */
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const pnpmCmd = isWin ? "pnpm.cmd" : "pnpm";

function run(args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(pnpmCmd, args, {
      cwd: root,
      stdio: "inherit",
      shell: isWin,
      env: process.env,
      ...opts,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pnpm ${args.join(" ")} exited ${code}`));
    });
  });
}

async function main() {
  if (!existsSync(join(root, "node_modules"))) {
    console.log("[Nexus] 首次启动：安装依赖…");
    await run(["install"]);
  }

  const sharedDist = join(root, "packages/shared/dist/index.js");
  if (!existsSync(sharedDist)) {
    console.log("[Nexus] 编译内部包…");
    await run(["run", "build:packages"]);
  }

  console.log("[Nexus] 启动网关 + 控制台…");
  console.log("[Nexus] 浏览器打开 http://127.0.0.1:5173");
  console.log("[Nexus] 管理初始账号 console / console（首次登录后请改密）");
  await run(["run", "dev:all"]);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
