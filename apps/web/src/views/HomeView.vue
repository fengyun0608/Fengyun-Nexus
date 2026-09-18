<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { NButton, NSpin, NSpace } from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

type PluginItem = {
  id: string;
  name?: string;
  version?: string;
  enabled?: boolean;
  kind?: "channel" | "framework";
  adapterScope?: "all" | "channel" | "specified";
};
type ChannelItem = { id: string; label?: string; connected?: boolean; clients?: number };
type DbInfo = {
  active?: string;
  info?: { driver?: string; filePath?: string };
  stats?: { messages?: number; plugins?: number; kv?: number };
};
type LlmInfo = {
  activeId?: string;
  hasKey?: boolean;
  model?: string;
  providers?: Array<{ id: string; name: string; model?: string; hasKey?: boolean }>;
};
type OneBotInfo = {
  connected?: boolean;
  clients?: number;
  selfId?: string;
  enabled?: boolean;
  bots?: Array<{ selfId: string; label: string; connected: boolean; apiBase: string }>;
};
type FeedMsg = {
  id: string;
  channel: string;
  chatId: string;
  userId: string;
  role: string;
  content: string;
  createdAt: string;
  accountId?: string;
};

const auth = useAuthStore();
const loading = ref(true);
const refreshing = ref(false);
const err = ref("");
const showRaw = ref(false);

const meta = ref<Record<string, unknown> | null>(null);
const health = ref<Record<string, unknown> | null>(null);
const channels = ref<ChannelItem[]>([]);
const plugins = ref<PluginItem[]>([]);
const dbInfo = ref<DbInfo | null>(null);
const llmInfo = ref<LlmInfo | null>(null);
const onebotInfo = ref<OneBotInfo | null>(null);
const feedItems = ref<FeedMsg[]>([]);
const feedPowerOff = ref(false);

let timer: number | undefined;

const displayEnv = computed(() =>
  String((meta.value as any)?.env?.label || (meta.value as any)?.env?.id || (health.value as any)?.env || "—"),
);
const version = computed(() => String((meta.value as any)?.version || "—"));
const featureList = computed(() => {
  const f = (meta.value as any)?.features;
  if (!f || typeof f !== "object") return [] as string[];
  return Object.entries(f as Record<string, unknown>)
    .filter(([, v]) => v)
    .map(([k]) => k);
});
const channelPluginCount = computed(
  () =>
    plugins.value.filter((p) => {
      const scope = p.adapterScope || (p.kind === "framework" ? "all" : "specified");
      return scope !== "all";
    }).length,
);
const systemPluginCount = computed(
  () =>
    plugins.value.filter((p) => {
      const scope = p.adapterScope || (p.kind === "framework" ? "all" : "specified");
      return scope === "all";
    }).length,
);
const msgCount = computed(
  () => dbInfo.value?.stats?.messages ?? (meta.value as any)?.db?.messages ?? feedItems.value.length,
);
const aiName = computed(() => {
  const id = llmInfo.value?.activeId;
  return llmInfo.value?.providers?.find((p) => p.id === id)?.name || "—";
});

const tiles = computed(() => [
  { label: "版本", value: version.value, sub: "package.json" },
  { label: "健康", value: (health.value as any)?.ok ? "正常" : "异常", sub: String((health.value as any)?.time || "").replace("T", " ").slice(0, 19) },
  { label: "姿态", value: displayEnv.value, sub: String((meta.value as any)?.env?.id || "") },
  { label: "电源", value: feedPowerOff.value ? "已关机" : "运行中", sub: feedPowerOff.value ? "软关机中" : "可收消息" },
  { label: "通道", value: String(channels.value.length), sub: channels.value.map((c) => c.label || c.id).join(" · ") || "无" },
  { label: "插件", value: String(plugins.value.length), sub: `通道 ${channelPluginCount.value} · 系统 ${systemPluginCount.value}` },
  { label: "已启用插件", value: String(plugins.value.filter((p) => p.enabled !== false).length), sub: "停用的不响应" },
  { label: "消息", value: String(msgCount.value), sub: `库记录 ${dbInfo.value?.stats?.messages ?? "—"}` },
  { label: "数据库", value: dbInfo.value?.info?.driver || dbInfo.value?.active || "—", sub: dbInfo.value?.info?.filePath || "路径未报" },
  { label: "键值", value: String(dbInfo.value?.stats?.kv ?? "—"), sub: "本地 kv" },
  { label: "OneBot", value: onebotInfo.value?.connected ? "已连接" : "未连接", sub: `客户端 ${onebotInfo.value?.clients ?? 0} · ${onebotInfo.value?.enabled === false ? "未启用" : "已启用"}` },
  { label: "机器人", value: onebotInfo.value?.selfId || onebotInfo.value?.bots?.[0]?.selfId || "—", sub: `${onebotInfo.value?.bots?.length || 0} 个号` },
  { label: "AI", value: aiName.value, sub: llmInfo.value?.hasKey ? "已配密钥" : "无密钥" },
  { label: "模型", value: llmInfo.value?.model || llmInfo.value?.providers?.find((p) => p.id === llmInfo.value?.activeId)?.model || "—", sub: llmInfo.value?.activeId || "" },
  { label: "用户", value: auth.username || "—", sub: "当前登录" },
  { label: "能力", value: String(featureList.value.length), sub: featureList.value.slice(0, 4).join(" · ") || "—" },
  { label: "最近入站", value: String(feedItems.value.length), sub: "本页已拉到的条数" },
  { label: "插件记录", value: String(dbInfo.value?.stats?.plugins ?? "—"), sub: "库里登记" },
]);

