/** 危险指令启发式：命中则要求引用原消息二次确认 */
const DANGER_RES: RegExp[] = [
  /\brm\s+(-[a-zA-Z]*f[a-zA-Z]*|--force).*(\/|\\|~|\*)/i,
  /\brm\s+-rf\b/i,
  /\bdel\s+\/[sq]\b/i,
  /\brd\s+\/s\b/i,
  /\bRemove-Item\b.*(-Recurse|-Force)/i,
  /\bformat\s+[a-z]:/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bpoweroff\b/i,
  /\binit\s+[06]\b/i,
  /\b(curl|wget).*\|\s*(ba)?sh\b/i,
  /\bInvoke-Expression\b/i,
  /\biex\b/i,
  /\bStart-Process\b.*-Verb\s+RunAs/i,
  /\bchmod\s+-R\s+777\s+\//i,
  /\bchown\s+-R\b.*\//i,
  /\bDROP\s+(DATABASE|TABLE|SCHEMA)\b/i,
  /\bTRUNCATE\s+TABLE\b/i,
  /\bmkfifo\b.*\|\s*/i,
  /:\(\)\s*\{\s*:\|:&\s*\};:/,
  /\bdiskpart\b/i,
  /\breg\s+delete\b/i,
  /\bcipher\s+\/w:/i,
  /\bnet\s+user\b.*\/add/i,
  /\bsudo\s+/i,
];

export function isDangerous(code: string): boolean {
  const s = String(code || "");
  if (!s.trim()) return false;
  return DANGER_RES.some((re) => re.test(s));
}

export function dangerHint(code: string): string {
  const hit = DANGER_RES.find((re) => re.test(code));
  return hit ? hit.source.slice(0, 40) : "高危特征";
}
