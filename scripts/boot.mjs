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
    console.log("[Nexus] Installing dependencies...");
    await run(["install"]);
  }

  const sharedDist = join(root, "packages/shared/dist/index.js");
  if (!existsSync(sharedDist)) {
    console.log("[Nexus] Building packages...");
    await run(["run", "build:packages"]);
  }

  const port = process.env.PORT || "8787";
  console.log(`[Nexus] env=${process.env.NEXUS_ENV}`);
  console.log(`[Nexus] Console (only)  http://127.0.0.1:${port}/`);
  console.log("[Nexus] Login bootstrap: console / console  |  or: pnpm nexus setup");

  await run(["--filter", "@fengyun/nexus-gateway", "dev"]);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
