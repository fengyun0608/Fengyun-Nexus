import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";

const require = createRequire(import.meta.url);

export type DbDriver = "json" | "memory" | "sqlite";

export interface DbMessageRow {
  id: string;
  channel: string;
  chatId: string;
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface DbPluginRow {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  loadedAt?: string;
}

interface DbFile {
  messages: DbMessageRow[];
  plugins: DbPluginRow[];
  kv: Record<string, string>;
}

export interface NexusDatabaseOptions {
  driver: DbDriver;
  filePath?: string;
}

export interface DbBackendInfo {
  driver: DbDriver;
  filePath?: string;
  persistent: boolean;
  engine?: string;
}

export type DbDetectResult = {
  id: DbDriver;
  label: string;
  available: boolean;
  reason?: string;
  recommended?: boolean;
};

type SqliteDb = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
  };
  close(): void;
};

function tryOpenSqlite(filePath: string): { db: SqliteDb; engine: string } | null {
  try {
    // Node.js 22.5+ / 24+ built-in
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("node:sqlite") as {
      DatabaseSync: new (path: string) => SqliteDb;
    };
    mkdirSync(dirname(filePath), { recursive: true });
    const db = new mod.DatabaseSync(filePath);
    return { db, engine: "node:sqlite" };
  } catch (e) {
    return null;
  }
}

/**
 * Embedded database with real drivers.
 * - sqlite: Node built-in `node:sqlite` (SQL)
 * - json: JSON file fallback
 * - memory: RAM only
 */
export class NexusDatabase {
  private data: DbFile = { messages: [], plugins: [], kv: {} };
  private driver: DbDriver;
  private filePath?: string;
  private sqlite: SqliteDb | null = null;
  private engine = "json";

  constructor(opts: NexusDatabaseOptions | string) {
    if (typeof opts === "string") {
      this.driver = "json";
      this.filePath = opts;
    } else {
      this.driver = opts.driver;
      this.filePath = opts.filePath;
    }
  }

  info(): DbBackendInfo {
    return {
      driver: this.driver,
      filePath: this.filePath,
      persistent: this.driver !== "memory",
      engine: this.engine,
    };
  }

  static detect(): DbDetectResult[] {
    const out: DbDetectResult[] = [
      {
        id: "json",
        label: "JSON 文件库",
        available: true,
        reason: "始终可用，适合轻量部署",
      },
      {
        id: "memory",
        label: "内存库",
        available: true,
        reason: "重启后数据清空",
      },
    ];
    const probe = tryOpenSqlite(":memory:");
    if (probe) {
      try {
        probe.db.exec("SELECT 1");
        probe.db.close();
        out.push({
          id: "sqlite",
          label: "SQLite（node:sqlite）",
          available: true,
          reason: `检测到 ${probe.engine}`,
          recommended: true,
        });
      } catch {
        out.push({
          id: "sqlite",
          label: "SQLite",
          available: false,
          reason: "node:sqlite 打开失败",
        });
      }
    } else {
      out.push({
        id: "sqlite",
        label: "SQLite",
        available: false,
        reason: "当前 Node 未提供 node:sqlite（需 Node ≥ 22.5）",
      });
    }
    return out;
  }

