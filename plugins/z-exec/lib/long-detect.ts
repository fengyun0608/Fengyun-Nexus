import type { ExecLang } from "./env-gate.js";

/** 静态特征：一看就可能跑很久 */
const LONG_PATTERNS: RegExp[] = [
  /\bStart-Sleep\b/i,
  /\bsleep\s*\(/i,
  /\btime\.sleep\b/i,
  /\bThread\.sleep\b/i,
  /\bsetTimeout\b|\bsetInterval\b/i,
  /\bwhile\s*\(\s*true\s*\)/i,
  /\bwhile\s+True\b/i,
  /\bfor\s*\(\s*;\s*;\s*\)/,
  /\btail\s+-f\b/i,
  /\bwatch\s+/i,
  /\bping\s+.*\s-t\b/i,
  /\bGet-Content\b.*-Wait\b/i,
  /\bnpm\s+i(nstall)?\b/i,
  /\bpnpm\s+(i|install|add)\b/i,
  /\byarn\s+add\b/i,
  /\bpip3?\s+install\b/i,
  /\bcargo\s+(build|run|test|install)\b/i,
  /\bgo\s+(build|test|mod)\b/i,
  /\bmvn\s+/i,
  /\bgradle\b/i,
  /\bdocker\s+(build|pull|run|compose)\b/i,
  /\bffmpeg\b/i,
  /\byt-?dlp\b/i,
  /\byoutube-dl\b/i,
  /\bwget\b|\bcurl\b.*\s(-O|--output)\b/i,
  /\bnpx\s+/i,
  /\btsc\b|\bwitness\b/i,
  /下载|安装|编译|训练|爬取|同步|备份|解压|压缩/,
];

/**
 * 启发式：像长时间任务则 true（边跑边推）；
 * 像 `ls` / `print(1)` 则 false（跑完一次合并转发）。
 */
export function looksLikeLongRunning(code: string, lang: ExecLang): boolean {
  const t = code.trim();
  if (!t) return false;
  if (t.length > 2500) return true;
  if (LONG_PATTERNS.some((re) => re.test(t))) return true;

  // 多语句且含循环
  if (/\b(for|while)\b/i.test(t) && (t.includes("\n") || t.length > 80)) return true;

  // shell 管道很长、或显式进度类
  if (lang === "shell" && (t.split("|").length >= 3 || /\bprogress\b/i.test(t))) return true;

  return false;
}

/** 跑过这么久仍未结束 → 升级为持续输出 */
export const LIVE_UPGRADE_MS = 2500;
