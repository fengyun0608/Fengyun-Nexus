<script setup lang="ts">
import { h, onMounted, ref } from "vue";
import {
  NButton,
  NCard,
  NDataTable,
  NTag,
  NSpace,
  NSpin,
  NDrawer,
  NDrawerContent,
  NList,
  NListItem,
  NThing,
  useMessage,
} from "naive-ui";
import type { DataTableColumns } from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

type DevPlugin = {
  id: string;
  dir: string;
  hasIndex: boolean;
  modular?: boolean;
  layout?: string[];
  name?: string;
};

type RuntimePlugin = {
  id: string;
  name?: string;
  version?: string;
  enabled?: boolean;
};

const auth = useAuthStore();
const message = useMessage();
const loading = ref(false);
const runtime = ref<RuntimePlugin[]>([]);
const devItems = ref<DevPlugin[]>([]);
const guide = ref<{ pluginsDir?: string; steps?: string[] } | null>(null);

const drawer = ref(false);
const activeDir = ref("");
const files = ref<Array<{ path: string; size: number }>>([]);
const filePath = ref("");
const fileContent = ref("");
const saving = ref(false);

const columns: DataTableColumns<DevPlugin> = [
  { title: "目录", key: "dir", width: 140 },
  {
    title: "结构",
    key: "modular",
    width: 100,
    render(row) {
      if (row.modular) {
        return h(NTag, { size: "small", type: "success", bordered: false }, () => "模块化");
      }
      if (row.hasIndex) {
        return h(NTag, { size: "small", bordered: false }, () => "单文件");
      }
      return h(NTag, { size: "small", type: "warning", bordered: false }, () => "未知");
    },
  },
  {
    title: "分目录",
    key: "layout",
    render(row) {
      const layout = row.layout || [];
      return layout.length ? layout.join(" · ") : "—";
    },
  },
  {
    title: "操作",
    key: "actions",
    width: 100,
    render(row) {
      return h(
        NButton,
        { size: "tiny", quaternary: true, onClick: () => void openDir(row.dir) },
        () => "查看",
      );
    },
  },
];

async function refresh() {
  loading.value = true;
  try {
    const [rt, dev] = await Promise.all([
      api<{ items: RuntimePlugin[] }>("/v1/plugins", { token: auth.token }),
      api<{
        items: DevPlugin[];
        guide?: { pluginsDir?: string; steps?: string[] };
      }>("/v1/admin/dev/plugins", { token: auth.token }),
    ]);
    runtime.value = rt.items || [];
    devItems.value = dev.items || [];
    guide.value = dev.guide || null;
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    loading.value = false;
  }
}

async function openDir(dir: string) {
  activeDir.value = dir;
  drawer.value = true;
  filePath.value = "";
  fileContent.value = "";
  try {
    const res = await api<{ files: Array<{ path: string; size: number }> }>(
      `/v1/admin/dev/plugins/${encodeURIComponent(dir)}/files`,
      { token: auth.token },
    );
    files.value = res.files || [];
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  }
}

async function loadFile(path: string) {
  try {
    const res = await api<{ path: string; content: string }>(
      `/v1/admin/dev/file?path=${encodeURIComponent(path)}`,
      { token: auth.token },
    );
    filePath.value = res.path;
    fileContent.value = res.content;
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  }
}

async function saveFile() {
  if (!filePath.value) return;
  saving.value = true;
  try {
    await api("/v1/admin/dev/file", {
      method: "PUT",
      token: auth.token,
      body: JSON.stringify({ path: filePath.value, content: fileContent.value }),
    });
    message.success("已保存");
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

onMounted(() => void refresh());
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>插件</h1>
      <p class="muted">模块化结构放后台看，不用发指令。点「查看」可改源码。</p>
    </header>

    <n-space style="margin-bottom: 12px">
      <n-button size="small" :loading="loading" @click="refresh">刷新</n-button>
    </n-space>

    <n-spin :show="loading">
      <n-card title="本机插件目录" size="small" style="margin-bottom: 14px">
        <n-data-table :columns="columns" :data="devItems" size="small" :bordered="false" />
      </n-card>

      <n-card v-if="guide" title="新建指引" size="small">
        <p class="muted">目录：<code>{{ guide.pluginsDir }}</code></p>
        <ol v-if="guide.steps?.length">
          <li v-for="s in guide.steps" :key="s">{{ s }}</li>
        </ol>
      </n-card>

      <n-card title="运行中" size="small" style="margin-top: 14px">
        <n-space>
          <n-tag v-for="p in runtime" :key="p.id" size="small">
            {{ p.name || p.id }}
            <span class="dim"> · {{ p.id }}</span>
          </n-tag>
        </n-space>
      </n-card>
    </n-spin>

    <n-drawer v-model:show="drawer" :width="560" placement="right">
      <n-drawer-content :title="`源码 · ${activeDir}`" closable>
        <n-list v-if="!filePath" hoverable clickable>
          <n-list-item v-for="f in files" :key="f.path" @click="loadFile(f.path)">
            <n-thing :title="f.path" :description="`${f.size} B`" />
          </n-list-item>
        </n-list>
        <div v-else>
          <p><code>{{ filePath }}</code></p>
          <textarea v-model="fileContent" class="code" rows="22" />
          <n-space style="margin-top: 10px">
            <n-button type="primary" :loading="saving" @click="saveFile">保存</n-button>
            <n-button @click="filePath = ''">返回列表</n-button>
          </n-space>
        </div>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<style scoped>
.page-head h1 {
  margin: 0 0 4px;
  font-family: var(--font-display);
  font-size: 1.75rem;
  color: var(--amber);
}
.muted { color: var(--muted); margin: 0 0 12px; }
.dim { color: var(--muted); font-weight: 400; }
.code {
  width: 100%;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 13px;
  background: #121410;
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px;
  resize: vertical;
}
</style>
