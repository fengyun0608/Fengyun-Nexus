/**
 * NapCat 一键安装与反向 WS 接线。
 * 平台：Windows Shell / Linux Launcher / Termux / Docker 说明。
 * 官方：https://napneko.github.io/guide/boot/Shell
 */
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  renameSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { spawn, execSync } from "node:child_process";

export type NapCatFlavor = "auto" | "shell" | "linux" | "termux" | "docker";

export type NapCatStatus = {
  installed: boolean;
  home: string;
  flavor?: string;
  version?: string;
  reverseWsUrl: string;
  launchCmd: string;
  docsUrl: string;
  steps: string[];
  tip: string;
  configFiles: string[];
};

export type NapCatWireOpts = {
  root: string;
  reverseWsUrl: string;
  token?: string;
  apiBase?: string;
};

function isTermux(): boolean {
  return Boolean(
    process.env.TERMUX_VERSION ||
      process.env.PREFIX?.includes("com.termux") ||
      process.env.NEXUS_FORCE_TERMUX === "1",
  );
}

function isWin(): boolean {
  return process.platform === "win32";
}

export function napcatHome(root: string): string {
  return join(root, "data", "runtimes", "napcat");
}

export function resolveFlavor(requested: NapCatFlavor): Exclude<NapCatFlavor, "auto"> {
  if (requested !== "auto") return requested;
  if (isTermux()) return "termux";
  if (isWin()) return "shell";
  return "linux";
}

export function buildReverseWsUrl(opts: {
  host?: string;
  port: string | number;
  path: string;
  token?: string;
}): string {
  const host = (opts.host || "127.0.0.1").replace(/^https?:\/\//, "");
  const path = opts.path.startsWith("/") ? opts.path : `/${opts.path}`;
  let url = `ws://${host}:${opts.port}${path}`;
  const token = String(opts.token || "").trim();
  if (token) url += `${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`;
  return url;
}

function markerPath(root: string): string {
  return join(napcatHome(root), "installed.json");
}

function clientBlock(url: string, token: string) {
  return {
    enable: true,
    name: "Fengyun-Nexus",
    url: url.trim(),
    reportSelfMessage: false,
    messagePostFormat: "array",
    token: token || "",
    debug: false,
    heartInterval: 30000,
    reconnectInterval: 5000,
  };
}

function patchOneBotJson(file: string, url: string, token: string): boolean {
  let raw: Record<string, unknown> = {};
  if (existsSync(file)) {
    try {
      raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    } catch {
      raw = {};
    }
  }
  const network = (raw.network && typeof raw.network === "object"
    ? { ...(raw.network as Record<string, unknown>) }
    : {}) as Record<string, unknown>;
  const clients = Array.isArray(network.websocketClients)
    ? [...(network.websocketClients as Record<string, unknown>[])]
    : [];
  const next = clientBlock(url, token);
  const idx = clients.findIndex(
    (c) =>
      String(c?.name || "") === "Fengyun-Nexus" ||
      String(c?.url || "").includes("/onebot/v11/ws"),
  );
  if (idx >= 0) clients[idx] = { ...clients[idx], ...next };
  else clients.push(next);
  network.websocketClients = clients;
  if (!Array.isArray(network.httpServers)) network.httpServers = [];
  if (!Array.isArray(network.websocketServers)) network.websocketServers = [];
  if (!Array.isArray(network.httpClients)) network.httpClients = [];
  if (!Array.isArray(network.httpSseServers)) network.httpSseServers = [];
  raw.network = network;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
  return true;
}

/** 把反向 WS 写进 NapCat 目录下所有 onebot11*.json，并落一份模板。 */
export function wireNapCatConfigs(shellDir: string, url: string, token = ""): string[] {
  const configDir = join(shellDir, "config");
  mkdirSync(configDir, { recursive: true });
  const written: string[] = [];
  const template = join(configDir, "onebot11_nexus.json");
  patchOneBotJson(template, url, token);
  written.push(template);

  if (existsSync(configDir)) {
    for (const name of readdirSync(configDir)) {
      if (!/^onebot11.*\.json$/i.test(name)) continue;
      const file = join(configDir, name);
      patchOneBotJson(file, url, token);
      written.push(file);
    }
  }
  writeFileSync(
    join(shellDir, "NEXUS-连接说明.txt"),
    [
      "Fengyun Nexus × NapCat",
      "",
      "1. 双击或运行本目录启动脚本（Windows: launcher.bat / start-nexus.bat）",
      "2. 按 NapCat 窗口提示扫码登录 QQ",
      "3. 登录成功后本目录 config/onebot11_你的QQ.json 已指向 Nexus 反向 WS",
      `4. 反向地址：${url.trim()}`,
      "5. 回到 Nexus 控制台「OneBot 11」看连接是否变绿",
      "",
      "官方安装说明：https://napneko.github.io/guide/boot/Shell",
      "",
    ].join("\n"),
    "utf8",
  );
  return [...new Set(written)];
}

export function readNapCatMarker(root: string): {
  version?: string;
  flavor?: string;
  home?: string;
  at?: string;
} | null {
  const p = markerPath(root);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as {
      version?: string;
      flavor?: string;
      home?: string;
      at?: string;
    };
  } catch {
    return null;
  }
}

