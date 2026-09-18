<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  NButton,
  NCard,
  NSelect,
  NSpace,
  NSpin,
  NTag,
  useMessage,
} from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

type RegistryInfo = {
  baseUrl?: string;
  tokenConfigured?: boolean;
  tokenEnv?: string;
  pluginsRepo?: { url?: string; branch?: string } | null;
  pluginsRepoLocked?: boolean;
  categories?: Array<{ id: string; label: string; path: string }>;
};

type PluginItem = { id: string; name?: string };

type UpdateItem = {
  id: string;
  dir: string;
  name?: string;
  localVersion?: string;
  remoteVersion?: string;
  repoUrl?: string;
  status: "same" | "update" | "local-only" | "remote-only" | "unknown";
  message?: string;
};

const auth = useAuthStore();
const message = useMessage();
const loading = ref(true);
const publishing = ref(false);
const checking = ref(false);
const applying = ref(false);
const err = ref("");
const info = ref<RegistryInfo | null>(null);
const plugins = ref<PluginItem[]>([]);
const pluginId = ref("");
const category = ref("");
const updateItems = ref<UpdateItem[]>([]);
const updateMsg = ref("");
const updateSource = ref("");

async function load() {
  loading.value = true;
  err.value = "";
  try {
    const [r, p] = await Promise.all([
      api<RegistryInfo>("/v1/registry", { token: auth.token }),
      api<{ items: PluginItem[] }>("/v1/plugins", { token: auth.token }),
    ]);
    info.value = r;
    plugins.value = p.items || [];
    if (!pluginId.value && plugins.value[0]) pluginId.value = plugins.value[0].id;
    if (!category.value && r.categories?.[0]) category.value = r.categories[0].id;
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function checkUpdates() {
  checking.value = true;
  try {
    const res = await api<{
      items?: UpdateItem[];
      message?: string;
      source?: string;
      skipped?: number;
    }>("/v1/registry/plugin-updates", { token: auth.token });
    updateItems.value = (res.items || []).filter(
      (u) => u.status === "update" || u.status === "remote-only",
    );
    updateMsg.value = res.message || "";
    updateSource.value = res.source || "";
    message.info(res.message || "已检测");
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    checking.value = false;
  }
}

async function applyUpdates() {
  const need = updateItems.value.filter(
    (u) => u.status === "update" || u.status === "remote-only",
  );
  if (!need.length) {
    message.info("没有可拉取的更新");
    return;
  }
  applying.value = true;
  try {
    const res = await api<{ message?: string }>("/v1/registry/plugin-updates/apply", {
      method: "POST",
      token: auth.token,
      body: JSON.stringify({ dirs: need.map((u) => u.dir) }),
      timeoutMs: 120_000,
    });
    message.success(res.message || "已拉取");
    await checkUpdates();
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    applying.value = false;
  }
}

async function publish() {
  publishing.value = true;
  try {
    const res = await api<{ message?: string }>("/v1/registry/publish", {
      method: "POST",
      token: auth.token,
      body: JSON.stringify({ pluginId: pluginId.value, category: category.value }),
    });
    message.success(res.message || "已登记");
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    publishing.value = false;
  }
}

function statusLabel(s: UpdateItem["status"]) {
  if (s === "same") return "一致";
  if (s === "update") return "有更新";
  if (s === "local-only") return "仅本地";
  if (s === "remote-only") return "可拉取";
  return "未知";
}

onMounted(() => void load());
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>插件更新</h1>
      <p class="muted">对照官方系统插件专仓检测与拉取；专仓地址由发行配置锁定。</p>
    </header>
    <n-spin :show="loading">
      <p v-if="err" class="err">{{ err }}</p>
      <template v-else>
        <n-card size="small" title="仓库地址" style="margin-bottom: 14px">
          <p class="hint">主框架仓库</p>
          <p class="repo">
            <a
              v-if="info?.baseUrl"
              :href="info.baseUrl"
              target="_blank"
              rel="noopener noreferrer"
            >{{ info.baseUrl }}</a>
            <span v-else>未配置</span>
          </p>
          <p class="hint">系统插件仓库（已锁定）</p>
          <p class="repo">
            <a
              v-if="info?.pluginsRepo?.url"
              :href="String(info.pluginsRepo.url).replace(/\.git$/i, '')"
              target="_blank"
              rel="noopener noreferrer"
            >{{ String(info.pluginsRepo.url).replace(/\.git$/i, "") }}</a>
            <span v-else>未配置</span>
          </p>
        </n-card>

        <div class="admin-row surface">
          <div>
            <strong>远程一致性</strong>
            <p class="muted">检测本地系统插件与官方专仓是否一致，可一键拉取并热重载。</p>
          </div>
          <n-space>
            <n-button type="primary" :loading="checking" @click="checkUpdates">检测更新</n-button>
            <n-button
              secondary
              :loading="applying"
              :disabled="!updateItems.some((u) => u.status === 'update' || u.status === 'remote-only')"
              @click="applyUpdates"
            >
              拉取更新
            </n-button>
          </n-space>
        </div>

        <n-card v-if="updateMsg" size="small" style="margin: 14px 0" title="检测结果">
          <p>{{ updateMsg }}</p>
          <p v-if="updateSource" class="hint">来源：{{ updateSource }}</p>
          <div v-for="u in updateItems" :key="u.dir" class="upd-row">
            <div>
              <strong>{{ u.name || u.id }}</strong>
              <p class="hint">
                版本 {{ u.localVersion || "—" }}
                <template v-if="u.remoteVersion && u.remoteVersion !== u.localVersion">
                  → {{ u.remoteVersion }}
                </template>
                · {{ u.message || statusLabel(u.status) }}
              </p>
              <p v-if="u.repoUrl" class="hint">
                <a :href="u.repoUrl" target="_blank" rel="noopener noreferrer">{{ u.repoUrl }}</a>
              </p>
            </div>
            <n-tag size="small" type="warning" :bordered="false">
              {{ statusLabel(u.status) }}
            </n-tag>
          </div>
          <p v-if="!updateItems.length" class="hint">没有待更新的插件，无更新的已跳过。</p>
        </n-card>

        <n-card title="登记发布意图" size="small" style="margin-top: 14px">
          <p class="hint">
            令牌 {{ info?.tokenConfigured ? "已配置" : "未配置" }}
            <span v-if="info?.tokenEnv"> · {{ info.tokenEnv }}</span>
          </p>
          <label class="field">
            插件
            <n-select
              v-model:value="pluginId"
              :options="plugins.map((p) => ({ label: p.name || p.id, value: p.id }))"
              filterable
            />
          </label>
          <label class="field">
            分类
            <n-select
              v-model:value="category"
              :options="(info?.categories || []).map((c) => ({ label: c.label, value: c.id }))"
            />
          </label>
          <n-space>
            <n-button type="primary" :loading="publishing" @click="publish">登记</n-button>
            <n-button @click="load">刷新</n-button>
          </n-space>
        </n-card>
      </template>
    </n-spin>
  </div>
</template>

<style scoped>
@import "@/styles/page.css";
.surface {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
}
.upd-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 10px 0;
}
.repo {
  margin: 4px 0 12px;
  word-break: break-all;
  font-size: 13px;
}
.repo a {
  color: var(--amber);
}
</style>
