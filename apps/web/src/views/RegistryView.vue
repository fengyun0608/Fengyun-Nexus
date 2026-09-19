<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { NButton, NInput, NTag, useMessage } from "naive-ui";
import { api, readToken } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

type EcoItem = {
  id: string;
  name: string;
  version?: string;
  description?: string;
  status: "not-installed" | "installed" | "update" | "unknown";
  message?: string;
  repoUrl?: string;
  packPath?: string;
  downloadable?: boolean;
  menus?: string[];
};

const auth = useAuthStore();
const message = useMessage();
const q = ref("");
const loading = ref(false);
const uploading = ref(false);
const downloading = ref("");
const err = ref("");
const items = ref<EcoItem[]>([]);
const fileEl = ref<HTMLInputElement | null>(null);

const shown = computed(() => {
  const k = q.value.trim().toLowerCase();
  if (!k) return items.value;
  return items.value.filter((e) =>
    [e.name, e.id, e.description, e.repoUrl, e.packPath, ...(e.menus || [])]
      .join(" ")
      .toLowerCase()
      .includes(k),
  );
});

async function refresh() {
  loading.value = true;
  err.value = "";
  try {
    const res = await api<{
      ok?: boolean;
      items?: EcoItem[];
      message?: string;
    }>("/v1/registry/ecosystem", { token: auth.token, timeoutMs: 120_000 });
    items.value = res.items || [];
    if (!res.ok) err.value = res.message || "刷新失败";
    else message.success(res.message || "已刷新仓库");
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    message.error(err.value);
  } finally {
    loading.value = false;
  }
}

async function download(id: string) {
  downloading.value = id;
  try {
    const res = await api<{ ok?: boolean; message?: string }>("/v1/registry/ecosystem/install", {
      method: "POST",
      token: auth.token,
      body: JSON.stringify({ id }),
      timeoutMs: 120_000,
    });
    if (res.ok) message.success(res.message || "已下载");
    else message.warning(res.message || "下载未完成");
    await refreshQuiet();
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    downloading.value = "";
  }
}

async function refreshQuiet() {
  try {
    const res = await api<{ ok?: boolean; items?: EcoItem[]; message?: string }>(
      "/v1/registry/ecosystem",
      { token: auth.token, timeoutMs: 120_000 },
    );
    items.value = res.items || [];
    if (!res.ok) err.value = res.message || "";
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
}

function pickZip() {
  fileEl.value?.click();
}

async function onZip(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".zip")) {
    message.warning("请上传 zip");
    return;
  }
  uploading.value = true;
  try {
    const token = auth.token || readToken();
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 120_000);
    let res: Response;
    try {
      res = await fetch("/v1/registry/ecosystem/upload", {
        method: "POST",
        headers: {
          "content-type": "application/zip",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: file,
        signal: ctrl.signal,
      });
    } finally {
      window.clearTimeout(timer);
    }
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
    if (!res.ok || data.ok === false) {
      message.warning(data.error || data.message || "上传失败");
      return;
    }
    message.success(data.message || "已上传");
    await refreshQuiet();
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    uploading.value = false;
  }
}

function actionLabel(e: EcoItem) {
  if (e.status === "update") return "更新";
  if (e.status === "installed") return "重新下载";
  return "下载";
}

function tagType(s: EcoItem["status"]): "success" | "warning" | "default" | "info" {
  if (s === "installed") return "success";
  if (s === "update") return "warning";
  if (s === "not-installed") return "info";
  return "default";
}

function tagText(s: EcoItem["status"]) {
  if (s === "installed") return "已安装";
  if (s === "update") return "可更新";
  if (s === "not-installed") return "未安装";
  return "待拉取";
}

onMounted(() => void refreshQuiet());
</script>

<template>
  <div class="page">
    <div class="store-top">
      <n-input
        v-model:value="q"
        class="q"
        clearable
        placeholder="搜索插件、简介或仓库"
      />
      <n-button :loading="uploading" @click="pickZip">上传插件</n-button>
      <n-button type="primary" :loading="loading" @click="refresh">刷新仓库</n-button>
      <input ref="fileEl" class="file" type="file" accept=".zip,application/zip" @change="onZip" />
    </div>

    <p v-if="err" class="err">{{ err }}</p>
    <p v-else-if="loading && !items.length" class="hint">正在拉取生态仓…</p>

    <article v-for="e in shown" :key="e.id" class="card">
      <div class="main">
        <div class="title-row">
          <strong>{{ e.name || e.id }}</strong>
          <span v-if="e.version" class="ver">v{{ e.version }}</span>
          <n-tag size="small" :type="tagType(e.status)" :bordered="false">{{ tagText(e.status) }}</n-tag>
        </div>
        <p class="desc">{{ e.description || "暂无简介" }}</p>
        <p v-if="e.repoUrl" class="repo">
          <a :href="e.repoUrl" target="_blank" rel="noopener noreferrer">{{ e.repoUrl }}</a>
          <span v-if="e.packPath"> · {{ e.packPath }}</span>
        </p>
        <p v-if="e.message && e.status === 'unknown'" class="hint tight">{{ e.message }}</p>
      </div>
      <n-button
        v-if="e.downloadable !== false"
        type="primary"
        :secondary="e.status === 'installed'"
        :loading="downloading === e.id"
        @click="download(e.id)"
      >
        {{ actionLabel(e) }}
      </n-button>
    </article>

    <p v-if="!loading && !shown.length" class="hint">没有匹配的插件。</p>
  </div>
</template>

<style scoped>
@import "@/styles/page.css";
.store-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.store-top .q {
  flex: 1 1 240px;
  min-width: 0;
}
.file {
  display: none;
}
.card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 14px;
  margin-bottom: 10px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
}
.main {
  min-width: 0;
  flex: 1;
}
.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.ver {
  color: var(--muted);
  font-size: 12px;
}
.desc {
  margin: 6px 0 4px;
}
.repo {
  margin: 0;
  font-size: 13px;
  word-break: break-all;
}
.repo a {
  color: var(--amber);
}
.hint.tight {
  margin: 4px 0 0;
}
@media (max-width: 720px) {
  .card {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
