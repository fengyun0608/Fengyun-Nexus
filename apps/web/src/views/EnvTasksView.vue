<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  NButton,
  NCard,
  NProgress,
  NSpace,
  NSpin,
  NTag,
  useMessage,
} from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

type EnvTaskStatus = "pending" | "running" | "paused" | "done" | "failed";
type EnvTask = {
  id: string;
  runtime: string;
  version: string;
  mode: string;
  status: EnvTaskStatus;
  progress?: number;
  logs?: string[];
};

const STATUS_LABEL: Record<EnvTaskStatus, string> = {
  pending: "待执行",
  running: "运行中",
  paused: "已暂停",
  done: "已完成",
  failed: "失败",
};

const auth = useAuthStore();
const router = useRouter();
const message = useMessage();
const loading = ref(true);
const err = ref("");
const items = ref<EnvTask[]>([]);
const activeId = ref("");
let timer: number | undefined;

const active = computed(() => items.value.find((t) => t.id === activeId.value) || items.value[0]);

async function load() {
  try {
    const res = await api<{ items: EnvTask[] }>("/v1/admin/env-tasks", { token: auth.token });
    items.value = res.items || [];
    if (!activeId.value && items.value.length) activeId.value = items.value[0].id;
    err.value = "";
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function setStatus(id: string, status: EnvTaskStatus) {
  try {
    await api(`/v1/admin/env-tasks/${encodeURIComponent(id)}/status`, {
      method: "POST",
      token: auth.token,
      body: JSON.stringify({ status }),
    });
    message.success("已更新状态");
    await load();
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  }
}

onMounted(() => {
  void load();
  timer = window.setInterval(() => void load(), 2500);
});
onUnmounted(() => {
  if (timer) window.clearInterval(timer);
});
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>环境任务</h1>
      <p class="muted">安装进度与命令输出会刷在下方。</p>
    </header>
    <n-space style="margin-bottom: 12px">
      <n-button @click="router.push('/env-setup')">环境配置</n-button>
      <n-button @click="load">刷新</n-button>
    </n-space>
    <n-spin :show="loading">
      <p v-if="err" class="err">{{ err }}</p>
      <p v-else-if="!items.length" class="muted">暂无任务</p>
      <div v-else class="grid-2">
        <n-card title="队列" size="small">
          <div
            v-for="t in items"
            :key="t.id"
            class="task-row"
            :class="{ on: active?.id === t.id }"
            @click="activeId = t.id"
          >
            <div>
              <strong>{{ t.runtime }} {{ t.version }}</strong>
              <p class="hint">{{ t.mode }} · {{ t.id }}</p>
            </div>
            <n-tag size="small">{{ STATUS_LABEL[t.status] || t.status }}</n-tag>
          </div>
        </n-card>
        <n-card v-if="active" title="实时安装" size="small">
          <n-progress type="line" :percentage="Math.round(active.progress || 0)" />
          <n-space style="margin: 10px 0">
            <n-button
              size="small"
              :disabled="active.status !== 'running'"
              @click="setStatus(active.id, 'paused')"
            >
              暂停
            </n-button>
            <n-button
              size="small"
              :disabled="active.status !== 'paused' && active.status !== 'pending'"
              @click="setStatus(active.id, 'running')"
            >
              继续
            </n-button>
          </n-space>
          <pre class="mono">{{ (active.logs || []).join("\n") || "等待安装输出…" }}</pre>
        </n-card>
      </div>
    </n-spin>
  </div>
</template>

<style scoped>
@import "@/styles/page.css";
.task-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 8px;
  border-radius: 8px;
  cursor: pointer;
  border-bottom: 1px solid var(--line);
}
.task-row.on,
.task-row:hover {
  background: rgba(47, 155, 120, 0.1);
}
</style>
