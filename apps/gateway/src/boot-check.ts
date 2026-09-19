import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { log } from "./log.js";

/** 缺的只警告，不挡启动。 */
export function warnBootGaps(opts: {
  root: string;
  setupCompleted: boolean;
  onebotEnabled: boolean;
  onebotConnected: () => boolean;
}): void {
  if (!opts.setupCompleted) {
    log.warn("控制台还是初始密码，登录后请改掉");
  }
  if (!browserReady(opts.root)) {
    log.warn("截图浏览器还没装。菜单和状态会改发文字，可在控制台「环境配置」安装");
  }
  if (opts.onebotEnabled) {
    setTimeout(() => {
      if (!opts.onebotConnected()) {
        log.warn("OneBot 还没连上。QQ 指令暂不可用，控制台里看反向地址");
      }
    }, 4000);
  }
}

function browserReady(root: string): boolean {
  const bin = String(process.env.NEXUS_BROWSER_BIN || "").trim();
  if (bin && existsSync(bin)) return true;
  const pkgs = [
    join(root, "packages/browser-shot/package.json"),
    join(root, "plugins/z-draw/package.json"),
    join(root, "package.json"),
  ];
  for (const pkg of pkgs) {
    if (!existsSync(pkg)) continue;
    try {
      const pw = createRequire(pkg)("playwright") as {
        chromium?: { executablePath?: () => string };
      };
      const exe = pw.chromium?.executablePath?.();
      if (exe && existsSync(exe)) return true;
    } catch {
      /* 换下一个入口 */
    }
  }
  return false;
}
