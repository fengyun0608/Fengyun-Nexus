<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { NButton, NCard, NSpace, NSpin, NTabs, NTabPane, NTag } from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

type LogItem = { at: string; level: string; message: string };
type FeedMsg = {
  id: string;
  channel: string;
  chatId: string;
  userId: string;
  role: string;
  content: string;
  createdAt: string;
};

const auth = useAuthStore();
const loading = ref(true);
const err = ref("");
const logs = ref<LogItem[]>([]);
const messages = ref<FeedMsg[]>([]);
const tab = ref("gateway");
let timer: number | undefined;

async function load() {
  try {
    const [l, m] = await Promise.all([
      api<{ items: LogItem[] }>("/v1/logs?limit=150", { token: auth.token }),
      api<{ items: FeedMsg[] }>("/v1/messages/recent?limit=80", { token: auth.token }),
    ]);
    logs.value = l.items || [];
    messages.value = m.items || [];
    err.value = "";
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
  timer = window.setInterval(() => void load(), 4000);
});
onUnmounted(() => {
  if (timer) window.clearInterval(timer);
});
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>日志</h1>
      <p class="muted">网关日志与最近消息，自动刷新。</p>
    </header>
    <n-space style="margin-bottom: 12px">
      <n-button @click="load">刷新</n-button>
    </n-space>
    <n-spin :show="loading">
      <p v-if="err" class="err">{{ err }}</p>
      <n-tabs v-else v-model:value="tab" type="line">
        <n-tab-pane name="gateway" tab="网关日志">
          <n-card size="small">
            <div v-for="(row, i) in logs" :key="i" class="log-row">
              <n-tag size="tiny" :bordered="false">{{ row.level }}</n-tag>
              <span class="at">{{ row.at }}</span>
              <span>{{ row.message }}</span>
            </div>
            <p v-if="!logs.length" class="muted">暂无日志</p>
          </n-card>
        </n-tab-pane>
        <n-tab-pane name="messages" tab="最近消息">
          <n-card size="small">
            <div v-for="m in messages" :key="m.id" class="log-row">
              <n-tag size="tiny">{{ m.channel }}</n-tag>
              <span class="at">{{ m.createdAt }}</span>
              <span>{{ m.role }}/{{ m.userId }}: {{ m.content }}</span>
            </div>
            <p v-if="!messages.length" class="muted">暂无消息</p>
          </n-card>
        </n-tab-pane>
      </n-tabs>
    </n-spin>
  </div>
</template>

<style scoped>
@import "@/styles/page.css";
.log-row {
  display: grid;
  grid-template-columns: auto auto 1fr;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(232, 165, 75, 0.08);
  font-size: 0.86rem;
  align-items: start;
}
.at {
  color: var(--muted);
  white-space: nowrap;
}
</style>
