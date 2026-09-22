import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { installSherpaVoice } from "../apps/gateway/src/desktop-pet-voice-setup.ts";

async function main() {
  const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
  console.log("root", repo);
  const ready = await installSherpaVoice({
    root: repo,
    onLog: (m) => console.log("[sherpa]", m),
    onProgress: (n) => console.log("[pct]", n),
  });
  console.log("DONE offline=", ready.offline);
  console.log("DONE asr=", ready.asrParaformer);
  console.log("DONE mic=", ready.microphone);
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
