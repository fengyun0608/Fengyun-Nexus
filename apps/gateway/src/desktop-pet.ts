/**
 * 桌面桌宠：控制台开关落盘后，由网关在本机拉起 / 关掉 Electron 桌宠进程。
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export type DesktopPetEngine = "auto" | "sherpa" | "system-speech";

export type DesktopPetConfig = {
  enabled: boolean;
  wakeWords: string[];
  /** 近音别名：主词 → 变体列表 */
  aliases?: Record<string, string[]>;
  /** auto：有 sherpa 用 sherpa，否则 System.Speech */
  engine: DesktopPetEngine;
  note?: string;
};

export type DesktopPetRuntime = {
  enabled: boolean;
  gatewayUrl: string;
  token: string;
  wakeWords: string[];
  aliases?: Record<string, string[]>;
  engine: DesktopPetEngine;
  chatId: string;
  userId: string;
  issuedAt: string;
};

export type DesktopPetStatus = {
  enabled: boolean;
  running: boolean;
  pid: number | null;
  wakeWords: string[];
  engine: DesktopPetEngine;
  voice: {
    preferred: DesktopPetEngine;
    sherpaReady: boolean;
    systemSpeechReady: boolean;
  };
  message?: string;
};

const DEFAULT_WAKE = ["喵璃", "小璃", "Nexus", "风云"];

function normalizeEngine(raw: unknown): DesktopPetEngine {
  if (raw === "sherpa" || raw === "system-speech" || raw === "auto") return raw;
  return "auto";
}

function normalizeAliases(raw: unknown): Record<string, string[]> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(k).trim();
    if (!key) continue;
    const list = Array.isArray(v)
      ? v.map((x) => String(x).trim()).filter(Boolean)
      : typeof v === "string"
        ? String(v)
            .split(/[,，\s]+/)
            .map((x) => x.trim())
            .filter(Boolean)
        : [];
    if (list.length) out[key] = list;
  }
  return Object.keys(out).length ? out : undefined;
}

function normalize(raw: Partial<DesktopPetConfig> | undefined): DesktopPetConfig {
  const words = Array.isArray(raw?.wakeWords)
    ? raw!.wakeWords.map((x) => String(x).trim()).filter(Boolean)
    : typeof raw?.wakeWords === "string"
      ? String(raw.wakeWords)
          .split(/[,，\s]+/)
          .map((x) => x.trim())
          .filter(Boolean)
      : [];
  return {
    enabled: Boolean(raw?.enabled),
    wakeWords: words.length ? words : [...DEFAULT_WAKE],
    aliases: normalizeAliases(raw?.aliases),
    engine: normalizeEngine(raw?.engine),
    note: typeof raw?.note === "string" ? raw.note : "",
  };
}

export function loadDesktopPetConfig(root: string): DesktopPetConfig {
  const defPath = join(root, "configs/desktop-pet.default.json");
  const localPath = join(root, "configs/desktop-pet.local.json");
  let def: Partial<DesktopPetConfig> = {};
  if (existsSync(defPath)) {
    try {
      def = JSON.parse(readFileSync(defPath, "utf8")) as Partial<DesktopPetConfig>;
    } catch {
      /* ignore */
    }
  }
  if (!existsSync(localPath)) return normalize(def);
  try {
    const local = JSON.parse(readFileSync(localPath, "utf8")) as Partial<DesktopPetConfig>;
    return normalize({ ...def, ...local });
  } catch {
    return normalize(def);
  }
}

export function saveDesktopPetConfig(root: string, cfg: DesktopPetConfig): void {
  const path = join(root, "configs/desktop-pet.local.json");
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, `${JSON.stringify(normalize(cfg), null, 2)}\n`, "utf8");
}

function runtimePath(root: string): string {
  return join(root, "data", "desktop-pet-runtime.json");
}

function writeRuntime(root: string, runtime: DesktopPetRuntime): void {
  const p = runtimePath(root);
  const dir = dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(p, `${JSON.stringify(runtime, null, 2)}\n`, "utf8");
}

function clearRuntime(root: string): void {
  const p = runtimePath(root);
  try {
    if (existsSync(p)) unlinkSync(p);
  } catch {
    /* ignore */
  }
}

function petAppDir(root: string): string {
  return join(root, "apps", "desktop-pet");
}

function resolveElectronBin(petDir: string): string | null {
  const tryPaths: string[] = [];
  try {
    const req = createRequire(join(petDir, "package.json"));
    const electronPath = req("electron") as string;
    if (electronPath) tryPaths.push(electronPath);
  } catch {
    /* fall through */
  }
  try {
    const rootReq = createRequire(join(petDir, "..", "..", "package.json"));
    const electronPath = rootReq("electron") as string;
    if (electronPath) tryPaths.push(electronPath);
  } catch {
    /* ignore */
  }
  for (const base of [
    join(petDir, "node_modules", "electron"),
    join(petDir, "..", "..", "node_modules", "electron"),
  ]) {
    const pathTxt = join(base, "path.txt");
    if (!existsSync(pathTxt)) continue;
    try {
      const raw = readFileSync(pathTxt, "utf8").trim();
      if (!raw) continue;
      tryPaths.push(raw);
      tryPaths.push(join(base, "dist", raw));
      tryPaths.push(join(base, raw));
    } catch {
      /* ignore */
    }
  }
  for (const p of tryPaths) {
    if (p && existsSync(p)) return p;
  }
  return null;
}

export class DesktopPetManager {
  private child: ChildProcess | null = null;
  private cfg: DesktopPetConfig;
  private lastMessage = "";

  constructor(
    private readonly root: string,
    private readonly log: { info: (m: string) => void; warn: (m: string) => void; ok: (m: string) => void },
  ) {
    this.cfg = loadDesktopPetConfig(root);
  }

