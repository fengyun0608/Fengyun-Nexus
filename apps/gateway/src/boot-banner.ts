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

/** Yunzai-style flash: many short lines, then continue. */
export async function bootStep(msg: string, ms = 28): Promise<void> {
  log.info(msg);
  if (process.env.NEXUS_BOOT_FAST === "1") return;
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

export async function printBootSuccess(opts: {
  url: string;
  env: string;
  plugins: number;
  channels: number;
}): Promise<void> {
  console.log("");
  log.ok("────────────────────────────────────────");
  log.ok(`${c.bold}Fengyun Nexus 启动成功${c.reset}`);
  log.ok(`环境 ${opts.env}  ·  插件 ${opts.plugins}  ·  通道 ${opts.channels}`);
  log.ok(`控制台 ${opts.url}`);
  log.ok("开始使用吧");
  log.ok("────────────────────────────────────────");
  console.log("");
}
