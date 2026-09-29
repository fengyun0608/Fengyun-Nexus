/**
 * 非交互：按姿态安装 NapCat 并预写反向 WS（默认本机 8787）。
 * 由 ensure-runtime.mjs / 一键安装调用。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildReverseWsUrl,
  installNapCat,
  readNapCatMarker,
  resolveFlavor,
} from "../apps/gateway/src/napcat-setup.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadPort(): number {
  const env = Number(process.env.PORT || 0);
  if (env > 0) return env;
  try {
    const p = join(root, "configs/onebot.local.json");
    if (existsSync(p)) {
      const j = JSON.parse(readFileSync(p, "utf8")) as {
        bots?: Array<{ listenPort?: number }>;
      };
      const hit = j.bots?.find((b) => Number(b.listenPort) > 0);
      if (hit) return Math.floor(Number(hit.listenPort));
    }
  } catch {
    /* ignore */
  }
  return 8787;
}

async function main() {
  const marker = readNapCatMarker(root);
  if (marker?.home && existsSync(marker.home)) {
    console.log(`OK  NapCat 已安装：${marker.home}（${marker.flavor || "?"}）`);
    return;
  }

  const port = loadPort();
  const reverseWsUrl = buildReverseWsUrl({
    port,
    path: "/onebot/v11/ws",
  });
  const flavor = resolveFlavor("auto");
  console.log(`>>> NapCat 安装 · flavor=${flavor} · WS=${reverseWsUrl}`);

  // 预写 onebot.local，启用反向通道（QQ 号留给启动台填写）
  const onebotLocal = join(root, "configs/onebot.local.json");
  mkdirSync(dirname(onebotLocal), { recursive: true });
  if (!existsSync(onebotLocal)) {
    writeFileSync(
      onebotLocal,
      `${JSON.stringify(
        {
          enabled: true,
          accessToken: "",
          reverseWsPath: "/onebot/v11/ws",
          httpPath: "/onebot/v11/http",
          bots: [
            {
              selfId: "",
              label: "主号",
              listenPort: port,
              apiBase: "",
              accessToken: "",
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }

  await installNapCat({
    root,
    flavor: "auto",
    reverseWsUrl,
    onLog: (line) => console.log(`  ${line}`),
    onProgress: (n) => {
      if (n === 100 || n % 25 === 0) console.log(`  … ${n}%`);
    },
  });
  console.log("OK  NapCat 安装完成");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
