import { log } from "./log.js";

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 启动时按模块分一块。一块结束再写下一块。 */
export async function bootGroup(name: string): Promise<void> {
  console.log("");
  log.info(`[${name}]`);
  await bootPace();
}

/** 启动过程里的一行。带短停顿，让日志往下走，而不是一坨砸出来。 */
export async function bootLine(msg: string): Promise<void> {
  log.ok(msg);
  await bootPace();
}

async function bootPace(): Promise<void> {
  if (process.env.NEXUS_BOOT_FAST === "1") return;
  await sleep(80);
}

/** node:sqlite 的实验警告会插进启动日志中间，这里收掉。 */
export function quietNodeSqliteWarning(): void {
  process.on("warning", (w) => {
    if (w.name === "ExperimentalWarning" && /SQLite/i.test(w.message)) return;
    console.warn(w.stack || `${w.name}: ${w.message}`);
  });
}

/** 旧闪屏步进。新启动不再逐行停顿。 */
export async function bootStep(msg: string, ms = 0): Promise<void> {
  log.info(msg);
  if (!ms || process.env.NEXUS_BOOT_FAST === "1") return;
  await sleep(ms);
}

export function printBootBanner(): void {
  const art = `
${c.cyan}${c.bold}
  ███████╗███████╗███╗   ██╗ ██████╗ ██╗   ██╗██╗   ██╗███╗   ██╗
  ██╔════╝██╔════╝████╗  ██║██╔════╝ ╚██╗ ██╔╝██║   ██║████╗  ██║
  █████╗  █████╗  ██╔██╗ ██║██║  ███╗ ╚████╔╝ ██║   ██║██╔██╗ ██║
  ██╔══╝  ██╔══╝  ██║╚██╗██║██║   ██║  ╚██╔╝  ██║   ██║██║╚██╗██║
  ██║     ███████╗██║ ╚████║╚██████╔╝   ██║   ╚██████╔╝██║ ╚████║
  ╚═╝     ╚══════╝╚═╝  ╚═══╝ ╚═════╝    ╚═╝    ╚═════╝ ╚═╝  ╚═══╝
${c.reset}${c.magenta}${c.bold}           N E X U S${c.reset}  ${c.gray}· AI conversation & automation hub${c.reset}
`;
  console.log(art);
}

export async function printBootSuccess(): Promise<void> {
  console.log("");
  log.ok("────────────────────────────────────────");
  log.ok(`${c.bold}Fengyun Nexus 启动成功${c.reset}`);
  log.ok("开始使用吧");
  log.ok("────────────────────────────────────────");
  console.log("");
}
