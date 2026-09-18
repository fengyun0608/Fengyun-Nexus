/**
 * #状态 顶部账号卡：头像、名称、群/好友、收发消息、本次与累计在线。
 */
import { formatUptime } from "./restart-notify.js";

export const ONLINE_KV = "status.bot.onlineMs";

export type StatusAccount = {
  selfId: string;
  label: string;
  nickname: string;
  connected: boolean;
  friends: number | null;
  groups: number | null;
  msgIn: number;
  msgOut: number;
  session: string;
  totalOnline: string;
  avatar: string;
};

export function readOnlineTotals(raw: string | undefined): Record<string, number> {
  try {
    const j = JSON.parse(raw || "{}") as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(j)) {
      const n = Number(v);
      if (k && Number.isFinite(n) && n > 0) out[k] = Math.floor(n);
    }
    return out;
  } catch {
    return {};
  }
}

export function addOnlineTotal(
  prev: Record<string, number>,
  selfId: string,
  addMs: number,
): Record<string, number> {
  const id = String(selfId || "").trim();
  if (!id || addMs < 500) return prev;
  return { ...prev, [id]: (prev[id] || 0) + Math.floor(addMs) };
}

function listLen(data: unknown): number | null {
  if (Array.isArray(data)) return data.length;
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  for (const k of ["data", "friends", "groups", "items"]) {
    if (Array.isArray(o[k])) return o[k].length;
  }
  return null;
}

function nickOf(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const o = data as Record<string, unknown>;
  return String(o.nickname || o.nick || "").trim();
}

async function qqAvatar(qq: string): Promise<string> {
  if (!/^\d{5,12}$/.test(qq)) return "";
  try {
    const res = await fetch(`https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=100`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return "";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 80) return "";
    const ct = (res.headers.get("content-type") || "image/jpeg").split(";")[0];
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

export async function collectStatusAccounts(opts: {
  bots: Array<{ selfId: string; label: string; connected: boolean }>;
  call: (
    action: string,
    botId: string,
  ) => Promise<{ ok: boolean; data?: unknown }>;
  sessionMs: (selfId: string) => number;
  totalMs: (selfId: string) => number;
  counts: (selfId: string) => { received: number; sent: number };
}): Promise<StatusAccount[]> {
  const rows = await Promise.all(
    (opts.bots || []).map(async (b) => {
      const selfId = String(b.selfId || "").trim();
      const counts = selfId ? opts.counts(selfId) : { received: 0, sent: 0 };
      const session = selfId ? opts.sessionMs(selfId) : 0;
      const stored = selfId ? opts.totalMs(selfId) : 0;
      const total = stored + (b.connected ? session : 0);
      let nickname = "";
      let friends: number | null = null;
      let groups: number | null = null;
      if (b.connected && selfId) {
        const [login, fr, gr, avatar] = await Promise.all([
          opts.call("get_login_info", selfId).catch(() => ({ ok: false as const })),
          opts.call("get_friend_list", selfId).catch(() => ({ ok: false as const })),
          opts.call("get_group_list", selfId).catch(() => ({ ok: false as const })),
          qqAvatar(selfId),
        ]);
        if (login.ok) nickname = nickOf(login.data);
        if (fr.ok) friends = listLen(fr.data) ?? 0;
        if (gr.ok) groups = listLen(gr.data) ?? 0;
        return {
          selfId,
          label: b.label || "未备注",
          nickname: nickname || b.label || "未命名",
          connected: true,
          friends,
          groups,
          msgIn: counts.received,
          msgOut: counts.sent,
          session: session > 0 ? formatUptime(session) : "刚连上",
          totalOnline: formatUptime(total),
          avatar,
        };
      }
      const avatar = selfId ? await qqAvatar(selfId) : "";
      return {
        selfId,
        label: b.label || "未备注",
        nickname: b.label || (selfId ? `QQ ${selfId}` : "未命名"),
        connected: false,
        friends,
        groups,
        msgIn: counts.received,
        msgOut: counts.sent,
        session: "离线",
        totalOnline: formatUptime(stored),
        avatar,
      };
    }),
  );
  rows.sort((a, b) => Number(b.connected) - Number(a.connected) || a.nickname.localeCompare(b.nickname, "zh"));
  return rows;
}
