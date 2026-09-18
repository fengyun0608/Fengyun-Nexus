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
  categories?: Array<{ id: string; label: string; path: string }>;
};

type PluginItem = { id: string; name?: string };

type UpdateItem = {
  id: string;
  dir: string;
  name?: string;
  localFingerprint?: string;
  remoteFingerprint?: string;
  status: "same" | "update" | "local-only" | "unknown";
  message?: string;
};

const auth = useAuthStore();
const message = useMessage();
const loading = ref(true);
const publishing = ref(false);
const checking = ref(false);
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
    }>("/v1/registry/plugin-updates", { token: auth.token });
    updateItems.value = res.items || [];
    updateMsg.value = res.message || "";
    updateSource.value = res.source || "";
    message.info(res.message || "已检测");
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    checking.value = false;
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
  return "未知";
}

onMounted(() => void load());
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>插件更新</h1>
      <p class="muted">检测远端与本地 plugins/ 是否一致；专仓地址配在 registry.json。</p>
    </header>
    <n-spin :show="loading">
      <p v-if="err" class="err">{{ err }}</p>
      <template v-else>
        <div class="admin-row surface">
          <div>
            <strong>远程一致性</strong>
            <p class="muted">
              对照
              {{
                info?.pluginsRepo?.url
                  ? info.pluginsRepo.url
                  : "本仓 origin 的 plugins/（专仓 url 空着时）"
              }}
            </p>
          </div>
          <n-button type="primary" :loading="checking" @click="checkUpdates">检测更新</n-button>
        </div>

        <n-card v-if="updateMsg" size="small" style="margin: 14px 0" title="检测结果">
          <p>{{ updateMsg }}</p>
          <p v-if="updateSource" class="hint">来源：{{ updateSource }}</p>
          <div v-for="u in updateItems" :key="u.dir" class="upd-row">
            <div>
              <strong>{{ u.name || u.id }}</strong>
              <span class="hint"> {{ u.dir }} · {{ u.localFingerprint || "?" }} → {{ u.remoteFingerprint || "?" }}</span>
            </div>
            <n-tag
              size="small"
              :type="u.status === 'update' ? 'warning' : u.status === 'same' ? 'success' : 'default'"
            >
              {{ statusLabel(u.status) }}
            </n-tag>
          </div>
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
  background: rgba(0, 0, 0, 0.22);
}
.upd-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
}
</style>
