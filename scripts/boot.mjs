#!/usr/bin/env node
/**
 * Fengyun Nexus boot — detect deps, build packages + Vite console, start gateway.
 */
import { existsSync, readFileSync, unlinkSync, cpSync, statSync, mkdirSync, readdirSync } from "node:fs";
import { spawn, execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";

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

function guessEnv() {
  if (process.env.NEXUS_ENV) return process.env.NEXUS_ENV;
  const hint = runtimeEnv();
  if (hint) return hint;
  if (isTermux()) return "termux";
  if (process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    return "server";
  }
  return "desktop";
}

function which(bin) {
  try {
    execSync(isWin ? `where ${bin}` : `command -v ${bin}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** 新拷进来的插件常缺 node_modules/@fengyun/* 链接，加载会报 Cannot find package */
function pluginsMissingSdkLinks() {
  const pluginsRoot = join(root, "plugins");
  if (!existsSync(pluginsRoot)) return false;
  for (const name of readdirSync(pluginsRoot)) {
    if (name === "templates" || name.startsWith(".")) continue;
    const dir = join(pluginsRoot, name);
    const pkgPath = join(dir, "package.json");
    if (!existsSync(pkgPath)) continue;
    let deps = {};
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    } catch {
      continue;
    }
    if (!deps["@fengyun/nexus-plugin-sdk"]) continue;
    if (!existsSync(join(dir, "node_modules", "@fengyun", "nexus-plugin-sdk"))) {
      return true;
    }
  }
  return false;
}

function nodeMajor() {
  const m = process.versions.node.split(".")[0];
  return Number(m);
}

/** cmd.exe 参数转义（Node 24 不能直接 spawn .cmd，且 shell:true 会触发 DEP0190） */
function escapeCmdArg(arg) {
  const s = String(arg);
  if (!/[ \t"&<>|^()%!]/.test(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * 拉起 pnpm。Windows 走 cmd.exe /d /s /c，避免 Node 24 对 .cmd 报 spawn EINVAL。
 */
function spawnPnpm(args, extra = {}) {
  const env = {
    ...process.env,
    // Termux/android-arm64: never fetch @pnpm/exe native binary
    NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS: "false",
    ...(extra.env || {}),
  };
  const opts = {
    cwd: root,
    stdio: "inherit",
    shell: false,
    env,
    windowsHide: true,
    ...extra,
    env,
    shell: false,
  };
  if (isWin) {
    const line = `"${["pnpm", ...args].map(escapeCmdArg).join(" ")}"`;
    return spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", line], {
      ...opts,
      windowsVerbatimArguments: true,
    });
  }
  return spawn("pnpm", args, opts);
}

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawnPnpm(args);
    child.on("error", (err) => {
      reject(
        new Error(
          `无法启动 pnpm：${err.message}（Node ${process.versions.node}${isWin ? " / Windows" : ""}）`,
        ),
      );
    });
    child.on("exit", (code) => {
      if (code === 0) resolve(0);
      else reject(new Error(`pnpm ${args.join(" ")} exited ${code}`));
    });
  });
}

/** Like run(), but returns exit code instead of throwing (for restart loop). */
function runCode(args) {
  return new Promise((resolve, reject) => {
    const child = spawnPnpm(args);
    child.on("error", (err) => {
      reject(
        new Error(
          `无法启动 pnpm：${err.message}（Node ${process.versions.node}${isWin ? " / Windows" : ""}）`,
        ),
      );
    });
    child.on("exit", (code, signal) => {
      if (signal) resolve(1);
      else resolve(code ?? 0);
    });
  });
}

function consumeRestartFlag() {
  const p = join(root, "data", "nexus-restart.flag");
  if (!existsSync(p)) return false;
  try {
    unlinkSync(p);
  } catch {
    /* ignore */
  }
  return true;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function detectDeps() {
  bootLog("INFO", ANSI.cyan, "[依赖]");
  if (nodeMajor() < 20) {
    throw new Error(`需要 Node.js 20 或更高（当前 ${process.versions.node}）`);
  }
  bootLog("OK", ANSI.green, `Node ${process.versions.node}`);

  if (isTermux()) {
    process.env.NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS = "false";
    bootLog("OK", ANSI.green, "Termux：已关闭 pnpm 原生二进制切换");
  }

  if (!which("pnpm") && !which("pnpm.cmd")) {
    bootLog("WARN", ANSI.yellow, "没找到 pnpm。请先执行：npm i -g pnpm@9.15.0");
    throw new Error("需要 pnpm");
  }
  bootLog("OK", ANSI.green, "pnpm");

  if (!which("git") && !which("git.exe")) {
    bootLog("WARN", ANSI.yellow, "没找到 git（#更新 会用到，可稍后装）");
  } else {
    bootLog("OK", ANSI.green, "git");
  }

  if (!existsSync(join(root, "node_modules"))) {
    bootLog("INFO", ANSI.cyan, "正在安装依赖…");
    await run(["install"]);
    bootLog("OK", ANSI.green, "依赖已装好");
  } else if (pluginsMissingSdkLinks()) {
    bootLog("INFO", ANSI.cyan, "检测到新插件未链接 SDK，正在 pnpm install…");
    await run(["install"]);
    bootLog("OK", ANSI.green, "插件依赖已链接");
  } else {
    bootLog("OK", ANSI.green, "依赖已就绪");
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
    bootLog("OK", ANSI.green, "内部包已就绪");
  }

  const webDistHtml = join(root, "apps/web/dist/index.html");
  const webSrcDir = join(root, "apps/web/src");
  const webMarkers = [
    join(root, "apps/web/src/App.vue"),
    join(root, "apps/web/src/layouts/AppShell.vue"),
    join(root, "apps/web/package.json"),
    join(root, "package.json"),
  ];
  let needWeb = !existsSync(webDistHtml);
  if (!needWeb) {
    try {
      const distM = statSync(webDistHtml).mtimeMs;
      needWeb = webMarkers.some((f) => existsSync(f) && statSync(f).mtimeMs > distM);
      if (!needWeb && existsSync(webSrcDir)) {
        needWeb = latestMtime(webSrcDir) > distM;
      }
    } catch {
      needWeb = true;
    }
  }
  if (needWeb || process.env.NEXUS_FORCE_WEB_BUILD === "1") {
    bootLog("INFO", ANSI.cyan, "building Vite console…");
    await run(["--filter", "@fengyun/nexus-web", "build"]);
    bootLog("OK", ANSI.green, "console built → apps/web/dist");
  } else {
    bootLog("OK", ANSI.green, "控制台已就绪");
  }

  // 同步到 gateway/public，避免启动时 dist 缺失仍用旧 public
  // Windows 上对中文路径做整树 rmSync/cpSync 偶发原生崩溃（0xC0000409），故：可跳过 / 可失败继续 / Win 优先 robocopy
  await syncConsolePublic();
}

/** 目录树最新 mtime（跳过 node_modules / dist） */
function latestMtime(p) {
  if (!existsSync(p)) return 0;
  try {
    const st = statSync(p);
    if (!st.isDirectory()) return st.mtimeMs;
    let max = st.mtimeMs;
    for (const name of readdirSync(p)) {
      if (name === "node_modules" || name === "dist" || name === ".git") continue;
      max = Math.max(max, latestMtime(join(p, name)));
    }
    return max;
  } catch {
    return 0;
  }
}

function consoleAlreadySynced(distDir, pubDir) {
  const distHtml = join(distDir, "index.html");
  const pubHtml = join(pubDir, "index.html");
  if (!existsSync(distHtml) || !existsSync(pubHtml)) return false;
  try {
    const ds = statSync(distHtml);
    const ps = statSync(pubHtml);
    // 体积与修改时间都对齐则认为已同步
    return ds.size === ps.size && Math.abs(ds.mtimeMs - ps.mtimeMs) < 2000;
  } catch {
    return false;
  }
}

function syncViaRobocopy(distDir, pubDir) {
  // robocopy 退出码 0–7 都算成功
  try {
    execSync(
      `robocopy "${distDir}" "${pubDir}" /E /NFL /NDL /NJH /NJS /nc /ns /np /R:2 /W:1`,
      { stdio: "ignore", windowsHide: true },
    );
    return existsSync(join(pubDir, "index.html"));
  } catch (e) {
    const code = typeof e?.status === "number" ? e.status : 16;
    return code < 8 && existsSync(join(pubDir, "index.html"));
  }
}

async function syncConsolePublic() {
  const distDir = join(root, "apps/web/dist");
  const pubDir = join(root, "apps/gateway/public");
  const distHtml = join(distDir, "index.html");
  const pubHtml = join(pubDir, "index.html");
  if (!existsSync(distHtml)) {
    bootLog("WARN", ANSI.yellow, "apps/web/dist 缺失，跳过同步 public");
    return;
  }

  // 仓库里的 public 比本地 dist 新（常见于 #更新只拉了 git）→ 禁止用旧 dist 覆盖，先强制重建
  if (existsSync(pubHtml)) {
    try {
      const distM = statSync(distHtml).mtimeMs;
      const pubM = statSync(pubHtml).mtimeMs;
      if (pubM > distM + 2000) {
        bootLog("INFO", ANSI.cyan, "gateway/public 比 dist 新，强制重建控制台以免盖掉更新…");
        await run(["--filter", "@fengyun/nexus-web", "build"]);
        bootLog("OK", ANSI.green, "console rebuilt → apps/web/dist");
      }
    } catch {
      /* ignore */
    }
  }

  if (consoleAlreadySynced(distDir, pubDir)) {
    bootLog("OK", ANSI.green, "控制台已同步");
    return;
  }

  bootLog("INFO", ANSI.cyan, "同步控制台 → apps/gateway/public …");
  try {
    if (isWin) {
      if (syncViaRobocopy(distDir, pubDir)) {
        bootLog("OK", ANSI.green, "console synced → apps/gateway/public");
        return;
      }
      bootLog("WARN", ANSI.yellow, "robocopy 未完成，改用 Node 复制");
    }
    // 不先整目录删除，降低 Windows 文件锁 / 杀软拦截导致的原生崩溃概率
    mkdirSync(pubDir, { recursive: true });
    cpSync(distDir, pubDir, { recursive: true, force: true });
    bootLog("OK", ANSI.green, "console synced → apps/gateway/public");
  } catch (e) {
    bootLog(
      "WARN",
      ANSI.yellow,
      `同步 public 失败（可继续启动）：${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

async function main() {
  loadDotEnv();
  bootLog("INFO", ANSI.magenta, "Fengyun Nexus 启动器");

  process.env.NEXUS_ENV = guessEnv();

  await detectDeps();
  await ensureBuild();

  bootLog("OK", ANSI.green, `姿态=${process.env.NEXUS_ENV}`);
  const showPort = String(process.env.PORT || "8787").trim() || "8787";
  bootLog("OK", ANSI.green, `控制台：http://127.0.0.1:${showPort}/`);

  // 正式启动用 start（无 watch）。开发热重载：NEXUS_DEV=1 或 pnpm --filter @fengyun/nexus-gateway dev
  const gatewayScript = process.env.NEXUS_DEV === "1" ? "dev" : "start";
  if (gatewayScript === "dev") {
    bootLog("WARN", ANSI.yellow, "NEXUS_DEV=1 → tsx watch 热重载；聊天写库勿误触需排除 data/");
  }

  // #重启 / 更新：网关退出码 75 或 data/nexus-restart.flag → 同窗口再拉起，不新开终端
  const RESTART_CODE = 75;
  for (;;) {
    const code = await runCode(["--filter", "@fengyun/nexus-gateway", gatewayScript]);
    const flagged = consumeRestartFlag();
    if (code === RESTART_CODE || flagged) {
      bootLog("OK", ANSI.green, "同窗口重启中…");
      await sleep(1200);
      continue;
    }
    if (code !== 0) {
      throw new Error(
        `pnpm --filter @fengyun/nexus-gateway ${gatewayScript} exited ${code}${formatWinCrashHint(code)}`,
      );
    }
    process.exit(0);
  }
}

/** Windows NTSTATUS 常见原生崩溃码 → 中文提示 */
function formatWinCrashHint(code) {
  if (!isWin || typeof code !== "number") return "";
  const u = code < 0 ? code >>> 0 : code;
  if (u === 0xc0000409 || code === -1073740791 || code === 3221226505) {
    return "（Windows 原生崩溃 0xC0000409：请关掉已开着的 Nexus 窗口后重试；若反复出现，可删 apps/gateway/public 再 start.bat）";
  }
  if (u === 0xc0000005) {
    return "（访问冲突 0xC0000005：检查杀软是否拦截 node/tsx）";
  }
  return "";
}

main().catch((e) => {
  const msg = e.message || String(e);
  bootLog("ERROR", ANSI.red, msg);
  if (/spawn EINVAL|无法启动 pnpm/i.test(msg)) {
    bootLog("INFO", ANSI.cyan, "处理建议：Node 24 需经 cmd 拉起 pnpm；已修复请再试 start.bat");
    bootLog("INFO", ANSI.cyan, "  或手动：pnpm --filter @fengyun/nexus-gateway start");
  }
  if (/0xC0000409|3221226505|-1073740791/i.test(msg)) {
    bootLog("INFO", ANSI.cyan, "处理建议：");
    bootLog("INFO", ANSI.cyan, "  1. 关掉所有 Fengyun Nexus / node 相关 CMD 窗口");
    bootLog("INFO", ANSI.cyan, "  2. 再双击 start.bat");
    bootLog("INFO", ANSI.cyan, "  3. 仍失败可执行：rd /s /q apps\\gateway\\public  然后重新 start.bat");
  }
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
      "或一键重装：cd ~ && NEXUS_REINSTALL=1 bash ~/Fengyun-Nexus/termux-install.sh",
    );
  }
  process.exit(1);
});
