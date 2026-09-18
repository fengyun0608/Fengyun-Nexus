<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  NButton,
  NCard,
  NSpin,
  NDescriptions,
  NDescriptionsItem,
  NTag,
  NSpace,
} from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const router = useRouter();
const loading = ref(true);
const meta = ref<Record<string, unknown> | null>(null);
const health = ref<Record<string, unknown> | null>(null);
const overview = ref<Record<string, unknown> | null>(null);
const err = ref("");

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

const shortcuts = [
  { to: "/channels", label: "消息通道" },
  { to: "/onebot", label: "OneBot 11" },
  { to: "/ai", label: "AI 层" },
  { to: "/plugins", label: "插件" },
  { to: "/env-setup", label: "环境配置" },
  { to: "/logs", label: "日志" },
];
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>概览</h1>
      <p class="muted">运行状态一眼看完，常用入口在下面。</p>
    </header>
    <n-spin :show="loading">
      <p v-if="err" class="err">{{ err }}</p>
      <div v-else class="grid-2">
        <n-card title="框架" size="small">
          <n-descriptions :column="1" label-placement="left" size="small">
            <n-descriptions-item label="版本">
              {{ (meta as any)?.version ?? "—" }}
            </n-descriptions-item>
            <n-descriptions-item label="姿态">
              {{ (meta as any)?.env?.id || (health as any)?.env || "—" }}
            </n-descriptions-item>
            <n-descriptions-item label="插件">
              {{ (meta as any)?.plugins?.loaded ?? (health as any)?.plugins ?? "—" }}
            </n-descriptions-item>
          </n-descriptions>
        </n-card>
        <n-card title="健康" size="small">
          <n-tag :type="(health as any)?.ok ? 'success' : 'warning'" size="small">
            {{ (health as any)?.ok ? "正常" : "异常" }}
          </n-tag>
          <p class="muted pad">{{ (health as any)?.time || "" }}</p>
          <p v-if="overview" class="hint">
            {{ JSON.stringify(overview).slice(0, 120) }}…
          </p>
        </n-card>
      </div>
      <n-card title="快捷入口" size="small" style="margin-top: 14px">
        <n-space>
          <n-button v-for="s in shortcuts" :key="s.to" @click="router.push(s.to)">
            {{ s.label }}
          </n-button>
        </n-space>
      </n-card>
    </n-spin>
  </div>
</template>

<style scoped>
@import "@/styles/page.css";
.pad { margin-top: 10px; }
</style>
