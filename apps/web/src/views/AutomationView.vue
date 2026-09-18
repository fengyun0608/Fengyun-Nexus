<script setup lang="ts">
import { onMounted, ref } from "vue";
import { NButton, NCard, NInput, NModal, NSpace, NSpin, NTag, useMessage } from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

type WorkflowItem = {
  id: string;
  name?: string;
  description?: string;
  author?: string;
  file?: string;
  local?: boolean;
};
type McpItem = { name: string; description?: string };
type Guide = {
  workflowsDir?: string;
  docs?: Array<{ title: string; path: string; url?: string }>;
  steps?: string[];
};

const auth = useAuthStore();
const message = useMessage();
const loading = ref(true);
const err = ref("");
const workflows = ref<WorkflowItem[]>([]);
const tools = ref<McpItem[]>([]);
const busyId = ref("");
const guide = ref<Guide | null>(null);

const showCreate = ref(false);
const creating = ref(false);
const createForm = ref({ id: "", name: "", author: "", description: "" });
const createResult = ref<{ path?: string; message?: string; docs?: Guide["docs"] } | null>(null);

function docHref(d: { path: string; url?: string }): string {
  return d.url || `/v1/docs/view?path=${encodeURIComponent(d.path)}`;
}

async function load() {
  loading.value = true;
  err.value = "";
  try {
    const [w, m] = await Promise.all([
      api<{ items: WorkflowItem[]; guide?: Guide }>("/v1/workflows", { token: auth.token }),
      api<{ items: McpItem[] }>("/v1/mcp/tools", { token: auth.token }),
    ]);
    workflows.value = w.items || [];
    tools.value = m.items || [];
    guide.value = w.guide || null;
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

function openCreate() {
  createResult.value = null;
  createForm.value = { id: "", name: "", author: "", description: "" };
  showCreate.value = true;
}

async function submitCreate() {
  creating.value = true;
  createResult.value = null;
  try {
    const res = await api<{
      path?: string;
      message?: string;
      docs?: Guide["docs"];
    }>("/v1/workflows", {
      method: "POST",
      token: auth.token,
      body: JSON.stringify(createForm.value),
    });
    createResult.value = {
      path: res.path,
      message: res.message,
      docs: res.docs,
    };
    message.success(res.message || "已创建本地工作流");
    await load();
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    creating.value = false;
  }
}

onMounted(() => void load());
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>工作流与工具</h1>
      <p class="muted">创建本地工作流、试跑，以及查看已注册的 MCP 工具。</p>
    </header>
    <n-space style="margin-bottom: 12px">
      <n-button @click="load">刷新</n-button>
      <n-button type="primary" @click="openCreate">创建本地工作流</n-button>
    </n-space>
    <p v-if="guide?.workflowsDir" class="hint path-tip">
      本地目录：<code>{{ guide.workflowsDir }}</code>
    </p>
    <n-spin :show="loading">
      <p v-if="err" class="err">{{ err }}</p>
      <div v-else class="grid-2">
        <n-card title="工作流" size="small">
          <div v-for="w in workflows" :key="w.id" class="item">
            <div>
              <strong>{{ w.name || w.id }}</strong>
              <p class="hint">
                {{ w.id }}
                <template v-if="w.author"> · 作者 {{ w.author }}</template>
                <template v-if="w.file"> · {{ w.file }}</template>
                <n-tag v-if="w.local" size="tiny" type="info" :bordered="false" style="margin-left: 6px">
                  本地
                </n-tag>
              </p>
              <p class="hint">{{ w.description || "—" }}</p>
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

    <n-modal
      v-model:show="showCreate"
      preset="card"
      title="创建本地工作流"
      :style="{ width: 'min(560px, 94vw)' }"
    >
      <p class="hint">
        会写到
        <code>{{ guide?.workflowsDir || "workflows/" }}</code>
        ，创建后按文档继续改节点。
      </p>
      <template v-if="!createResult">
        <label class="field">工作流 id（英文） <n-input v-model:value="createForm.id" placeholder="例如 demo.flow" /></label>
        <label class="field">名称 <n-input v-model:value="createForm.name" placeholder="中文显示名" /></label>
        <label class="field">作者 <n-input v-model:value="createForm.author" /></label>
        <label class="field">说明 <n-input v-model:value="createForm.description" type="textarea" :rows="2" /></label>
        <div v-if="guide?.docs?.length" class="docs-mini">
          <strong>编写文档（点开新窗口）</strong>
          <ul class="doc-links">
            <li v-for="d in guide.docs" :key="d.path">
              <a :href="docHref(d)" target="_blank" rel="noopener noreferrer">{{ d.title }}</a>
            </li>
          </ul>
        </div>
      </template>
      <template v-else>
        <p class="ok-line">{{ createResult.message }}</p>
        <p class="hint">路径：<code>{{ createResult.path }}</code></p>
        <div v-if="createResult.docs?.length" class="docs-mini">
          <strong>接下来点这些链接开始写</strong>
          <ul class="doc-links">
            <li v-for="d in createResult.docs" :key="d.path">
              <a :href="docHref(d)" target="_blank" rel="noopener noreferrer">{{ d.title }}</a>
            </li>
          </ul>
        </div>
      </template>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showCreate = false">关闭</n-button>
          <n-button v-if="!createResult" type="primary" :loading="creating" @click="submitCreate">创建</n-button>
        </n-space>
      </template>
    </n-modal>
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
.path-tip {
  margin: 0 0 12px;
}
.field {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
  color: var(--muted);
  font-size: 0.9rem;
}
.docs-mini {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--surface-2);
}
.docs-mini ul {
  margin: 8px 0 0;
  padding-left: 18px;
}
.doc-links {
  list-style: none;
  padding-left: 0 !important;
  display: grid;
  gap: 6px;
}
.doc-links a {
  color: var(--amber);
  font-weight: 600;
  text-decoration: none;
}
.doc-links a:hover {
  text-decoration: underline;
}
.ok-line {
  color: var(--amber);
  font-weight: 600;
}
</style>
