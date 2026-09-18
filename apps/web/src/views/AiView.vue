<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  NButton,
  NCard,
  NInput,
  NSpace,
  NSpin,
  NTag,
  useMessage,
} from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

type Provider = {
  id: string;
  name: string;
  category: string;
  baseUrl: string;
  model: string;
  hasKey: boolean;
  apiKeyMasked: string;
};

type LlmInfo = {
  hasKey?: boolean;
  apiKeyMasked?: string;
  baseUrl?: string;
  model?: string;
  activeId?: string;
  providers?: Provider[];
  message?: string;
};

const auth = useAuthStore();
const message = useMessage();
const loading = ref(true);
const saving = ref(false);
const err = ref("");
const info = ref<LlmInfo | null>(null);
const activeId = ref("");

const name = ref("");
const baseUrl = ref("");
const model = ref("");
const apiKey = ref("");

const active = computed(() =>
  (info.value?.providers || []).find((p) => p.id === activeId.value),
);

function fillFrom(p?: Provider) {
  if (!p) return;
  name.value = p.name;
  baseUrl.value = p.baseUrl;
  model.value = p.model;
  apiKey.value = "";
}

async function load() {
  loading.value = true;
  err.value = "";
  try {
    info.value = await api<LlmInfo>("/v1/admin/llm", { token: auth.token });
    activeId.value = info.value.activeId || info.value.providers?.[0]?.id || "";
    fillFrom(active.value);
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function selectProvider(id: string) {
  activeId.value = id;
  fillFrom((info.value?.providers || []).find((p) => p.id === id));
}

async function switchProvider(id: string) {
  saving.value = true;
  try {
    info.value = await api<LlmInfo>("/v1/admin/llm/switch", {
      method: "POST",
      token: auth.token,
      body: JSON.stringify({ id }),
    });
    activeId.value = info.value.activeId || id;
    fillFrom(active.value);
    message.success(info.value.message || "已切换");
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    const body: Record<string, unknown> = {
      id: activeId.value,
      name: name.value,
      baseUrl: baseUrl.value,
      model: model.value,
      activate: true,
    };
    if (apiKey.value.trim()) body.apiKey = apiKey.value.trim();
    info.value = await api<LlmInfo>("/v1/admin/llm", {
      method: "POST",
      token: auth.token,
      body: JSON.stringify(body),
    });
    message.success(info.value.message || "已保存");
    fillFrom(active.value);
    apiKey.value = "";
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

onMounted(() => void load());
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>AI 层</h1>
      <p class="muted">供应商切换与密钥就地生效，不用重启。</p>
    </header>
    <n-spin :show="loading">
      <p v-if="err" class="err">{{ err }}</p>
      <div v-else class="grid-2">
        <n-card title="供应商" size="small">
          <div
            v-for="p in info?.providers || []"
            :key="p.id"
            class="prov"
            :class="{ on: p.id === activeId }"
            @click="selectProvider(p.id)"
          >
            <div>
              <strong>{{ p.name }}</strong>
              <p class="hint">{{ p.category }} · {{ p.model }}</p>
            </div>
            <n-space>
              <n-tag v-if="info?.activeId === p.id" size="small" type="success">当前</n-tag>
              <n-tag size="small" :type="p.hasKey ? 'success' : 'warning'">
                {{ p.hasKey ? "有密钥" : "无密钥" }}
              </n-tag>
              <n-button
                size="tiny"
                :disabled="info?.activeId === p.id"
                :loading="saving"
                @click.stop="switchProvider(p.id)"
              >
                启用
              </n-button>
            </n-space>
          </div>
        </n-card>
        <n-card title="编辑" size="small">
          <label class="field">名称 <n-input v-model:value="name" /></label>
          <label class="field">Base URL <n-input v-model:value="baseUrl" /></label>
          <label class="field">模型 <n-input v-model:value="model" /></label>
          <label class="field">
            API Key
            <n-input
              v-model:value="apiKey"
              type="password"
              show-password-on="click"
              :placeholder="active?.apiKeyMasked || '留空不改'"
            />
          </label>
          <n-space>
            <n-button type="primary" :loading="saving" @click="save">保存并启用</n-button>
            <n-button @click="load">刷新</n-button>
          </n-space>
        </n-card>
      </div>
    </n-spin>
  </div>
</template>

<style scoped>
@import "@/styles/page.css";
.prov {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 8px;
  border-radius: 8px;
  cursor: pointer;
  border-bottom: 1px solid var(--line);
}
.prov.on,
.prov:hover {
  background: rgba(232, 165, 75, 0.1);
}
</style>
