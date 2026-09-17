/** Colored level-prefixed logger for terminal (ANSI). */
const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
};

function stamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function line(level: string, color: string, msg: string, ...extra: unknown[]): void {
  const head = `${c.gray}${stamp()}${c.reset} ${color}${c.bold}${level.padEnd(5)}${c.reset}`;
  if (extra.length) console.log(`${head} ${msg}`, ...extra);
  else console.log(`${head} ${msg}`);
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
