<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  NButton,
  NCard,
  NInput,
  NSwitch,
  NSpace,
  NSpin,
  useMessage,
} from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

type Settings = {
  label?: string;
  masters?: string[];
  onlyMasters?: boolean;
  replyGroupIds?: string[];
  notifyGroupIds?: string[];
  systemPrompt?: string;
  note?: string;
};

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const message = useMessage();

const id = computed(() => String(route.params.id || ""));
const loading = ref(true);
const saving = ref(false);
const err = ref("");

const label = ref("");
const masters = ref("");
const onlyMasters = ref(false);
const replyGroupIds = ref("");
const notifyGroupIds = ref("");
const systemPrompt = ref("");
const note = ref("");

async function load() {
  if (!id.value) return;
  loading.value = true;
  err.value = "";
  try {
    const res = await api<{ settings: Settings }>(
      `/v1/channels/${encodeURIComponent(id.value)}/settings`,
      { token: auth.token },
    );
    const s = res.settings || {};
    label.value = s.label || id.value;
    masters.value = (s.masters || []).join(", ");
    onlyMasters.value = Boolean(s.onlyMasters);
    replyGroupIds.value = (s.replyGroupIds || []).join(", ");
    notifyGroupIds.value = (s.notifyGroupIds || []).join(", ");
    systemPrompt.value = s.systemPrompt || "";
    note.value = s.note || "";
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    await api(`/v1/channels/${encodeURIComponent(id.value)}/settings`, {
      method: "PUT",
      token: auth.token,
      body: JSON.stringify({
        label: label.value,
        masters: masters.value,
        onlyMasters: onlyMasters.value,
        replyGroupIds: replyGroupIds.value,
        notifyGroupIds: notifyGroupIds.value,
        systemPrompt: systemPrompt.value,
        note: note.value,
      }),
    });
    message.success("通道配置已保存");
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

onMounted(() => void load());
watch(id, () => void load());
</script>

<template>
  <div class="page">
    <header class="page-head">
      <n-space align="center">
        <n-button quaternary @click="router.push('/channels')">← 返回通道</n-button>
      </n-space>
      <h1>{{ label || id }}</h1>
      <p class="muted">本通道中枢：主人与回复范围在这里改。</p>
    </header>
    <n-spin :show="loading">
      <p v-if="err" class="err">{{ err }}</p>
      <n-card v-else title="通道设置" size="small">
        <label class="field">显示名 <n-input v-model:value="label" /></label>
        <label class="field">主人 QQ / ID <n-input v-model:value="masters" placeholder="逗号分隔" /></label>
        <label class="field row-switch">
          仅主人可触发
          <n-switch v-model:value="onlyMasters" />
        </label>
        <label class="field">回复群 <n-input v-model:value="replyGroupIds" placeholder="空=全部" /></label>
        <label class="field">通知群 <n-input v-model:value="notifyGroupIds" /></label>
        <label class="field">系统提示 <n-input v-model:value="systemPrompt" type="textarea" :rows="4" /></label>
        <label class="field">备注 <n-input v-model:value="note" /></label>
        <n-space>
          <n-button type="primary" :loading="saving" @click="save">保存</n-button>
          <n-button @click="router.push('/plugins')">本通道相关插件</n-button>
          <n-button v-if="id === 'onebot11' || id.includes('onebot')" @click="router.push('/onebot')">
            OneBot 连接
          </n-button>
        </n-space>
      </n-card>
    </n-spin>
  </div>
</template>

<style scoped>
@import "@/styles/page.css";
.row-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
