<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { NSpin, NTag } from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const router = useRouter();
const loading = ref(true);
const meta = ref<Record<string, unknown> | null>(null);
const health = ref<Record<string, unknown> | null>(null);
const overview = ref<Record<string, unknown> | null>(null);
const showRaw = ref(false);
const err = ref("");

const version = computed(() => String((meta.value as any)?.version ?? "—"));
const envId = computed(() => String((meta.value as any)?.env?.id || (health.value as any)?.env || "—"));
const pluginCount = computed(() => {
  const fromMeta = (meta.value as any)?.plugins?.loaded;
  const fromHealth = (health.value as any)?.plugins;
  const fromOv = Array.isArray((overview.value as any)?.plugins)
    ? (overview.value as any).plugins.length
    : undefined;
  return fromMeta ?? fromOv ?? fromHealth ?? "—";
});
const channelCount = computed(() => {
  const ch = (overview.value as any)?.channels;
  return Array.isArray(ch) ? ch.length : "—";
});
const healthy = computed(() => Boolean((health.value as any)?.ok));

const shortcuts = [
  { to: "/channels", label: "消息通道", hint: "主人、本通道插件、连接" },
  { to: "/plugins", label: "插件包", hint: "消息通道包 / 系统插件包" },
  { to: "/ai", label: "AI 层", hint: "供应商与密钥" },
  { to: "/onebot", label: "OneBot 11", hint: "反向 WS / HTTP" },
  { to: "/env-setup", label: "环境配置", hint: "Go / Python / 浏览器" },
  { to: "/logs", label: "日志", hint: "网关与最近消息" },
];

onMounted(async () => {
  loading.value = true;
  err.value = "";
  try {
    const [m, h, o] = await Promise.all([
      api<Record<string, unknown>>("/v1/meta", { token: auth.token }),
      api<Record<string, unknown>>("/health", { token: auth.token }),
      api<Record<string, unknown>>("/v1/admin/overview", { token: auth.token }).catch(() => null),
    ]);
    meta.value = m;
    health.value = h;
    overview.value = o;
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1 class="title-toggle" @click="showRaw = !showRaw">概览</h1>
      <p class="muted">运行状态一眼看完。点标题可切换原始数据。</p>
    </header>
    <n-spin :show="loading">
      <p v-if="err" class="err">{{ err }}</p>
      <template v-else>
        <div v-if="!showRaw" class="chips">
          <div class="chip">版本 <strong>{{ version }}</strong></div>
          <div class="chip">姿态 <strong>{{ envId }}</strong></div>
          <div class="chip">插件 <strong>{{ pluginCount }}</strong></div>
          <div class="chip">通道 <strong>{{ channelCount }}</strong></div>
          <div class="chip">
            健康
            <n-tag size="small" :type="healthy ? 'success' : 'warning'" :bordered="false" style="margin-left: 6px">
              {{ healthy ? "正常" : "异常" }}
            </n-tag>
          </div>
        </div>
        <pre v-else class="mono raw">{{ JSON.stringify({ meta, health, overview }, null, 2) }}</pre>

        <h2 class="sub">快捷入口</h2>
        <div class="layer-grid tight">
          <button
            v-for="s in shortcuts"
            :key="s.to"
            type="button"
            class="layer-card"
            @click="router.push(s.to)"
          >
            <strong>{{ s.label }}</strong>
            <span>{{ s.hint }}</span>
          </button>
        </div>
      </template>
    </n-spin>
  </div>
</template>

<style scoped>
@import "@/styles/page.css";
.title-toggle {
  cursor: pointer;
}
.title-toggle:hover {
  filter: brightness(1.08);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}
.chip {
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.2);
  color: var(--muted);
  font-size: 0.88rem;
}
.chip strong {
  color: var(--ink);
  margin-left: 4px;
}
.sub {
  margin: 8px 0 4px;
  font-family: var(--font-display);
  font-size: 1.15rem;
  color: var(--amber);
}
.layer-grid.tight {
  padding: 8px 0 0;
}
.raw {
  max-height: 50vh;
  margin-bottom: 16px;
}
</style>
