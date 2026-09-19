<script setup lang="ts">
import { onMounted, ref } from "vue";
import { NButton, NCard, NSpace, NSpin, NTag, useMessage } from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

type RegistryInfo = {
  baseUrl?: string;
  tokenConfigured?: boolean;
  tokenEnv?: string;
  pluginsRepo?: { url?: string; branch?: string } | null;
  ecosystemRepo?: { url?: string; branch?: string } | null;
  pluginsRepoLocked?: boolean;
  ecosystemRepoLocked?: boolean;
  categories?: Array<{ id: string; label: string; path: string }>;
};

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

type EcoItem = {
  id: string;
  name: string;
  kind?: string;
  category?: string;
  version?: string;
  description?: string;
  status: "not-installed" | "installed" | "update" | "unknown";
  localVersion?: string;
  message?: string;
  homepage?: string;
};

const auth = useAuthStore();
const message = useMessage();
const loading = ref(true);
const checking = ref(false);
const applying = ref(false);
const ecoLoading = ref(false);
const ecoInstalling = ref("");
const err = ref("");
const info = ref<RegistryInfo | null>(null);
const updateItems = ref<UpdateItem[]>([]);
const updateMsg = ref("");
const updateSource = ref("");
const ecoItems = ref<EcoItem[]>([]);
const ecoMsg = ref("");
const ecoSource = ref("");

async function load() {
  loading.value = true;
  err.value = "";
  try {
    info.value = await api<RegistryInfo>("/v1/registry", { token: auth.token });
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

async function loadEcosystem() {
  ecoLoading.value = true;
  try {
    const res = await api<{
      ok?: boolean;
      items?: EcoItem[];
      message?: string;
      source?: string;
    }>("/v1/registry/ecosystem", { token: auth.token, timeoutMs: 120_000 });
    ecoItems.value = res.items || [];
    ecoMsg.value = res.message || "";
    ecoSource.value = res.source || "";
    if (!res.ok) message.warning(res.message || "生态列表拉取失败");
    else message.info(res.message || "已刷新生态列表");
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    ecoLoading.value = false;
  }
}

async function installEco(id: string) {
  ecoInstalling.value = id;
  try {
    const res = await api<{ ok?: boolean; message?: string }>("/v1/registry/ecosystem/install", {
      method: "POST",
      token: auth.token,
      body: JSON.stringify({ id }),
      timeoutMs: 120_000,
    });
    if (res.ok) message.success(res.message || "已安装");
    else message.warning(res.message || "安装未完成");
    await loadEcosystem();
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    ecoInstalling.value = "";
  }
}

function statusLabel(s: UpdateItem["status"]) {
  if (s === "same") return "一致";
  if (s === "update") return "有更新";
  if (s === "local-only") return "仅本地";
  if (s === "remote-only") return "可拉取";
  return "未知";
}

function ecoStatusLabel(s: EcoItem["status"]) {
  if (s === "installed") return "已安装";
  if (s === "update") return "可更新";
  if (s === "not-installed") return "未安装";
  return "需手动";
}

function ecoTagType(s: EcoItem["status"]): "success" | "warning" | "info" | "default" {
  if (s === "installed") return "success";
  if (s === "update") return "warning";
  if (s === "not-installed") return "info";
  return "default";
}

onMounted(() => void load());
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>插件更新</h1>
      <p class="muted">系统插件专仓检测更新；生态专仓浏览与一键安装。</p>
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
          <p class="hint">生态专仓（已锁定）</p>
          <p class="repo">
            <a
              v-if="info?.ecosystemRepo?.url"
              :href="String(info.ecosystemRepo.url).replace(/\.git$/i, '')"
              target="_blank"
              rel="noopener noreferrer"
            >{{ String(info.ecosystemRepo.url).replace(/\.git$/i, "") }}</a>
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

        <div class="admin-row surface" style="margin-top: 14px">
          <div>
            <strong>生态专仓</strong>
            <p class="muted">浏览社区收录，专仓内 path 型包可一键装进本地 plugins/。</p>
          </div>
          <n-space>
            <n-button type="primary" :loading="ecoLoading" @click="loadEcosystem">刷新列表</n-button>
          </n-space>
        </div>

        <n-card v-if="ecoMsg || ecoItems.length" size="small" style="margin: 14px 0" title="生态收录">
          <p v-if="ecoMsg">{{ ecoMsg }}</p>
          <p v-if="ecoSource" class="hint">来源：{{ ecoSource }}</p>
          <div v-for="e in ecoItems" :key="e.id" class="upd-row">
            <div>
              <strong>{{ e.name || e.id }}</strong>
              <p class="hint">
                {{ e.version ? `v${e.version}` : "" }}
                <template v-if="e.localVersion && e.status === 'update'">
                  （本地 {{ e.localVersion }}）
                </template>
                · {{ e.message || ecoStatusLabel(e.status) }}
              </p>
              <p v-if="e.description" class="hint">{{ e.description }}</p>
              <p v-if="e.homepage" class="hint">
                <a :href="e.homepage" target="_blank" rel="noopener noreferrer">{{ e.homepage }}</a>
              </p>
            </div>
            <n-space align="center">
              <n-tag size="small" :type="ecoTagType(e.status)" :bordered="false">
                {{ ecoStatusLabel(e.status) }}
              </n-tag>
              <n-button
                v-if="e.status === 'not-installed' || e.status === 'update'"
                size="small"
                type="primary"
                :loading="ecoInstalling === e.id"
                @click="installEco(e.id)"
              >
                {{ e.status === "update" ? "更新" : "安装" }}
              </n-button>
            </n-space>
          </div>
          <p v-if="!ecoItems.length" class="hint">暂无收录。</p>
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
