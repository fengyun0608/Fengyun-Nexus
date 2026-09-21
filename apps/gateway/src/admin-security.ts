/**
 * 管理面安全：密码哈希、登录限速、Webhook/绑定辅助。
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { AdminConfig } from "@fengyun/nexus-shared";

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 32;

/** scrypt$N$r$p$salt$hash */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  }).toString("base64url");
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${hash}`;
}

export function verifyPasswordHash(password: string, stored: string): boolean {
  if (!stored.startsWith("scrypt$")) return false;
  const parts = stored.split("$");
  if (parts.length !== 6) return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = parts[4];
  const expectB64 = parts[5];
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p) || !salt || !expectB64) {
    return false;
  }
  try {
    const got = scryptSync(password, salt, SCRYPT_KEYLEN, { N: n, r, p });
    const expect = Buffer.from(expectB64, "base64url");
    if (got.length !== expect.length) return false;
    return timingSafeEqual(got, expect);
  } catch {
    return false;
  }
}

export function safeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function verifyAdminPassword(
  password: string,
  cfg: Pick<AdminConfig, "passwordEnv" | "defaultPassword" | "passwordHash">,
): boolean {
  const envName = cfg.passwordEnv || "NEXUS_ADMIN_PASSWORD";
  const envPass = process.env[envName];
  if (typeof envPass === "string" && envPass.length > 0) {
    return safeEqualStr(password, envPass);
  }
  if (cfg.passwordHash) {
    return verifyPasswordHash(password, cfg.passwordHash);
  }
  if (typeof cfg.defaultPassword === "string" && cfg.defaultPassword.length > 0) {
    return safeEqualStr(password, cfg.defaultPassword);
  }
  return false;
}

/** 写入 local 时：有哈希则清空明文口令 */
export function adminPersistShape(cfg: AdminConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {
    username: cfg.username,
    passwordEnv: cfg.passwordEnv,
    sessionHours: cfg.sessionHours,
    setupCompleted: cfg.setupCompleted,
  };
  if (cfg.passwordHash) {
    out.passwordHash = cfg.passwordHash;
    out.defaultPassword = "";
  } else {
    out.defaultPassword = cfg.defaultPassword ?? "";
  }
  return out;
}

type FailRec = { count: number; lockedUntil: number };

/**
 * 登录失败限速：同一 IP+用户名，连续失败后锁定一段时间。
 */
export class LoginRateLimiter {
  private readonly fails = new Map<string, FailRec>();
  constructor(
    private readonly maxFails = 8,
    private readonly windowMs = 15 * 60_000,
    private readonly lockMs = 5 * 60_000,
  ) {}

  key(ip: string, username: string): string {
    return `${String(ip || "?").trim()}|${String(username || "").trim().toLowerCase()}`;
  }

  /** 若锁定中，返回剩余秒数；否则 0 */
  blockedSeconds(ip: string, username: string): number {
    const rec = this.fails.get(this.key(ip, username));
    if (!rec) return 0;
    const left = rec.lockedUntil - Date.now();
    if (left <= 0) return 0;
    return Math.ceil(left / 1000);
  }

  hitFail(ip: string, username: string): { locked: boolean; retryAfterSec: number } {
    const k = this.key(ip, username);
    const now = Date.now();
    let rec = this.fails.get(k);
    if (!rec || now - rec.lockedUntil > this.windowMs) {
      rec = { count: 0, lockedUntil: 0 };
    }
    if (rec.lockedUntil > now) {
      return { locked: true, retryAfterSec: Math.ceil((rec.lockedUntil - now) / 1000) };
    }
    rec.count += 1;
    if (rec.count >= this.maxFails) {
      rec.lockedUntil = now + this.lockMs;
      rec.count = 0;
      this.fails.set(k, rec);
      return { locked: true, retryAfterSec: Math.ceil(this.lockMs / 1000) };
    }
    this.fails.set(k, rec);
    return { locked: false, retryAfterSec: 0 };
  }

  clear(ip: string, username: string): void {
    this.fails.delete(this.key(ip, username));
  }
}

/** 解析监听地址：环境变量优先，否则用姿态配置，再否则本机回环 */
export function resolveListenHost(profileHost: string | undefined): string {
  const fromEnv = String(process.env.HOST || "").trim();
  if (fromEnv) return fromEnv;
  const fromProfile = String(profileHost || "").trim();
  if (fromProfile) return fromProfile;
  return "127.0.0.1";
}

export function extractBearer(authorization?: string): string {
  const h = String(authorization || "");
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

export function webhookTokenFromRequest(req: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const x = req.headers["x-nexus-token"];
  if (typeof x === "string" && x.trim()) return x.trim();
  if (Array.isArray(x) && x[0]) return String(x[0]).trim();
  return extractBearer(typeof req.headers.authorization === "string" ? req.headers.authorization : "");
}
