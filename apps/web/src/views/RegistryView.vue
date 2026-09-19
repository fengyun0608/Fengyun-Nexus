<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { NButton, NInput, NModal, NSelect, NTag, useMessage } from "naive-ui";
import { api, readToken } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

type EcoItem = {
  id: string;
  name: string;
  version?: string;
  description?: string;
  category?: string;
  status: "not-installed" | "installed" | "update" | "unknown";
  message?: string;
  repoUrl?: string;
  packPath?: string;
  downloadable?: boolean;
  menus?: string[];
  heat?: number;
  pluginDirs?: string[];
  dirs?: string[];
};

type ReviewItem = { title: string; url: string; user: string; host: "github" | "gitcode" };
type GitRepo = { fullName: string; url: string; description: string; defaultBranch: string };

const SESSION = "nexus.eco.session";
const auth = useAuthStore();
const message = useMessage();
const q = ref("");
const cat = ref("all");
const sortHeat = ref(false);
const loading = ref(false);
const uploading = ref(false);
const downloading = ref("");
const removing = ref("");
const err = ref("");
const items = ref<EcoItem[]>([]);
const localItems = ref<EcoItem[]>([]);
const categories = ref<Array<{ id: string; label: string }>>([]);
const reviews = ref<ReviewItem[]>([]);
const fileEl = ref<HTMLInputElement | null>(null);

const showUp = ref(false);
const upMode = ref<"zip" | "pr">("zip");
const host = ref<"gitcode" | "github">("gitcode");
const gitToken = ref("");
const gitLogin = ref("");
const repos = ref<GitRepo[]>([]);
const repoUrl = ref<string | null>(null);
const form = ref({ id: "", name: "", version: "0.1.0", description: "", menus: "", category: "community" });
const submitting = ref(false);
const loggingIn = ref(false);
const prUrl = ref("");

const chips = computed(() => [
  { id: "all", label: "全部" },
  ...categories.value,
  { id: "installed", label: "已下载" },
]);

const shown = computed(() => {
  const extras = localItems.value.map((e) => ({
    ...e,
    status: "installed" as const,
    pluginDirs: e.pluginDirs || e.dirs || [],
    downloadable: false,
  }));
  let list = cat.value === "installed"
    ? [...items.value.filter((e) => e.status === "installed" || e.status === "update"), ...extras]
    : items.value.filter((e) => cat.value === "all" || e.category === cat.value);
  const k = q.value.trim().toLowerCase();
  if (k) {
    list = list.filter((e) =>
      [e.name, e.id, e.description, e.repoUrl, e.packPath, ...(e.menus || [])].join(" ").toLowerCase().includes(k),
    );
  }
  if (sortHeat.value && cat.value !== "installed") {
    list = [...list].sort((a, b) => Number(b.heat || 0) - Number(a.heat || 0));
  }
  return list;
});

const repoOptions = computed(() =>
  repos.value.map((r) => ({ label: r.fullName, value: r.url })),
);

function saveSession() {
  if (!gitToken.value || !gitLogin.value) return;
  sessionStorage.setItem(SESSION, JSON.stringify({ host: host.value, token: gitToken.value, login: gitLogin.value }));
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION);
    if (!raw) return;
    const j = JSON.parse(raw) as { host?: "gitcode" | "github"; token?: string; login?: string };
    if (j.host) host.value = j.host;
    if (j.token) gitToken.value = j.token;
    if (j.login) gitLogin.value = j.login;
  } catch {
    /* 忽略坏的会话 */
  }
}