  getConfig(): DesktopPetConfig {
    return {
      ...this.cfg,
      wakeWords: [...this.cfg.wakeWords],
      aliases: this.cfg.aliases ? { ...this.cfg.aliases } : undefined,
    };
  }

  status(): DesktopPetStatus {
    const running = Boolean(this.child && this.child.exitCode === null && !this.child.killed);
    const sherpaMarker = join(this.root, "data", "desktop-pet", "voice", "sherpa", "ready.json");
    const sherpaReady = existsSync(sherpaMarker);
    return {
      enabled: this.cfg.enabled,
      running,
      pid: running && this.child?.pid ? this.child.pid : null,
      wakeWords: [...this.cfg.wakeWords],
      engine: this.cfg.engine,
      voice: {
        preferred: this.cfg.engine,
        sherpaReady,
        systemSpeechReady: process.platform === "win32",
      },
      message: this.lastMessage || undefined,
    };
  }

  /**
   * 保存开关；开启时签发令牌并拉起桌宠，关闭时结束进程。
   */
  async apply(opts: {
    enabled: boolean;
    wakeWords?: string[];
    aliases?: Record<string, string[]>;
    engine?: DesktopPetEngine;
    gatewayUrl: string;
    issueToken: () => string;
  }): Promise<DesktopPetStatus> {
    this.cfg = normalize({
      ...this.cfg,
      enabled: opts.enabled,
      wakeWords: opts.wakeWords ?? this.cfg.wakeWords,
      aliases: opts.aliases !== undefined ? opts.aliases : this.cfg.aliases,
      engine: opts.engine ?? this.cfg.engine,
    });
    saveDesktopPetConfig(this.root, this.cfg);

    if (!this.cfg.enabled) {
      await this.stop();
      this.lastMessage = "桌宠已关闭";
      return this.status();
    }

    await this.start({
      gatewayUrl: opts.gatewayUrl,
      token: opts.issueToken(),
    });
    return this.status();
  }

  async start(opts: { gatewayUrl: string; token: string }): Promise<void> {
    await this.stop();
    const petDir = petAppDir(this.root);
    const mainJs = join(petDir, "main.cjs");
    if (!existsSync(mainJs)) {
      this.lastMessage = "桌宠程序缺失（apps/desktop-pet）";
      this.log.warn(this.lastMessage);
      throw new Error(this.lastMessage);
    }

    writeRuntime(this.root, {
      enabled: true,
      gatewayUrl: opts.gatewayUrl.replace(/\/$/, ""),
      token: opts.token,
      wakeWords: [...this.cfg.wakeWords],
      aliases: this.cfg.aliases,
      engine: this.cfg.engine,
      chatId: "desktop-pet",
      userId: "desktop-pet",
      issuedAt: new Date().toISOString(),
    });

    let electronBin = resolveElectronBin(petDir);
    if (!electronBin) {
      // 尝试从仓库根 node_modules 解析
      try {
        const rootReq = createRequire(join(this.root, "package.json"));
        const p = rootReq.resolve("electron");
        const electronPkg = join(dirname(p), "path.txt");
        if (existsSync(electronPkg)) {
          const bin = readFileSync(electronPkg, "utf8").trim();
          if (bin && existsSync(bin)) electronBin = bin;
        }
      } catch {
        /* ignore */
      }
    }
    if (!electronBin) {
      this.lastMessage =
        "桌宠运行时未安装。请到控制台「环境配置」安装「桌宠（消息通道）」";
      this.log.warn(this.lastMessage);
      throw new Error(this.lastMessage);
    }

    const child = spawn(electronBin, [".", `--runtime=${runtimePath(this.root)}`], {
      cwd: petDir,
      env: {
        ...process.env,
        NEXUS_DESKTOP_PET_RUNTIME: runtimePath(this.root),
        ELECTRON_DISABLE_SECURITY_WARNINGS: "1",
      },
      detached: process.platform === "win32",
      stdio: "ignore",
      windowsHide: false,
    });
    child.unref();
    this.child = child;
    child.on("exit", (code) => {
      if (this.child === child) this.child = null;
      this.log.info(`桌宠进程已退出  code=${code ?? "?"}`);
    });
    this.lastMessage = "桌宠已启动";
    this.log.ok(`桌宠已启动  pid=${child.pid ?? "?"}`);
  }

  async stop(): Promise<void> {
    clearRuntime(this.root);
    const c = this.child;
    this.child = null;
    if (!c || c.killed) return;
    try {
      if (process.platform === "win32" && c.pid) {
        spawn("taskkill", ["/pid", String(c.pid), "/t", "/f"], {
          stdio: "ignore",
          windowsHide: true,
        });
      } else {
        c.kill("SIGTERM");
      }
    } catch {
      /* ignore */
    }
  }

  /** 网关起来后：若配置为开启则自动拉起 */
  async restoreIfEnabled(opts: { gatewayUrl: string; issueToken: () => string }): Promise<void> {
    this.cfg = loadDesktopPetConfig(this.root);
    if (!this.cfg.enabled) return;
    try {
      await this.start({
        gatewayUrl: opts.gatewayUrl,
        token: opts.issueToken(),
      });
    } catch (e) {
      this.lastMessage = e instanceof Error ? e.message : String(e);
      this.log.warn(`桌宠自动启动失败：${this.lastMessage}`);
    }
  }
}

/** 供单测 / 脚本定位包目录 */
export function desktopPetPackageDirFromMeta(importMetaUrl: string): string {
  return join(dirname(fileURLToPath(importMetaUrl)), "..", "..", "desktop-pet");
}