  async open(): Promise<void> {
    if (this.driver === "memory") {
      this.engine = "memory";
      this.data = { messages: [], plugins: [], kv: {} };
      return;
    }

    if (this.driver === "sqlite") {
      const path = this.filePath;
      if (!path) throw new Error("sqlite 需要 filePath");
      const opened = tryOpenSqlite(path);
      if (!opened) {
        throw new Error("无法打开 SQLite：请升级 Node ≥ 22.5，或改用 JSON 库");
      }
      this.sqlite = opened.db;
      this.engine = opened.engine;
      this.sqlite.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          channel TEXT, chatId TEXT, userId TEXT,
          role TEXT, content TEXT, createdAt TEXT
        );
        CREATE TABLE IF NOT EXISTS plugins (
          id TEXT PRIMARY KEY,
          name TEXT, version TEXT, enabled INTEGER, loadedAt TEXT
        );
        CREATE TABLE IF NOT EXISTS kv (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `);
      return;
    }

    // json
    this.engine = "json-file";
    const path = this.filePath;
    if (!path) throw new Error("json 需要 filePath");
    mkdirSync(dirname(path), { recursive: true });
    if (existsSync(path)) {
      try {
        this.data = JSON.parse(readFileSync(path, "utf8")) as DbFile;
        this.data.messages ??= [];
        this.data.plugins ??= [];
        this.data.kv ??= {};
      } catch {
        this.data = { messages: [], plugins: [], kv: {} };
      }
    } else {
      this.persistJson();
    }
  }

  close(): void {
    if (this.sqlite) {
      try {
        this.sqlite.close();
      } catch {
        /* ignore */
      }
      this.sqlite = null;
    }
  }

  private persistJson(): void {
    if (!this.filePath) return;
    writeFileSync(this.filePath, `${JSON.stringify(this.data, null, 2)}\n`, "utf8");
  }

  insertMessage(row: DbMessageRow): void {
    if (this.sqlite) {
      this.sqlite
        .prepare(
          `INSERT OR REPLACE INTO messages (id,channel,chatId,userId,role,content,createdAt)
           VALUES (?,?,?,?,?,?,?)`,
        )
        .run(row.id, row.channel, row.chatId, row.userId, row.role, row.content, row.createdAt);
      return;
    }
    this.data.messages.push(row);
    if (this.data.messages.length > 5000) {
      this.data.messages = this.data.messages.slice(-4000);
    }
    if (this.driver === "json") this.persistJson();
  }

  recentMessages(chatId: string, limit = 40): DbMessageRow[] {
    if (this.sqlite) {
      return this.sqlite
        .prepare(
          `SELECT id,channel,chatId,userId,role,content,createdAt FROM messages
           WHERE chatId=? ORDER BY createdAt DESC LIMIT ?`,
        )
        .all(chatId, limit)
        .reverse() as unknown as DbMessageRow[];
    }
    return this.data.messages.filter((m) => m.chatId === chatId).slice(-limit);
  }

  upsertPlugin(row: DbPluginRow): void {
    if (this.sqlite) {
      this.sqlite
        .prepare(
          `INSERT OR REPLACE INTO plugins (id,name,version,enabled,loadedAt) VALUES (?,?,?,?,?)`,
        )
        .run(row.id, row.name, row.version, row.enabled ? 1 : 0, row.loadedAt ?? null);
      return;
    }
    const i = this.data.plugins.findIndex((p) => p.id === row.id);
    if (i >= 0) this.data.plugins[i] = row;
    else this.data.plugins.push(row);
    if (this.driver === "json") this.persistJson();
  }

  listPlugins(): DbPluginRow[] {
    if (this.sqlite) {
      return this.sqlite
        .prepare(`SELECT id,name,version,enabled,loadedAt FROM plugins`)
        .all()
        .map((r) => ({
          id: String(r.id),
          name: String(r.name),
          version: String(r.version),
          enabled: Boolean(r.enabled),
          loadedAt: r.loadedAt ? String(r.loadedAt) : undefined,
        }));
    }
    return [...this.data.plugins];
  }

  setKv(key: string, value: string): void {
    if (this.sqlite) {
      this.sqlite.prepare(`INSERT OR REPLACE INTO kv (key,value) VALUES (?,?)`).run(key, value);
      return;
    }
    this.data.kv[key] = value;
    if (this.driver === "json") this.persistJson();
  }

  getKv(key: string): string | undefined {
    if (this.sqlite) {
      const row = this.sqlite.prepare(`SELECT value FROM kv WHERE key=?`).get(key);
      return row ? String(row.value) : undefined;
    }
    return this.data.kv[key];
  }

  stats(): { messages: number; plugins: number; kv: number } {
    if (this.sqlite) {
      const m = this.sqlite.prepare(`SELECT COUNT(*) AS c FROM messages`).get();
      const p = this.sqlite.prepare(`SELECT COUNT(*) AS c FROM plugins`).get();
      const k = this.sqlite.prepare(`SELECT COUNT(*) AS c FROM kv`).get();
      return {
        messages: Number(m?.c ?? 0),
        plugins: Number(p?.c ?? 0),
        kv: Number(k?.c ?? 0),
      };
    }
    return {
      messages: this.data.messages.length,
      plugins: this.data.plugins.length,
      kv: Object.keys(this.data.kv).length,
    };
  }
}
