/**
 * 桌宠 sherpa-onnx KWS 运行时安装（Windows x64）。
 * 资源落到 data/desktop-pet/voice/sherpa/
 */
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const MODEL_NAME = "sherpa-onnx-kws-zipformer-wenetspeech-3.3M-2024-01-01";
const MODEL_URL = `https://github.com/k2-fsa/sherpa-onnx/releases/download/kws-models/${MODEL_NAME}.tar.bz2`;
/** 体积较小的 no-tts 共享库包 */
const BIN_URL =
  "https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.12.14/sherpa-onnx-v1.12.14-win-x64-shared.tar.bz2";
const BIN_URL_FALLBACK =
  "https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.11.3/sherpa-onnx-v1.11.3-win-x64-shared.tar.bz2";

export type SherpaReady = {
  at: string;
  modelDir: string;
  encoder: string;
  decoder: string;
  joiner: string;
  tokens: string;
  microphone: string;
  binDir: string;
};

function voiceRoot(root: string): string {
  return join(root, "data", "desktop-pet", "voice", "sherpa");
}

export function sherpaReadyPath(root: string): string {
  return join(voiceRoot(root), "ready.json");
}

export function readSherpaReady(root: string): SherpaReady | null {
  const p = sherpaReadyPath(root);
  if (!existsSync(p)) return null;
  try {
    const j = JSON.parse(readFileSync(p, "utf8")) as SherpaReady;
    if (
      j?.microphone &&
      j.encoder &&
      j.decoder &&
      j.joiner &&
      j.tokens &&
      existsSync(j.microphone) &&
      existsSync(j.encoder) &&
      existsSync(j.tokens)
    ) {
      return j;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function mirrorUrls(url: string): string[] {
  if (!/^https?:\/\/(github\.com|raw\.githubusercontent\.com)\//i.test(url)) {
    return [url];
  }
  return [
    url,
    `https://ghfast.top/${url}`,
    `https://github.moeyy.xyz/${url}`,
    `https://mirror.ghproxy.com/${url}`,
    `https://ghproxy.net/${url}`,
  ].filter((u, i, a) => a.indexOf(u) === i);
}

async function downloadFile(
  url: string,
  dest: string,
  onLog: (m: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  mkdirSync(dirname(dest), { recursive: true });
  let last: Error | null = null;
  for (const u of mirrorUrls(url)) {
    if (signal?.aborted) throw new Error("已取消");
    try {
      onLog(`下载 ${u}`);
      const res = await fetch(u, {
        redirect: "follow",
        headers: { "user-agent": "Fengyun-Nexus" },
        signal: signal ?? AbortSignal.timeout(600_000),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const tmp = `${dest}.part`;
      await pipeline(Readable.fromWeb(res.body as never), createWriteStream(tmp));
      const sz = existsSync(tmp) ? statSync(tmp).size : 0;
      if (sz < 1024) {
        try {
          unlinkSync(tmp);
        } catch {
          /* ignore */
        }
        throw new Error("文件过小");
      }
      if (existsSync(dest)) unlinkSync(dest);
      renameSync(tmp, dest);
      onLog(`已保存 ${(sz / 1024 / 1024).toFixed(1)} MB`);
      return;
    } catch (e) {
      last = e instanceof Error ? e : new Error(String(e));
      onLog(`失败：${last.message}`);
    }
  }
  throw last || new Error("下载失败");
}

function extractTarBz2(archive: string, destDir: string, onLog: (m: string) => void): void {
  mkdirSync(destDir, { recursive: true });
  onLog(`解压 ${archive}`);
  execSync(`tar -xjf "${archive}" -C "${destDir}"`, {
    windowsHide: true,
    stdio: "ignore",
  });
}

function walkFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    try {
      if (statSync(p).isDirectory()) walkFiles(p, out);
      else out.push(p);
    } catch {
      /* ignore */
    }
  }
  return out;
}

function findByName(files: string[], re: RegExp): string | null {
  const hit = files.find((f) => re.test(f.replace(/\\/g, "/")));
  return hit || null;
}

function resolveModelPaths(modelDir: string): Omit<SherpaReady, "at" | "microphone" | "binDir"> {
  const files = walkFiles(modelDir);
  const encInt8 = findByName(files, /encoder-.*chunk-16-left-64\.int8\.onnx$/i);
  const enc = encInt8 || findByName(files, /encoder-.*chunk-16-left-64\.onnx$/i);
  const decInt8 = findByName(files, /decoder-.*chunk-16-left-64\.int8\.onnx$/i);
  const dec = decInt8 || findByName(files, /decoder-.*chunk-16-left-64\.onnx$/i);
  const joinInt8 = findByName(files, /joiner-.*chunk-16-left-64\.int8\.onnx$/i);
  const jn = joinInt8 || findByName(files, /joiner-.*chunk-16-left-64\.onnx$/i);
  const tokens = findByName(files, /\/tokens\.txt$/i) || findByName(files, /tokens\.txt$/i);
  if (!enc || !dec || !jn || !tokens) {
    throw new Error("KWS 模型文件不完整（encoder/decoder/joiner/tokens）");
  }
  return { modelDir, encoder: enc, decoder: dec, joiner: jn, tokens };
}

function resolveMicrophone(binExtractDir: string): { microphone: string; binDir: string } {
  const files = walkFiles(binExtractDir);
  const mic =
    findByName(files, /sherpa-onnx-keyword-spotter-microphone\.exe$/i) ||
    findByName(files, /keyword-spotter-microphone\.exe$/i);
  if (!mic) {
    throw new Error("包内未找到 sherpa-onnx-keyword-spotter-microphone.exe");
  }
  return { microphone: mic, binDir: dirname(mic) };
}

export async function installSherpaVoice(opts: {
  root: string;
  onLog: (m: string) => void;
  onProgress?: (n: number) => void;
  signal?: AbortSignal;
}): Promise<SherpaReady> {
  if (process.platform !== "win32") {
    throw new Error("sherpa 呼唤运行时目前仅支持 Windows");
  }
  const { root, onLog, onProgress, signal } = opts;
  const base = voiceRoot(root);
  const dl = join(base, "download");
  mkdirSync(dl, { recursive: true });
  onProgress?.(5);

  const modelArchive = join(dl, `${MODEL_NAME}.tar.bz2`);
  if (!existsSync(modelArchive) || statSync(modelArchive).size < 1024) {
    await downloadFile(MODEL_URL, modelArchive, onLog, signal);
  } else {
    onLog("复用已下载的 KWS 模型包");
  }
  onProgress?.(35);

  const modelDest = join(base, "model");
  if (existsSync(modelDest)) {
    try {
      rmSync(modelDest, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
  mkdirSync(modelDest, { recursive: true });
  extractTarBz2(modelArchive, modelDest, onLog);
  onProgress?.(55);

  const binArchive = join(dl, "sherpa-win-x64.tar.bz2");
  let binOk = false;
  for (const url of [BIN_URL, BIN_URL_FALLBACK]) {
    try {
      if (existsSync(binArchive)) {
        try {
          unlinkSync(binArchive);
        } catch {
          /* ignore */
        }
      }
      await downloadFile(url, binArchive, onLog, signal);
      binOk = true;
      break;
    } catch (e) {
      onLog(`二进制包失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (!binOk) throw new Error("sherpa Windows 二进制下载失败");
  onProgress?.(75);

  const binDest = join(base, "bin");
  if (existsSync(binDest)) {
    try {
      rmSync(binDest, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
  mkdirSync(binDest, { recursive: true });
  extractTarBz2(binArchive, binDest, onLog);
  onProgress?.(88);

  // 模型可能解压到 model/MODEL_NAME/
  let modelDir = join(modelDest, MODEL_NAME);
  if (!existsSync(modelDir)) {
    const kids = existsSync(modelDest) ? readdirSync(modelDest) : [];
    const sub = kids.find((k) => existsSync(join(modelDest, k, "tokens.txt")));
    modelDir = sub ? join(modelDest, sub) : modelDest;
  }
  const modelPaths = resolveModelPaths(modelDir);
  const { microphone, binDir } = resolveMicrophone(binDest);

  const ready: SherpaReady = {
    at: new Date().toISOString(),
    ...modelPaths,
    microphone,
    binDir,
  };
  writeFileSync(sherpaReadyPath(root), `${JSON.stringify(ready, null, 2)}\n`, "utf8");
  // 兼容 pipeline 旧 marker
  writeFileSync(join(base, "ready"), `${ready.at}\n`, "utf8");
  onLog(`sherpa KWS 就绪：${microphone}`);
  onProgress?.(95);
  return ready;
}
