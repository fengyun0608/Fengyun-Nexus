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

type DbDetectItem = {
  id: string;
  label: string;
  available: boolean;
  reason?: string;
  recommended?: boolean;
};

type DbInfo = {
  active?: string;
  info?: { driver?: string; filePath?: string; persistent?: boolean; engine?: string };
  stats?: { messages?: number; plugins?: number; kv?: number };
  backends?: Array<{ id: string; enabled: boolean; label: string; path?: string }>;
  items?: DbDetectItem[];
  message?: string;
};

const auth = useAuthStore();
const message = useMessage();
const loading = ref(true);
const busy = ref("");
const err = ref("");
const info = ref<DbInfo | null>(null);
const showSwitch = ref(false);
const detecting = ref(false);
const pick = ref("");
const pathOverride = ref("");
const detectItems = ref<DbDetectItem[]>([]);

const options = computed(() => {
  const list =
    detectItems.value.length > 0
      ? detectItems.value
      : (info.value?.backends || []).map((b) => ({
          id: b.id,
          label: b.label || b.id,
          available: b.enabled,
          reason: b.enabled ? undefined : "未启用",
        }));
  return list.map((d) => ({
    label: `${d.label}${d.recommended ? " · 推荐" : ""}${d.available ? "" : " · 不可用"}`,
    value: d.id,
    disabled: !d.available,
  }));
});

async function load() {
  loading.value = true;
  err.value = "";
  try {
    info.value = await api<DbInfo>("/v1/admin/db", { token: auth.token });
    pick.value = info.value.active || "";
    const hit = info.value.backends?.find((b) => b.id === pick.value);
    pathOverride.value = hit?.path || "";
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function openSwitch() {
  showSwitch.value = true;
  detecting.value = true;
  try {
    const res = await api<DbInfo>("/v1/admin/db/detect", { token: auth.token });
    info.value = { ...info.value, ...res };
    detectItems.value = res.items || [];
    pick.value = res.active || info.value?.active || "";
    const hit = (res.backends || info.value?.backends || []).find((b) => b.id === pick.value);
    pathOverride.value = hit?.path || "";
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    detecting.value = false;
  }
}

function onPick(id: string) {
  pick.value = id;
  const hit = (info.value?.backends || []).find((b) => b.id === id);
  pathOverride.value = hit?.path || "";
}

async function applySwitch() {
  if (!pick.value) return;
  busy.value = pick.value;
  try {
    info.value = await api<DbInfo>("/v1/admin/db/switch", {
      method: "POST",
      token: auth.token,
      body: JSON.stringify({
        id: pick.value,
        path: pathOverride.value || undefined,
      }),
    });
    message.success(info.value.message || `已切换到 ${pick.value}`);
    showSwitch.value = false;
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    busy.value = "";
  }
}

onMounted(() => void load());
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>数据库</h1>
      <p class="muted">当前状态看这里；切换驱动点右侧按钮，在中央弹窗确认。</p>
    </header>

    <n-spin :show="loading">
      <p v-if="err" class="err">{{ err }}</p>
      <template v-else>
        <div class="chips">
          <div class="chip">活动 <strong>{{ info?.active || "—" }}</strong></div>
          <div class="chip">驱动 <strong>{{ info?.info?.driver || "—" }}</strong></div>
          <div class="chip">消息 <strong>{{ info?.stats?.messages ?? "—" }}</strong></div>
          <div class="chip">插件记录 <strong>{{ info?.stats?.plugins ?? "—" }}</strong></div>
        </div>
        <p v-if="info?.info?.filePath" class="hint mono">{{ info.info.filePath }}</p>

        <div class="admin-row surface">
          <div>
            <strong>切换数据库</strong>
            <p class="muted">探测本机可用驱动后切换，立即生效。</p>
          </div>
          <n-space>
            <n-button @click="load">刷新</n-button>
            <n-button type="primary" @click="openSwitch">切换</n-button>
          </n-space>
        </div>

        <div class="layer-grid tight" style="margin-top: 14px">
          <div v-for="b in info?.backends || []" :key="b.id" class="layer-card static">
            <strong>{{ b.label || b.id }}</strong>
            <span>
              <n-tag size="small" :type="info?.active === b.id ? 'success' : 'default'" :bordered="false">
                {{ info?.active === b.id ? "使用中" : b.enabled ? "可用" : "未启用" }}
              </n-tag>
              <template v-if="b.path"> · {{ b.path }}</template>
            </span>
          </div>
        </div>
      </template>
    </n-spin>

    <n-modal
      v-model:show="showSwitch"
      preset="card"
      title="切换数据库"
      :style="{ width: 'min(440px, 92vw)' }"
    >
      <p v-if="detecting" class="hint">正在探测可用驱动…</p>
      <label class="field">
        选择驱动
        <n-select :value="pick" :options="options" :disabled="detecting" @update:value="onPick" />
      </label>
      <label class="field">
        路径（可选）
        <n-input v-model:value="pathOverride" placeholder="留空用默认路径" />
      </label>
      <template #footer>
        <n-space justify="end">
          <n-button :loading="detecting" @click="openSwitch">重新探测</n-button>
          <n-button
            type="primary"
            :disabled="!pick || detecting"
            :loading="busy === pick"
            @click="applySwitch"
          >
            应用
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
@import "@/styles/page.css";
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.chip {
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.2);
  color: var(--muted);
  font-size: 0.88rem;
}
.chip strong {
  color: var(--ink);
  margin-left: 4px;
}
.surface {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
}
.layer-grid.tight {
  padding: 0;
}
.layer-card.static {
  cursor: default;
}
.layer-card.static:hover {
  border-color: var(--line);
  background: var(--surface);
}
</style>