const rawPayload = computed(() => ({
  health: health.value,
  meta: meta.value,
  db: dbInfo.value,
  channels: channels.value,
  plugins: plugins.value,
  llm: llmInfo.value,
  onebot: onebotInfo.value,
  powerOff: feedPowerOff.value,
  recentMessages: feedItems.value.slice(0, 20),
}));

const feedGroups = computed(() => {
  const bots = onebotInfo.value?.bots || [];
  const nameOf = (id: string) => {
    const hit = bots.find((b) => b.selfId === id);
    return hit ? `${hit.label || "未备注"} ${id}` : id;
  };
  const map = new Map<string, { key: string; title: string; items: FeedMsg[] }>();
  for (const row of feedItems.value) {
    const key = String(row.accountId || "");
    if (!map.has(key)) {
      map.set(key, { key, title: key ? nameOf(key) : "未分账号", items: [] });
    }
    map.get(key)!.items.push(row);
  }
  return [...map.values()];
});

function fmtTime(iso: string): string {
  return String(iso || "").replace("T", " ").slice(0, 19) || "—";
}

async function loadAll(opts?: { soft?: boolean }) {
  if (!opts?.soft) loading.value = true;
  else refreshing.value = true;
  err.value = "";
  try {
    const [m, h, ch, pl, db, llm, ob, feed] = await Promise.all([
      api<Record<string, unknown>>("/v1/meta", { token: auth.token }),
      api<Record<string, unknown>>("/health", { token: auth.token }),
      api<{ items: ChannelItem[] }>("/v1/channels", { token: auth.token }),
      api<{ items: PluginItem[] }>("/v1/plugins", { token: auth.token }),
      api<DbInfo>("/v1/admin/db", { token: auth.token }).catch(() => null),
      api<LlmInfo>("/v1/admin/llm", { token: auth.token }).catch(() => null),
      api<OneBotInfo>("/v1/channels/onebot11", { token: auth.token }).catch(() => null),
      api<{ items: FeedMsg[]; powerOff?: boolean }>("/v1/messages/recent?limit=80", {
        token: auth.token,
      }).catch(() => ({ items: [] as FeedMsg[], powerOff: false })),
    ]);
    meta.value = m;
    health.value = h;
    channels.value = ch.items || [];
    plugins.value = pl.items || [];
    dbInfo.value = db;
    llmInfo.value = llm;
    onebotInfo.value = ob;
    feedItems.value = feed.items || [];
    feedPowerOff.value = Boolean(feed.powerOff);
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
}

onMounted(() => {
  void loadAll();
  timer = window.setInterval(() => void loadAll({ soft: true }), 5000);
});
onUnmounted(() => {
  if (timer) window.clearInterval(timer);
});
</script>

<template>
  <div class="page">
    <header class="page-head hero-with-raw">
      <div>
        <h1
          class="title-toggle"
          role="button"
          tabindex="0"
          @click="showRaw = !showRaw"
          @keydown.enter="showRaw = !showRaw"
        >
          概览
        </h1>
        <p class="muted">运行全貌。点标题可看原始数据。</p>
      </div>
      <n-space>
        <n-button size="small" quaternary :loading="refreshing" @click="loadAll({ soft: true })">
          刷新
        </n-button>
        <n-button size="small" quaternary @click="showRaw = !showRaw">
          {{ showRaw ? "收起原始数据" : "查看原始数据" }}
        </n-button>
      </n-space>
    </header>

    <n-spin :show="loading">
      <p v-if="err" class="err">{{ err }}</p>
      <template v-else>
        <pre v-if="showRaw" class="mono raw-page">{{ JSON.stringify(rawPayload, null, 2) }}</pre>
        <template v-else>
          <div class="dash-board">
            <div class="dash-grid">
              <div v-for="t in tiles" :key="t.label" class="dash-tile">
                <span>{{ t.label }}</span>
                <strong>{{ t.value }}</strong>
                <em>{{ t.sub }}</em>
              </div>
            </div>
          </div>

          <div class="info-cols">
            <section class="info-card">
              <h2>通道</h2>
              <p v-if="!channels.length" class="muted">没有挂载通道</p>
              <div v-for="c in channels" :key="c.id" class="info-line">
                <strong>{{ c.label || c.id }}</strong>
                <span v-if="c.id === 'onebot11'">{{ c.connected ? "已连接" : "未连接" }}{{ c.clients ? ` · ${c.clients} 路` : "" }}</span>
                <span v-else>{{ c.id }}</span>
              </div>
            </section>
            <section class="info-card">
              <h2>插件</h2>
              <p v-if="!plugins.length" class="muted">没有插件</p>
              <div v-for="p in plugins" :key="p.id" class="info-line">
                <strong>{{ p.name || p.id }}</strong>
                <span>{{ p.enabled === false ? "停用" : "启用" }} · {{ p.version || "—" }} · {{ p.id }}</span>
              </div>
            </section>
            <section class="info-card">
              <h2>OneBot</h2>
              <p v-if="!(onebotInfo?.bots || []).length" class="muted">还没有机器人号</p>
              <div v-for="b in onebotInfo?.bots || []" :key="b.selfId + b.label" class="info-line">
                <strong>{{ b.label || b.selfId || "未备注" }}</strong>
                <span>{{ b.connected ? "已连接" : "未连接" }}</span>
              </div>
            </section>
            <section class="info-card">
              <h2>AI 供应商</h2>
              <p v-if="!(llmInfo?.providers || []).length" class="muted">没有供应商</p>
              <div v-for="p in llmInfo?.providers || []" :key="p.id" class="info-line">
                <strong>{{ p.name }}</strong>
                <span>{{ llmInfo?.activeId === p.id ? "使用中" : "备用" }} · {{ p.model || "—" }} · {{ p.hasKey ? "有密钥" : "无密钥" }}</span>
              </div>
            </section>
          </div>

          <section class="feed-section">
            <div class="feed-head">
              <h2>最近消息</h2>
              <div class="chips tight">
                <div class="chip">
                  电源
                  <strong>{{ feedPowerOff ? "已关机" : "运行中" }}</strong>
                </div>
                <div class="chip">
                  条数 <strong>{{ feedItems.length }}</strong>
                </div>
              </div>
            </div>
            <p class="hint">管理指令以 # 开头。列表约每 5 秒刷新。</p>
            <div class="log-list feed">
              <p v-if="!feedItems.length" class="muted pad">暂无实时消息</p>
              <section v-for="g in feedGroups" :key="g.key || 'none'" class="feed-group">
                <h3>{{ g.title }}</h3>
                <div v-for="row in g.items" :key="row.id" class="log-row feed-row">
                  <span class="muted">{{ fmtTime(row.createdAt) }}</span>
                  <span class="lvl">{{ row.channel }}</span>
                  <span class="muted who">{{ row.role }}:{{ row.userId }}</span>
                  <span class="content">{{ row.content }}</span>
                </div>
              </section>
            </div>
          </section>
        </template>
      </template>
    </n-spin>
  </div>
</template>

<style scoped>
@import "@/styles/page.css";

.page-head.hero-with-raw {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.title-toggle {
  cursor: pointer;
}
.title-toggle:hover {
  filter: brightness(1.08);
}
.dash-board {
  padding: 4px 0 8px;
}
.dash-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
  gap: 10px;
}
.dash-tile {
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 12px 14px 10px;
  background: var(--surface);
  display: grid;
  gap: 4px;
  min-height: 92px;
}
.dash-tile span {
  color: var(--muted);
  font-size: 0.78rem;
}
.dash-tile strong {
  font-size: 1.15rem;
  font-family: var(--font-display);
  color: var(--amber);
  word-break: break-word;
  line-height: 1.25;
}
.dash-tile em {
  font-style: normal;
  color: var(--muted);
  font-size: 0.75rem;
  line-height: 1.35;
  word-break: break-word;
}
.info-cols {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.info-card {
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface-2);
  padding: 12px 12px 6px;
  max-height: 360px;
  overflow: auto;
}
.info-card h2 {
  margin: 0 0 8px;
  font-size: 1rem;
  color: var(--amber);
  font-family: var(--font-display);
}
.info-line {
  display: grid;
  gap: 2px;
  padding: 8px 0;
  border-top: 1px solid var(--line);
}
.info-line strong {
  font-size: 0.92rem;
}
.info-line span {
  color: var(--muted);
  font-size: 0.78rem;
  word-break: break-all;
}
.feed-section {
  margin-top: 18px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface-2);
  padding: 14px 14px 8px;
}
.feed-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.feed-head h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.15rem;
  color: var(--amber);
}
.chips.tight {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0;
}
.chip {
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.2);
  color: var(--muted);
  font-size: 0.82rem;
}
.chip strong {
  color: var(--amber);
  margin-left: 4px;
}
.feed-group h3 {
  margin: 10px 0 4px;
  font-size: 0.95rem;
}
.log-list.feed {
  padding: 4px 0 8px;
  max-height: min(48vh, 420px);
}
.log-row.feed-row {
  display: grid;
  grid-template-columns: 140px 72px minmax(80px, 120px) 1fr;
  gap: 8px;
  align-items: start;
  font-size: 0.82rem;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(47, 155, 120, 0.12);
  background: var(--surface);
}
.lvl {
  font-weight: 700;
  color: var(--amber);
}
.who {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.content {
  word-break: break-word;
}
.raw-page {
  max-height: min(70vh, 640px);
}
.pad {
  padding: 12px 4px;
}
@media (max-width: 720px) {
  .log-row.feed-row {
    grid-template-columns: 1fr 1fr;
  }
  .log-row.feed-row .content {
    grid-column: 1 / -1;
  }
}
</style>
