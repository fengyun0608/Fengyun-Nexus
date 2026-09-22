<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  NButton,
  NInput,
  NModal,
  NSelect,
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
  supportsVision?: boolean;
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

/** 挡浏览器/Edge 把供应商表单当成登录框自动填账号密码 */
const noAutofill = {
  autocomplete: "off",
  "data-lpignore": "true",
  "data-1p-ignore": "true",
  "data-form-type": "other",
} as const;

const visionModeOptions = [
  { label: "自动（按模型名猜）", value: "auto" },
  { label: "能看图（视觉）", value: "yes" },
  { label: "不能看图（相似度搜网）", value: "no" },
];

const auth = useAuthStore();
const message = useMessage();
const loading = ref(true);
const saving = ref(false);
const modelsLoading = ref(false);
const err = ref("");
const info = ref<LlmInfo | null>(null);
const activeId = ref("");
const showEdit = ref(false);

const providerName = ref("");
const endpointUrl = ref("");
const modelId = ref("");
const secretKey = ref("");
const visionMode = ref<"auto" | "yes" | "no">("auto");
const modelIds = ref<string[]>([]);
const modelsHint = ref("");

const active = computed(() =>
  (info.value?.providers || []).find((p) => p.id === activeId.value),
);

const modelOptions = computed(() => {
  const ids = [...modelIds.value];
  const cur = modelId.value.trim();
  if (cur && !ids.includes(cur)) ids.unshift(cur);
  return ids.map((id) => ({ label: id, value: id }));
});

function onModelUpdate(v: string | null) {
  // clearable 会写成 null，tag 模式下整框会塌掉，统一收回空串
  modelId.value = v == null ? "" : String(v);
}

function fillFrom(p?: Provider) {
  if (!p) return;
  providerName.value = p.name;
  endpointUrl.value = p.baseUrl;
  modelId.value = p.model || "";
  secretKey.value = "";
  visionMode.value =
    p.supportsVision === true ? "yes" : p.supportsVision === false ? "no" : "auto";
  modelIds.value = p.model ? [p.model] : [];
  modelsHint.value = "";
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

async function fetchModels() {
  modelsLoading.value = true;
  modelsHint.value = "";
  try {
    const body: Record<string, unknown> = {
      id: activeId.value,
      baseUrl: endpointUrl.value.trim(),
    };
    if (secretKey.value.trim()) body.apiKey = secretKey.value.trim();
    const res = await api<{
      ok?: boolean;
      models?: string[];
      message?: string;
      error?: string;
    }>("/v1/admin/llm/models", {
      method: "POST",
      token: auth.token,
      body: JSON.stringify(body),
    });
    const list = Array.isArray(res.models) ? res.models.filter(Boolean) : [];
    modelIds.value = list;
    modelsHint.value = res.message || (list.length ? `已拉取 ${list.length} 个` : "列表为空");
    if (res.ok === false) {
      message.warning(res.message || res.error || "拉取失败");
    } else {
      message.success(res.message || `已拉取 ${list.length} 个模型`);
      if (list.length && !modelId.value.trim()) modelId.value = list[0]!;
    }
  } catch (e) {
    const tip = e instanceof Error ? e.message : String(e);
    modelsHint.value = tip;
    message.error(tip);
  } finally {
    modelsLoading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    const body: Record<string, unknown> = {
      id: activeId.value,
      name: providerName.value,
      baseUrl: endpointUrl.value,
      model: modelId.value,
      activate: true,
    };
    if (secretKey.value.trim()) body.apiKey = secretKey.value.trim();
    if (visionMode.value === "yes") body.supportsVision = true;
    else if (visionMode.value === "no") body.supportsVision = false;
    else body.supportsVision = null;
    info.value = await api<LlmInfo>("/v1/admin/llm", {
      method: "POST",
      token: auth.token,
      body: JSON.stringify(body),
    });
    message.success(info.value.message || "已保存");
    fillFrom(active.value);
    secretKey.value = "";
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
      <p class="muted">点卡片切换启用；改密钥与地址用中央弹窗，保存即生效。模型可搜索选择或手输。</p>
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
              <div class="hint">
                {{ p.category }} · {{ p.model || "未选模型" }}
                <template v-if="p.supportsVision === true"> · 视觉开</template>
                <template v-else-if="p.supportsVision === false"> · 相似度搜图</template>
              </div>
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
      :title="`编辑 · ${providerName || activeId}`"
      :style="{ width: 'min(520px, 94vw)' }"
    >
      <!-- 诱饵字段：把 Edge/Chrome 密码管家引开，别盖到供应商配置上 -->
      <div class="autofill-trap" aria-hidden="true">
        <input tabindex="-1" type="text" name="username" autocomplete="username" />
        <input tabindex="-1" type="password" name="password" autocomplete="current-password" />
      </div>
      <div class="field">
        <span class="field-label">名称</span>
        <n-input
          v-model:value="providerName"
          :input-props="{ ...noAutofill, name: 'nexus-llm-provider-name', autocomplete: 'off' }"
        />
      </div>
      <div class="field">
        <span class="field-label">Base URL</span>
        <n-input
          v-model:value="endpointUrl"
          :input-props="{ ...noAutofill, name: 'nexus-llm-base-url', autocomplete: 'url' }"
        />
      </div>
      <div class="field">
        <span class="field-label">模型</span>
        <n-space vertical :size="8" style="width: 100%">
          <n-select
            :value="modelId"
            filterable
            tag
            clearable
            :options="modelOptions"
            :loading="modelsLoading"
            placeholder="搜索选择，或直接输入模型名"
            :consistent-menu-width="true"
            :input-props="{ ...noAutofill, name: 'nexus-llm-model-id', autocomplete: 'off' }"
            @update:value="onModelUpdate"
          />
          <n-space>
            <n-button size="small" :loading="modelsLoading" @click="fetchModels">
              自动拉取模型列表
            </n-button>
            <span v-if="modelsHint" class="hint">{{ modelsHint }}</span>
          </n-space>
        </n-space>
      </div>
      <div class="field">
        <span class="field-label">看图能力</span>
        <n-select
          v-model:value="visionMode"
          :options="visionModeOptions"
          placeholder="自动或手动指定"
        />
        <p class="hint">不能看图时，发图会自动走相似度/以图搜网；能看图则把像素直接送给模型。</p>
      </div>
      <div class="field">
        <span class="field-label">API Key</span>
        <p v-if="active?.hasKey" class="key-kept">
          已保存：{{ active.apiKeyMasked || "********" }}（下方留空则继续用这份；填新值才会覆盖）
        </p>
        <p v-else class="hint">尚未保存密钥，拉模型或对话前请先填写。</p>
        <n-input
          v-model:value="secretKey"
          type="password"
          show-password-on="click"
          :placeholder="active?.hasKey ? '留空不改' : '粘贴 API Key'"
          :input-props="{
            ...noAutofill,
            name: 'nexus-llm-secret-key',
            autocomplete: 'new-password',
          }"
        />
      </div>
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
.field-label {
  font-size: 13px;
  color: var(--ink-muted, #5a6b63);
}
.autofill-trap {
  position: absolute;
  left: -9999px;
  top: 0;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}
.key-kept {
  margin: 0;
  font-size: 13px;
  color: var(--ok, #2f9b78);
  word-break: break-all;
}
</style>
