<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  NButton,
  NCard,
  NInput,
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
  categories?: Array<{ id: string; label: string; path: string }>;
};

type PluginItem = { id: string; name?: string };

const auth = useAuthStore();
const message = useMessage();
const loading = ref(true);
const publishing = ref(false);
const err = ref("");
const info = ref<RegistryInfo | null>(null);
const plugins = ref<PluginItem[]>([]);
const pluginId = ref("");
const category = ref("");

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

onMounted(() => void load());
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>插件更新</h1>
      <p class="muted">远端登记与本地发布意图。令牌走环境变量，不写进仓库。</p>
    </header>
    <n-spin :show="loading">
      <p v-if="err" class="err">{{ err }}</p>
      <template v-else>
        <n-card title="远端" size="small" style="margin-bottom: 14px">
          <p>地址：{{ info?.baseUrl || "—" }}</p>
          <p>
            令牌
            <n-tag size="small" :type="info?.tokenConfigured ? 'success' : 'warning'">
              {{ info?.tokenConfigured ? "已配置" : "未配置" }}
            </n-tag>
            <span class="hint"> {{ info?.tokenEnv }}</span>
          </p>
          <n-space style="margin-top: 8px">
            <n-tag v-for="c in info?.categories || []" :key="c.id" size="small">{{ c.label }}</n-tag>
          </n-space>
        </n-card>
        <n-card title="登记发布" size="small">
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
</style>