export function writeNapCatMarker(
  root: string,
  data: { version: string; flavor: string; home: string },
): void {
  mkdirSync(napcatHome(root), { recursive: true });
  writeFileSync(
    markerPath(root),
    `${JSON.stringify({ ...data, at: new Date().toISOString() }, null, 2)}\n`,
    "utf8",
  );
}

function mirrorUrls(githubUrl: string): string[] {
  const path = githubUrl.replace(/^https?:\/\/github\.com\//i, "");
  return [
    githubUrl,
    `https://ghfast.top/${githubUrl}`,
    `https://mirror.ghproxy.com/${githubUrl}`,
    `https://github.moeyy.xyz/${githubUrl}`,
    `https://ghproxy.net/${githubUrl}`,
    // nclatest 对 installer 脚本友好；release 资产仍优先 github
    githubUrl.includes("raw.githubusercontent.com")
      ? githubUrl
      : `https://nclatest.znin.net/${path}`,
  ].filter((u, i, a) => a.indexOf(u) === i);
}

async function downloadFile(
  url: string,
  dest: string,
  onProgress?: (msg: string) => void,
): Promise<void> {
  mkdirSync(dirname(dest), { recursive: true });
  const urls = mirrorUrls(url);
  let lastErr: Error | null = null;
  for (const u of urls) {
    try {
      onProgress?.(`下载 ${u}`);
      const res = await fetch(u, {
        redirect: "follow",
        signal: AbortSignal.timeout(180_000),
      });
      if (!res.ok || !res.body) {
        lastErr = new Error(`HTTP ${res.status} ${u}`);
        continue;
      }
      const tmp = `${dest}.part`;
      await pipeline(Readable.fromWeb(res.body as never), createWriteStream(tmp));
      if (existsSync(dest)) unlinkSync(dest);
      renameSync(tmp, dest);
      return;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr || new Error("下载失败");
}

async function unzip(zipPath: string, dest: string, onLog?: (m: string) => void): Promise<void> {
  mkdirSync(dest, { recursive: true });
  if (isWin()) {
    onLog?.("解压（Expand-Archive）…");
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force"`,
      { stdio: "ignore", windowsHide: true },
    );
    return;
  }
  if (existsSync("/usr/bin/unzip") || whichBin("unzip")) {
    onLog?.("解压（unzip）…");
    execSync(`unzip -o "${zipPath}" -d "${dest}"`, { stdio: "ignore" });
    return;
  }
  // fallback: try node's adm if present — otherwise fail with tip
  throw new Error("未找到 unzip，请先安装 unzip 后再试");
}

function whichBin(bin: string): string | null {
  try {
    const out = execSync(isWin() ? `where ${bin}` : `command -v ${bin}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .split(/\r?\n/)[0];
    return out || null;
  } catch {
    return null;
  }
}

async function latestShellAsset(): Promise<{ tag: string; url: string; name: string }> {
  const api = "https://api.github.com/repos/NapNeko/NapCatQQ/releases/latest";
  let tag = "latest";
  let url = "https://github.com/NapNeko/NapCatQQ/releases/latest/download/NapCat.Shell.zip";
  let name = "NapCat.Shell.zip";
  try {
    const res = await fetch(api, {
      headers: { "user-agent": "Fengyun-Nexus" },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) {
      const j = (await res.json()) as {
        tag_name?: string;
        assets?: Array<{ name: string; browser_download_url: string }>;
      };
      tag = j.tag_name || tag;
      const assets = j.assets || [];
      const prefer = isWin()
        ? ["NapCat.Shell.zip", "NapCat.Shell.Windows.Node.zip"]
        : ["NapCat.Shell.zip"];
      for (const want of prefer) {
        const hit = assets.find((a) => a.name === want);
        if (hit) {
          url = hit.browser_download_url;
          name = hit.name;
          break;
        }
      }
    }
  } catch {
    /* use default */
  }
  return { tag, url, name };
}

function writeStartScripts(shellDir: string, flavor: string): string {
  if (flavor === "shell" && isWin()) {
    const bat = join(shellDir, "start-nexus.bat");
    const launcher = existsSync(join(shellDir, "launcher.bat"))
      ? "launcher.bat"
      : existsSync(join(shellDir, "launcher-win10.bat"))
        ? "launcher-win10.bat"
        : "";
    writeFileSync(
      bat,
      [
        "@echo off",
        "cd /d \"%~dp0\"",
        "echo Fengyun Nexus — 启动 NapCat",
        "echo 扫码登录后会自动连到本机 Nexus 反向 WS",
        launcher ? `call ${launcher}` : "echo 未找到 launcher.bat，请按官网说明启动",
        "pause",
        "",
      ].join("\r\n"),
      "utf8",
    );
    return bat;
  }
  const sh = join(shellDir, "start-nexus.sh");
  writeFileSync(
    sh,
    [
      "#!/usr/bin/env bash",
      "cd \"$(dirname \"$0\")\"",
      "echo \"Fengyun Nexus — 请按本目录说明启动 NapCat 并扫码\"",
      "if [ -f ./qq ]; then",
      "  export DISPLAY=${DISPLAY:-:1}",
      "  LD_PRELOAD=./libnapcat_launcher.so ./qq || true",
      "fi",
      "",
    ].join("\n"),
    "utf8",
  );
  try {
    execSync(`chmod +x "${sh}"`, { stdio: "ignore" });
  } catch {
    /* ignore */
  }
  return sh;
}

function writeDockerCompose(home: string, wsUrl: string): void {
  writeFileSync(
    join(home, "docker-compose.nexus.yml"),
    `# Fengyun Nexus — NapCat.Docker 参考
# 仓库：https://github.com/NapNeko/NapCat.Docker
# 群晖若 permission denied：File Station → 属性 → 权限 → Everyone 读写 → 应用到子目录
services:
  napcat:
    image: mlikiowa/napcat-docker:latest
    container_name: napcat-nexus
    restart: unless-stopped
    environment:
      - NAPCAT_GID=0
      - NAPCAT_UID=0
    ports:
      - "6099:6099"
    volumes:
      - ./napcat-data:/app/napcat
    # 进容器后把 OneBot 反向 WS 指到宿主机：
    # ${wsUrl.replace("127.0.0.1", "host.docker.internal")}
`,
    "utf8",
  );
  writeFileSync(
    join(home, "DOCKER说明.txt"),
    [
      "Docker 部署请参考：https://github.com/NapNeko/NapCat.Docker",
      `宿主机反向 WS：${wsUrl}`,
      "容器内请把 127.0.0.1 换成 host.docker.internal（或宿主机局域网 IP）",
      "群晖 ACL：给挂载目录 Everyone 读写并应用到子目录",
      "",
    ].join("\n"),
    "utf8",
  );
}

export type InstallNapCatLog = (line: string) => void;

export async function installNapCat(opts: {
  root: string;
  flavor: NapCatFlavor;
  reverseWsUrl: string;
  token?: string;
  onLog?: InstallNapCatLog;
  onProgress?: (n: number) => void;
}): Promise<{ home: string; flavor: string; version: string; launchCmd: string }> {
  const log = opts.onLog || (() => undefined);
  const progress = opts.onProgress || (() => undefined);
  const flavor = resolveFlavor(opts.flavor);
  const home = napcatHome(opts.root);
  mkdirSync(home, { recursive: true });
  const token = opts.token || "";
  const url = opts.reverseWsUrl.trim();

  progress(5);
  log(`姿态探测 → ${flavor}`);
  log(`反向 WS → ${url}`);

  if (flavor === "docker") {
    progress(40);
    writeDockerCompose(home, url);
    writeNapCatMarker(opts.root, { version: "docker", flavor, home });
    progress(100);
    log("已写入 docker-compose.nexus.yml，请按 DOCKER说明.txt 启动");
    return {
      home,
      flavor,
      version: "docker",
      launchCmd: `cd "${home}" && docker compose -f docker-compose.nexus.yml up -d`,
    };
  }

  if (flavor === "termux") {
    progress(15);
    const script = join(home, "napcat.termux.sh");
    await downloadFile(
      "https://nclatest.znin.net/NapNeko/NapCat-Installer/main/script/install.termux.sh",
      script,
      log,
    );
    progress(55);
    log("执行 Termux 官方安装脚本…");
    const code = await runShell(script, home, log);
    if (code !== 0) throw new Error(`Termux 安装脚本退出码 ${code}`);
    const shellDir = findShellDir(home) || home;
    wireNapCatConfigs(shellDir, url, token);
    writeStartScripts(shellDir, flavor);
    writeNapCatMarker(opts.root, { version: "termux", flavor, home: shellDir });
    progress(100);
    return {
      home: shellDir,
      flavor,
      version: "termux",
      launchCmd: `bash "${join(shellDir, "start-nexus.sh")}"`,
    };
  }

  if (flavor === "linux") {
    progress(15);
    const script = join(home, "napcat.sh");
    // 国内优先 moeyy 镜像，失败再官方 raw
    try {
      await downloadFile(
        "https://github.moeyy.xyz/https://raw.githubusercontent.com/NapNeko/napcat-linux-installer/refs/heads/main/install.sh",
        script,
        log,
      );
    } catch {
      await downloadFile(
        "https://raw.githubusercontent.com/NapNeko/napcat-linux-installer/refs/heads/main/install.sh",
        script,
        log,
      );
    }
    progress(50);
    log("执行 Linux Launcher 安装脚本（工作目录内，不破坏系统 QQ）…");
    const code = await runShell(script, home, log);
    if (code !== 0) {
      log("安装脚本非零退出；若产物已生成可继续接线");
    }
    const shellDir = findShellDir(home) || home;
    wireNapCatConfigs(shellDir, url, token);
    const launch = writeStartScripts(shellDir, flavor);
    writeNapCatMarker(opts.root, { version: "linux-launcher", flavor, home: shellDir });
    progress(100);
    return { home: shellDir, flavor, version: "linux-launcher", launchCmd: `bash "${launch}"` };
  }

  // Windows Shell
  progress(10);
  // 若本机已有 NapCat.Shell，直接接线
  const existing = ["D:\\NapCat.Shell", "C:\\NapCat.Shell", join(home, "Shell")].find((p) =>
    existsSync(join(p, "napcat.mjs")) || existsSync(join(p, "launcher.bat")),
  );
  let shellDir = join(home, "Shell");
  let version = "shell";
  if (existing) {
    log(`发现已有 NapCat：${existing}，跳过下载，直接接线`);
    shellDir = existing;
    version = "existing";
    progress(70);
  } else {
    const asset = await latestShellAsset();
    version = asset.tag;
    log(`选用 ${asset.name}（${asset.tag}）`);
    const zip = join(home, asset.name);
    progress(25);
    await downloadFile(asset.url, zip, log);
    progress(60);
    await unzip(zip, shellDir, log);
    // 若 zip 内多一层目录，下钻
    shellDir = findShellDir(shellDir) || shellDir;
  }
  progress(80);
  const files = wireNapCatConfigs(shellDir, url, token);
  log(`已写入 ${files.length} 个配置`);
  const launch = writeStartScripts(shellDir, "shell");
  writeNapCatMarker(opts.root, { version, flavor: "shell", home: shellDir });
  // 快捷方式到 data/runtimes/napcat
  try {
    writeFileSync(
      join(home, "打开安装目录.txt"),
      `NapCat 目录：${shellDir}\n启动：${launch}\n`,
      "utf8",
    );
  } catch {
    /* ignore */
  }
  progress(100);
  return {
    home: shellDir,
    flavor: "shell",
    version,
    launchCmd: isWin() ? `call "${launch}"` : `bash "${launch}"`,
  };
}

function findShellDir(dir: string): string | null {
  if (!existsSync(dir)) return null;
  if (existsSync(join(dir, "launcher.bat")) || existsSync(join(dir, "napcat.mjs"))) return dir;
  try {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (existsSync(join(p, "launcher.bat")) || existsSync(join(p, "napcat.mjs"))) return p;
      if (existsSync(join(p, "libnapcat_launcher.so"))) return p;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function runShell(script: string, cwd: string, log: InstallNapCatLog): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("bash", [script], {
      cwd,
      env: process.env,
    });
    child.stdout?.on("data", (b: Buffer) => {
      for (const line of b.toString("utf8").split(/\r?\n/)) if (line.trim()) log(line);
    });
    child.stderr?.on("data", (b: Buffer) => {
      for (const line of b.toString("utf8").split(/\r?\n/)) if (line.trim()) log(line);
    });
    child.on("error", (e) => {
      log(e.message);
      resolve(1);
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

/** 登录后按 QQ 号补写 onebot11_<qq>.json */
export function wireNapCatForAccount(
  root: string,
  qq: string,
  reverseWsUrl: string,
  token = "",
): string | null {
  const marker = readNapCatMarker(root);
  const home = marker?.home || napcatHome(root);
  if (!existsSync(home)) return null;
  const file = join(home, "config", `onebot11_${qq}.json`);
  patchOneBotJson(file, reverseWsUrl, token);
  return file;
}

export function getNapCatStatus(opts: {
  root: string;
  reverseWsUrl: string;
  connected?: boolean;
  selfId?: string;
}): NapCatStatus {
  const marker = readNapCatMarker(opts.root);
  const home = marker?.home || napcatHome(opts.root);
  const installed = Boolean(marker) || existsSync(join(home, "launcher.bat")) || existsSync(join(home, "napcat.mjs"));
  const flavor = marker?.flavor || resolveFlavor("auto");
  const launchCmd = isWin()
    ? (existsSync(join(home, "start-nexus.bat"))
        ? join(home, "start-nexus.bat")
        : existsSync(join(home, "launcher.bat"))
          ? join(home, "launcher.bat")
          : "请先在环境配置安装 NapCat")
    : existsSync(join(home, "start-nexus.sh"))
      ? `bash "${join(home, "start-nexus.sh")}"`
      : "请先在环境配置安装 NapCat";

  const steps = [
    "打开「环境配置」→ NapCat → 安装（本机自动选 Windows Shell / Linux / Termux）",
    "安装完成后运行启动脚本，按窗口提示扫码登录",
    "登录成功后配置已指向 Nexus 反向 WS，回到本页看「已连接」",
    "再在「消息通道 → OneBot」确认机器人 QQ，即可用 #菜单 / #禁言 等",
  ];

  let tip = "未安装：请到环境配置一键安装 NapCat";
  if (installed && !opts.connected) tip = "已安装未连接：请启动 NapCat 并扫码，或检查反向 WS 地址";
  if (opts.connected) tip = `已连接${opts.selfId ? `（QQ ${opts.selfId}）` : ""}，可以收发消息了`;

  const configFiles: string[] = [];
  const cfg = join(home, "config");
  if (existsSync(cfg)) {
    for (const n of readdirSync(cfg)) {
      if (/^onebot11.*\.json$/i.test(n)) configFiles.push(join(cfg, n));
    }
  }

  return {
    installed,
    home,
    flavor,
    version: marker?.version,
    reverseWsUrl: opts.reverseWsUrl,
    launchCmd,
    docsUrl: "https://napneko.github.io/guide/boot/Shell",
    steps,
    tip,
    configFiles,
  };
}

/** 尝试拉起本机 NapCat（Windows 优先） */
export function tryLaunchNapCat(root: string): { ok: boolean; message: string } {
  const marker = readNapCatMarker(root);
  const home = marker?.home || napcatHome(root);
  if (isWin()) {
    const bat =
      [join(home, "start-nexus.bat"), join(home, "launcher.bat"), join(home, "launcher-win10.bat")].find(
        (p) => existsSync(p),
      ) || "";
    if (!bat) return { ok: false, message: "未找到启动脚本，请先安装 NapCat" };
    spawn("cmd.exe", ["/c", "start", '""', bat], {
      cwd: home,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    }).unref();
    return { ok: true, message: "已拉起 NapCat 窗口，请扫码登录" };
  }
  const sh = join(home, "start-nexus.sh");
  if (!existsSync(sh)) return { ok: false, message: "未找到 start-nexus.sh" };
  spawn("bash", [sh], { cwd: home, detached: true, stdio: "ignore" }).unref();
  return { ok: true, message: "已后台尝试启动，请看终端或扫码窗口" };
}
