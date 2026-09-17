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

export const log = {
  debug: (msg: string, ...extra: unknown[]) => line("DEBUG", c.blue, msg, ...extra),
  info: (msg: string, ...extra: unknown[]) => line("INFO", c.cyan, msg, ...extra),
  ok: (msg: string, ...extra: unknown[]) => line("OK", c.green, msg, ...extra),
  warn: (msg: string, ...extra: unknown[]) => line("WARN", c.yellow, msg, ...extra),
  error: (msg: string, ...extra: unknown[]) => line("ERROR", c.red, msg, ...extra),
  plugin: (id: string, msg: string, ...extra: unknown[]) =>
    line("PLUGIN", c.magenta, `[${id}] ${msg}`, ...extra),
};
