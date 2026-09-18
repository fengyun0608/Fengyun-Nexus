<script setup lang="ts">
import { onMounted, ref } from "vue";
import { NButton, NCard, NSpace, NSpin, NTag, useMessage } from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

type WorkflowItem = { id: string; name?: string; description?: string };
type McpItem = { name: string; description?: string };

const auth = useAuthStore();
const message = useMessage();
const loading = ref(true);
const err = ref("");
const workflows = ref<WorkflowItem[]>([]);
const tools = ref<McpItem[]>([]);
const busyId = ref("");

async function load() {
  loading.value = true;
  err.value = "";
  try {
    const [w, m] = await Promise.all([
      api<{ items: WorkflowItem[] }>("/v1/workflows", { token: auth.token }),
      api<{ items: McpItem[] }>("/v1/mcp/tools", { token: auth.token }),
    ]);
    workflows.value = w.items || [];
    tools.value = m.items || [];
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function runWorkflow(id: string) {
  busyId.value = id;
  try {
    const res = await api<{ ok?: boolean; message?: string; error?: string }>(
      `/v1/workflows/${encodeURIComponent(id)}/run`,
      { method: "POST", token: auth.token, body: "{}" },
    );
    message.success(res.message || "已执行");
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    busyId.value = "";
  }
}

onMounted(() => void load());
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>工作流与工具</h1>
      <p class="muted">试跑工作流，查看已注册的 MCP 工具。</p>
    </header>
    <n-button style="margin-bottom: 12px" @click="load">刷新</n-button>
    <n-spin :show="loading">
      <p v-if="err" class="err">{{ err }}</p>
      <div v-else class="grid-2">
        <n-card title="工作流" size="small">
          <div v-for="w in workflows" :key="w.id" class="item">
            <div>
              <strong>{{ w.name || w.id }}</strong>
              <p class="hint">{{ w.description || w.id }}</p>
            </div>
            <n-button size="small" :loading="busyId === w.id" @click="runWorkflow(w.id)">试跑</n-button>
          </div>
          <p v-if="!workflows.length" class="muted">暂无工作流</p>
        </n-card>
        <n-card title="MCP 工具" size="small">
          <div v-for="t in tools" :key="t.name" class="item">
            <div>
              <n-tag size="small" :bordered="false">{{ t.name }}</n-tag>
              <p class="hint">{{ t.description || "—" }}</p>
            </div>
          </div>
          <p v-if="!tools.length" class="muted">暂无工具</p>
        </n-card>
      </div>
    </n-spin>
  </div>
</template>

<style scoped>
@import "@/styles/page.css";
.item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
}
.item:last-child {
  border-bottom: none;
}
</style>
