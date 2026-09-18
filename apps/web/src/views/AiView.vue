<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  NButton,
  NInput,
  NModal,
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
const showEdit = ref(false);

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

function openEdit(id: string) {
  activeId.value = id;
  fillFrom((info.value?.providers || []).find((p) => p.id === id));
  showEdit.value = true;
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
    showEdit.value = false;
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
      <p class="muted">点卡片切换启用；改密钥与地址用中央弹窗，保存即生效。</p>
    </header>
    <n-spin :show="loading">
      <p v-if="err" class="err">{{ err }}</p>
      <template v-else>
        <div class="list">
          <div
            v-for="p in info?.providers || []"
            :key="p.id"
            class="list-row"
            :class="{ on: info?.activeId === p.id }"
          >
            <div>
              <strong>{{ p.name }}</strong>
              <div class="hint">{{ p.category }} · {{ p.model }}</div>
            </div>
            <n-space align="center">
              <n-tag v-if="info?.activeId === p.id" size="small" type="success">当前</n-tag>
              <n-tag size="small" :type="p.hasKey ? 'success' : 'warning'">
                {{ p.hasKey ? "有密钥" : "无密钥" }}
              </n-tag>
              <n-button size="tiny" quaternary @click="openEdit(p.id)">编辑</n-button>
              <n-button
                size="tiny"
                type="primary"
                secondary
                :disabled="info?.activeId === p.id"
                :loading="saving"
                @click="switchProvider(p.id)"
              >
                启用
              </n-button>
            </n-space>
          </div>
          <p v-if="!(info?.providers || []).length" class="muted">暂无供应商</p>
        </div>
        <n-space style="margin-top: 12px">
          <n-button @click="load">刷新</n-button>
        </n-space>
      </template>
    </n-spin>

    <n-modal
      v-model:show="showEdit"
      preset="card"
      :title="`编辑 · ${name || activeId}`"
      :style="{ width: 'min(480px, 94vw)' }"
    >
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
      <template #footer>
        <n-space justify="end">
          <n-button @click="showEdit = false">关闭</n-button>
          <n-button type="primary" :loading="saving" @click="save">保存并启用</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
@import "@/styles/page.css";
.list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 4px;
  border-bottom: 1px solid var(--line);
}
.list-row.on {
  background: rgba(47, 155, 120, 0.08);
  border-radius: 8px;
  padding-left: 10px;
  padding-right: 10px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 10px 0;
}
</style>
