/** Colored level-prefixed logger + in-memory ring for console. */
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
};

export type LogLevel = "DEBUG" | "INFO" | "OK" | "WARN" | "ERROR" | "PLUGIN";

export type LogEntry = {
  at: string;
  level: LogLevel;
  message: string;
};

const RING_MAX = 500;
const ring: LogEntry[] = [];

function stamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function push(level: LogLevel, msg: string): void {
  ring.push({ at: new Date().toISOString(), level, message: msg });
  if (ring.length > RING_MAX) ring.splice(0, ring.length - RING_MAX);
}

function line(level: LogLevel, color: string, msg: string, ...extra: unknown[]): void {
  push(level, msg);
  const head = `${c.gray}${stamp()}${c.reset} ${color}${c.bold}${level.padEnd(5)}${c.reset}`;
  if (extra.length) console.log(`${head} ${msg}`, ...extra);
  else console.log(`${head} ${msg}`);
}

export function getLogEntries(limit = 120): LogEntry[] {
  const n = Math.min(Math.max(limit, 1), RING_MAX);
  return ring.slice(-n);
}

export type LogQuery = {
  limit?: number;
  /** 例如 ERROR / WARN；不传则全部 */
  levels?: string[];
  /** 消息包含关键词（不区分大小写） */
  contains?: string;
};

/** 查框架内存日志环（控制台 / Agent / MCP 共用）。 */
export function queryLogEntries(q: LogQuery = {}): {
  total: number;
  matched: number;
  items: LogEntry[];
  summary: { error: number; warn: number; other: number };
} {
  const limit = Math.min(Math.max(Number(q.limit) || 80, 1), RING_MAX);
  const levels = (q.levels || [])
    .map((x) => String(x || "").trim().toUpperCase())
    .filter(Boolean);
  const needle = String(q.contains || "").trim().toLowerCase();

  let pool = ring.slice();
  if (levels.length) {
    const set = new Set(levels);
    pool = pool.filter((e) => set.has(e.level));
  }
  if (needle) {
    pool = pool.filter((e) => e.message.toLowerCase().includes(needle));
  }

  const summary = { error: 0, warn: 0, other: 0 };
  for (const e of pool) {
    if (e.level === "ERROR") summary.error += 1;
    else if (e.level === "WARN") summary.warn += 1;
    else summary.other += 1;
  }

  const items = pool.slice(-limit);
  return { total: ring.length, matched: pool.length, items, summary };
}

export const log = {
  debug: (msg: string, ...extra: unknown[]) => line("DEBUG", c.blue, msg, ...extra),
  info: (msg: string, ...extra: unknown[]) => line("INFO", c.cyan, msg, ...extra),
  ok: (msg: string, ...extra: unknown[]) => line("OK", c.green, msg, ...extra),
  warn: (msg: string, ...extra: unknown[]) => line("WARN", c.yellow, msg, ...extra),
  error: (msg: string, ...extra: unknown[]) => line("ERROR", c.red, msg, ...extra),
  plugin: (id: string, msg: string, ...extra: unknown[]) =>
    line("PLUGIN", c.magenta, `[${id}] ${msg}`, ...extra),
};
