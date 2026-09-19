#!/usr/bin/env node
/**
 * 容器入口：配置卷是空的就铺一份默认配置，再交给 boot.mjs。
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";

const root = process.env.NEXUS_ROOT || "/app";
const defaults = "/opt/nexus-defaults/configs";
const dest = join(root, "configs");

if (existsSync(defaults) && !existsSync(join(dest, "admin.default.json"))) {
  mkdirSync(dest, { recursive: true });
  cpSync(defaults, dest, { recursive: true });
  console.log("已写入默认配置");
}

process.env.NEXUS_ENV = process.env.NEXUS_ENV || "server";
process.env.NEXUS_OPEN_PORT = process.env.NEXUS_OPEN_PORT || "0";

const child = spawn(process.execPath, [join(root, "scripts/boot.mjs")], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 1);
});