async function refreshQuiet() {
  try {
    const res = await api<{
      ok?: boolean;
      items?: EcoItem[];
      localItems?: EcoItem[];
      categories?: Array<{ id: string; label: string }>;
      message?: string;
    }>("/v1/registry/ecosystem", { token: auth.token, timeoutMs: 120_000 });
    items.value = res.items || [];
    localItems.value = res.localItems || [];
    categories.value = res.categories || [];
    err.value = res.ok ? "" : res.message || "刷新失败";
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
}

async function loadReviews() {
  try {
    const res = await api<{ items?: ReviewItem[] }>("/v1/registry/ecosystem/reviews", {
      token: auth.token,
      timeoutMs: 30_000,
    });
    reviews.value = res.items || [];
  } catch {
    reviews.value = [];
  }
}

async function refresh() {
  loading.value = true;
  err.value = "";
  try {
    await refreshQuiet();
    await loadReviews();
    if (err.value) message.warning(err.value);
    else message.success("已刷新仓库");
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

async function removePack(e: EcoItem) {
  removing.value = e.id;
  try {
    const res = await api<{ ok?: boolean; message?: string }>("/v1/registry/ecosystem/remove", {
      method: "POST",
      token: auth.token,
      body: JSON.stringify({ id: e.id, dirs: e.pluginDirs || e.dirs || [] }),
    });
    if (res.ok) message.success(res.message || "已移除");
    else message.warning(res.message || "没有移除");
    await refreshQuiet();
  } catch (err2) {
    message.error(err2 instanceof Error ? err2.message : String(err2));
  } finally {
    removing.value = "";
  }
}

function openUpload(mode: "zip" | "pr") {
  upMode.value = mode;
  prUrl.value = "";
  showUp.value = true;
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
    const res = await fetch("/v1/registry/ecosystem/upload", {
      method: "POST",
      headers: {
        "content-type": "application/zip",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: file,
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
    if (!res.ok || data.ok === false) {
      message.warning(data.error || data.message || "上传失败");
      return;
    }
    message.success(data.message || "已安装到本机");
    showUp.value = false;
    await refreshQuiet();
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    uploading.value = false;
  }
}

async function loginAccount() {
  loggingIn.value = true;
  prUrl.value = "";
  try {
    const res = await api<{ ok?: boolean; login?: string; message?: string }>("/v1/registry/ecosystem/account", {
      method: "POST",
      token: auth.token,
      body: JSON.stringify({ host: host.value, token: gitToken.value }),
      timeoutMs: 40_000,
    });
    if (!res.ok || !res.login) {
      message.warning(res.message || "登录失败");
      gitLogin.value = "";
      return;
    }
    gitLogin.value = res.login;
    saveSession();
    const listed = await api<{ ok?: boolean; repos?: GitRepo[]; message?: string }>("/v1/registry/ecosystem/repos", {
      method: "POST",
      token: auth.token,
      body: JSON.stringify({ host: host.value, token: gitToken.value }),
      timeoutMs: 40_000,
    });
    repos.value = listed.repos || [];
    repoUrl.value = repos.value[0]?.url || null;
    message.success(listed.message || res.message || "已登录");
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    loggingIn.value = false;
  }
}

function logoutAccount() {
  gitLogin.value = "";
  gitToken.value = "";
  repos.value = [];
  repoUrl.value = null;
  sessionStorage.removeItem(SESSION);
}

async function submitPr() {
  const repo = repos.value.find((r) => r.url === repoUrl.value);
  if (!repo) {
    message.warning("先选择自己的仓库");
    return;
  }
  submitting.value = true;
  prUrl.value = "";
  try {
    const res = await api<{ ok?: boolean; message?: string; prUrl?: string }>("/v1/registry/ecosystem/submit", {
      method: "POST",
      token: auth.token,
      timeoutMs: 120_000,
      body: JSON.stringify({
        host: host.value,
        token: gitToken.value,
        repoUrl: repo.url,
        branch: repo.defaultBranch || "main",
        id: form.value.id,
        name: form.value.name,
        version: form.value.version,
        description: form.value.description,
        category: form.value.category,
        menus: form.value.menus.split(/[,，\s]+/).filter(Boolean),
      }),
    });
    if (!res.ok) {
      message.warning(res.message || "提交失败");
      return;
    }
    prUrl.value = res.prUrl || "";
    message.success("已提交，等待审核");
    await loadReviews();
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    submitting.value = false;
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

onMounted(() => {
  loadSession();
  void refreshQuiet();
  void loadReviews();
});
</script>

<template>
  <div class="page">
    <div class="store-top">
      <n-input v-model:value="q" class="q" clearable placeholder="搜索插件、简介或仓库" />
      <n-button @click="openUpload('zip')">上传插件</n-button>
      <n-button @click="openUpload('pr')">投稿</n-button>
      <n-button type="primary" :loading="loading" @click="refresh">刷新仓库</n-button>
      <input ref="fileEl" class="file" type="file" accept=".zip,application/zip" @change="onZip" />
    </div>

    <div class="chips">
      <button
        v-for="c in chips"
        :key="c.id"
        type="button"
        class="chip"
        :class="{ on: cat === c.id }"
        @click="cat = c.id"
      >
        {{ c.label }}
      </button>
      <span class="split" />
      <button type="button" class="chip" :class="{ on: !sortHeat }" @click="sortHeat = false">默认</button>
      <button type="button" class="chip" :class="{ on: sortHeat }" @click="sortHeat = true">热量最高</button>
    </div>

    <p v-if="err" class="err">{{ err }}</p>
    <p v-else-if="loading && !items.length" class="hint">正在拉取生态仓…</p>

    <article v-for="e in shown" :key="e.id" class="card">
      <div class="main">
        <div class="title-row">
          <strong>{{ e.name || e.id }}</strong>
          <span v-if="e.version" class="ver">v{{ e.version }}</span>
          <n-tag size="small" :bordered="false">热度 {{ e.heat || 0 }}</n-tag>
          <n-tag size="small" :type="tagType(e.status)" :bordered="false">{{ tagText(e.status) }}</n-tag>
        </div>
        <p class="desc">{{ e.description || "暂无简介" }}</p>
        <p v-if="e.repoUrl" class="repo">
          <a :href="e.repoUrl" target="_blank" rel="noopener noreferrer">{{ e.repoUrl }}</a>
          <span v-if="e.packPath"> · {{ e.packPath }}</span>
        </p>
        <p v-if="e.message && e.status === 'unknown'" class="hint tight">{{ e.message }}</p>
      </div>
      <div class="acts">
        <n-button
          v-if="e.downloadable !== false"
          type="primary"
          :secondary="e.status === 'installed'"
          :loading="downloading === e.id"
          @click="download(e.id)"
        >
          {{ actionLabel(e) }}
        </n-button>
        <n-button
          v-if="e.status === 'installed' || e.status === 'update' || cat === 'installed'"
          :loading="removing === e.id"
          @click="removePack(e)"
        >
          移除
        </n-button>
      </div>
    </article>

    <p v-if="!loading && !shown.length" class="hint">
      {{ cat === "installed" ? "还没有下载的插件。" : "没有匹配的插件。" }}
    </p>

    <section v-if="reviews.length" class="reviews">
      <h2>待审核</h2>
      <p v-for="r in reviews" :key="r.url" class="repo">
        <a :href="r.url" target="_blank" rel="noopener noreferrer">{{ r.title }}</a>
        <span v-if="r.user"> · {{ r.user }}</span>
        <span> · {{ r.host === "github" ? "GitHub" : "GitCode" }}</span>
      </p>
    </section>

    <n-modal v-model:show="showUp" preset="card" title="上传插件" :style="{ width: 'min(560px, 94vw)' }">
      <div class="chips modal-chips">
        <button type="button" class="chip" :class="{ on: upMode === 'zip' }" @click="upMode = 'zip'">装到本机</button>
        <button type="button" class="chip" :class="{ on: upMode === 'pr' }" @click="upMode = 'pr'">投稿审核</button>
      </div>

      <template v-if="upMode === 'zip'">
        <p class="hint">zip 里要有 nexus.pack.json 或 nexus.plugin.json。只装本机，不进生态仓。</p>
        <n-button type="primary" :loading="uploading" @click="pickZip">选择 zip</n-button>
      </template>

      <template v-else>
        <p class="hint">登录自己的 GitCode 或 GitHub，选公开插件仓。我们代提 PR，等审核合并后才会出现在商店。</p>
        <div class="chips modal-chips">
          <button type="button" class="chip" :class="{ on: host === 'gitcode' }" @click="host = 'gitcode'">GitCode</button>
          <button type="button" class="chip" :class="{ on: host === 'github' }" @click="host = 'github'">GitHub</button>
        </div>
        <label class="field">私人令牌 <n-input v-model:value="gitToken" type="password" show-password-on="click" placeholder="不会写入仓库" /></label>
        <div class="acts">
          <n-button type="primary" :loading="loggingIn" @click="loginAccount">登录</n-button>
          <n-button v-if="gitLogin" @click="logoutAccount">退出</n-button>
          <span v-if="gitLogin" class="ver">已登录 {{ gitLogin }}</span>
        </div>
        <template v-if="gitLogin">
          <label class="field">自己的仓库 <n-select v-model:value="repoUrl" :options="repoOptions" placeholder="选择公开仓库" /></label>
          <label class="field">插件 id <n-input v-model:value="form.id" placeholder="例如 vendor.hello" /></label>
          <label class="field">名称 <n-input v-model:value="form.name" placeholder="中文名" /></label>
          <label class="field">版本 <n-input v-model:value="form.version" /></label>
          <label class="field">简介 <n-input v-model:value="form.description" type="textarea" :rows="2" /></label>
          <label class="field">菜单 <n-input v-model:value="form.menus" placeholder="#菜单，逗号分隔" /></label>
          <div class="chips modal-chips">
            <button type="button" class="chip" :class="{ on: form.category === 'community' }" @click="form.category = 'community'">社区</button>
            <button type="button" class="chip" :class="{ on: form.category === 'template' }" @click="form.category = 'template'">模板参考</button>
          </div>
          <n-button type="primary" :loading="submitting" @click="submitPr">提交审核</n-button>
          <p v-if="prUrl" class="repo">
            <a :href="prUrl" target="_blank" rel="noopener noreferrer">{{ prUrl }}</a>
          </p>
        </template>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
@import "@/styles/page.css";
.store-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.store-top .q {
  flex: 1 1 240px;
  min-width: 0;
}
.file { display: none; }
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-bottom: 14px;
}
.modal-chips { margin: 8px 0 12px; }
.chip {
  border: 1px solid var(--line);
  background: var(--surface);
  color: inherit;
  border-radius: 999px;
  padding: 4px 10px;
  cursor: pointer;
  font: inherit;
}
.chip.on {
  border-color: var(--amber);
  color: var(--amber);
}
.split {
  width: 1px;
  height: 16px;
  background: var(--line);
  margin: 0 4px;
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
.main { min-width: 0; flex: 1; }
.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.ver { color: var(--muted); font-size: 12px; }
.desc { margin: 6px 0 4px; }
.repo { margin: 0; font-size: 13px; word-break: break-all; }
.repo a { color: var(--amber); }
.hint.tight { margin: 4px 0 0; }
.acts { display: flex; gap: 8px; flex-shrink: 0; }
.reviews { margin-top: 18px; }
.reviews h2 { font-size: 1rem; margin: 0 0 8px; }
@media (max-width: 720px) {
  .card { flex-direction: column; align-items: stretch; }
  .store-top { flex-wrap: wrap; }
}
</style>
