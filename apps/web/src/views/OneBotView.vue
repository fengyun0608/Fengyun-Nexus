<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  NButton,
  NCard,
  NInput,
  NSwitch,
  NTag,
  NSpace,
  NSpin,
  NDescriptions,
  NDescriptionsItem,
  useMessage,
} from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

type OneBotInfo = {
  enabled?: boolean;
  connected?: boolean;
  clients?: number;
  selfId?: string;
  reverseWsPath?: string;
  httpPath?: string;
  docsUrl?: string;
  accessTokenSet?: boolean;
  lastEventAt?: string;
  message?: string;
  bots?: Array<{ selfId: string; label: string; connected: boolean; apiBase: string }>;
  config?: {
    enabled?: boolean;
    accessToken?: string;
    reverseWsPath?: string;
    httpPath?: string;
    bots?: Array<{ selfId?: string; label?: string; apiBase?: string; accessToken?: string }>;
  };
};

const auth = useAuthStore();
const message = useMessage();
const loading = ref(true);
const saving = ref(false);
const err = ref("");
const info = ref<OneBotInfo | null>(null);

const enabled = ref(false);
const accessToken = ref("");
const reverseWsPath = ref("/onebot/v11/ws");
const httpPath = ref("/onebot/v11");
const botsText = ref("");

async function load() {
  loading.value = true;
  err.value = "";
  try {
    info.value = await api<OneBotInfo>("/v1/channels/onebot11", { token: auth.token });
    enabled.value = Boolean(info.value.config?.enabled ?? info.value.enabled);
    accessToken.value = info.value.config?.accessToken || "";
    reverseWsPath.value = info.value.config?.reverseWsPath || info.value.reverseWsPath || "/onebot/v11/ws";
    httpPath.value = info.value.config?.httpPath || info.value.httpPath || "/onebot/v11";
    const bots = info.value.config?.bots || [];
    botsText.value = bots
      .map((b) => [b.selfId || "", b.label || "", b.apiBase || ""].join(" | "))
      .join("\n");
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    const bots = botsText.value
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split("|").map((s) => s.trim());
        return {
          selfId: parts[0] || "",
          label: parts[1] || "",
          apiBase: parts[2] || "",
          accessToken: parts[3] || "",
        };
      });
    info.value = await api<OneBotInfo>("/v1/channels/onebot11/config", {
      method: "POST",
      token: auth.token,
      body: JSON.stringify({
        enabled: enabled.value,
        accessToken: accessToken.value,
        reverseWsPath: reverseWsPath.value,
        httpPath: httpPath.value,
        bots,
      }),
    });
    message.success(info.value.message || "已保存");
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
      <h1>OneBot 11</h1>
      <p class="muted">反向 WebSocket / HTTP 上报。路径改完一般要重启网关。</p>
    </header>
    <n-spin :show="loading">
      <p v-if="err" class="err">{{ err }}</p>
      <template v-else>
        <n-card title="状态" size="small" style="margin-bottom: 14px">
          <n-descriptions :column="2" label-placement="left" size="small">
            <n-descriptions-item label="连接">
              <n-tag :type="info?.connected ? 'success' : 'warning'" size="small">
                {{ info?.connected ? "已连接" : "未连接" }}
              </n-tag>
            </n-descriptions-item>
            <n-descriptions-item label="客户端">{{ info?.clients ?? 0 }}</n-descriptions-item>
            <n-descriptions-item label="机器人 QQ">{{ info?.selfId || "—" }}</n-descriptions-item>
            <n-descriptions-item label="最近事件">{{ info?.lastEventAt || "—" }}</n-descriptions-item>
          </n-descriptions>
        </n-card>
        <n-card title="配置" size="small">
          <label class="field row-switch">
            启用
            <n-switch v-model:value="enabled" />
          </label>
          <label class="field">Access Token <n-input v-model:value="accessToken" type="password" show-password-on="click" /></label>
          <label class="field">反向 WS 路径 <n-input v-model:value="reverseWsPath" /></label>
          <label class="field">HTTP 路径 <n-input v-model:value="httpPath" /></label>
          <label class="field">
            多号（每行：QQ | 备注 | apiBase）
            <n-input v-model:value="botsText" type="textarea" :rows="3" placeholder="123456 | 主号 | http://127.0.0.1:3000" />
          </label>
          <n-space>
            <n-button type="primary" :loading="saving" @click="save">保存</n-button>
            <n-button @click="load">刷新</n-button>
          </n-space>
        </n-card>
      </template>
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
