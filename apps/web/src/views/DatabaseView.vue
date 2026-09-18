<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  NButton,
  NCard,
  NSpace,
  NSpin,
  NTag,
  NDescriptions,
  NDescriptionsItem,
  useMessage,
} from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

type DbInfo = {
  active?: string;
  info?: { driver?: string; filePath?: string; persistent?: boolean; engine?: string };
  stats?: { messages?: number; plugins?: number; kv?: number };
  backends?: Array<{ id: string; enabled: boolean; label: string; path?: string }>;
  items?: Array<{ id: string; label: string; available: boolean; reason?: string; recommended?: boolean }>;
  message?: string;
};

const auth = useAuthStore();
const message = useMessage();
const loading = ref(true);
const busy = ref("");
const err = ref("");
const info = ref<DbInfo | null>(null);

async function load() {
  loading.value = true;
  err.value = "";
  try {
    info.value = await api<DbInfo>("/v1/admin/db", { token: auth.token });
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function detect() {
  busy.value = "detect";
  try {
    info.value = await api<DbInfo>("/v1/admin/db/detect", { token: auth.token });
    message.success("已探测可用驱动");
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    busy.value = "";
  }
}

async function switchTo(id: string) {
  busy.value = id;
  try {
    info.value = await api<DbInfo>("/v1/admin/db/switch", {
      method: "POST",
      token: auth.token,
      body: JSON.stringify({ id }),
    });
    message.success(info.value.message || `已切换到 ${id}`);
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    busy.value = "";
  }
}

onMounted(() => void load());
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>数据库</h1>
      <p class="muted">查看当前驱动与统计，可切换 JSON / SQLite 等后端。</p>
    </header>
    <n-space style="margin-bottom: 12px">
      <n-button @click="load">刷新</n-button>
      <n-button :loading="busy === 'detect'" @click="detect">探测</n-button>
    </n-space>
    <n-spin :show="loading">
      <p v-if="err" class="err">{{ err }}</p>
      <template v-else>
        <n-card title="当前" size="small" style="margin-bottom: 14px">
          <n-descriptions :column="2" label-placement="left" size="small">
            <n-descriptions-item label="活动">{{ info?.active || "—" }}</n-descriptions-item>
            <n-descriptions-item label="驱动">{{ info?.info?.driver || "—" }}</n-descriptions-item>
            <n-descriptions-item label="路径">{{ info?.info?.filePath || "—" }}</n-descriptions-item>
            <n-descriptions-item label="消息数">{{ info?.stats?.messages ?? "—" }}</n-descriptions-item>
          </n-descriptions>
        </n-card>
        <div class="grid-2">
          <n-card
            v-for="b in info?.backends || []"
            :key="b.id"
            size="small"
            :title="b.label || b.id"
          >
            <n-space>
              <n-tag size="small" :type="info?.active === b.id ? 'success' : 'default'">
                {{ info?.active === b.id ? "使用中" : b.enabled ? "可用" : "未启用" }}
              </n-tag>
              <n-button
                size="small"
                type="primary"
                :disabled="info?.active === b.id || !b.enabled"
                :loading="busy === b.id"
                @click="switchTo(b.id)"
              >
                切换
              </n-button>
            </n-space>
            <p v-if="b.path" class="hint mono">{{ b.path }}</p>
          </n-card>
        </div>
      </template>
    </n-spin>
  </div>
</template>

<style scoped>
@import "@/styles/page.css";
</style>
