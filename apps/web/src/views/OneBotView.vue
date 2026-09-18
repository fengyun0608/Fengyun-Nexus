<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
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
import BotAccountCards, { type BotDraft } from "@/components/BotAccountCards.vue";

type NapCatInfo = {
  installed?: boolean;
  home?: string;
  flavor?: string;
  version?: string;
  reverseWsUrl?: string;
  launchCmd?: string;
  docsUrl?: string;
  steps?: string[];
  tip?: string;
};

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
  reverseWsUrl?: string;
  napcat?: NapCatInfo;
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
const router = useRouter();
const message = useMessage();
const loading = ref(true);
const saving = ref(false);
const acting = ref("");
const err = ref("");
const info = ref<OneBotInfo | null>(null);

const enabled = ref(false);
const accessToken = ref("");
const reverseWsPath = ref("/onebot/v11/ws");
const httpPath = ref("/onebot/v11");
const botCards = ref<BotDraft[]>([]);
let timer: number | undefined;

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
    botCards.value = bots.map((b) => ({
      selfId: b.selfId || "",
      label: b.label || "",
      apiBase: b.apiBase || "",
      accessToken: b.accessToken || "",
    }));
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    const bots = botCards.value.map((b) => ({
      selfId: b.selfId.trim(),
      label: b.label.trim(),
      apiBase: b.apiBase.trim(),
      accessToken: b.accessToken.trim(),
    }));
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

async function copyWs() {
  const url = info.value?.reverseWsUrl || info.value?.napcat?.reverseWsUrl || "";
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    message.success("已复制反向 WS 地址");
  } catch {
    message.info(url);
  }
}

async function launchNapCat() {
  acting.value = "launch";
  try {
    const res = await api<{ message?: string }>("/v1/admin/napcat/launch", {
      method: "POST",
      token: auth.token,
    });
    message.success(res.message || "已启动");
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    acting.value = "";
  }
}

async function rewire() {
  acting.value = "wire";
  try {
    const res = await api<{ message?: string }>("/v1/admin/napcat/wire", {
      method: "POST",
      token: auth.token,
    });
    message.success(res.message || "已接线");
    await load();
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    acting.value = "";
  }
}

onMounted(() => {
  void load();
  timer = window.setInterval(() => void load(), 5000);
});
onUnmounted(() => {
  if (timer) window.clearInterval(timer);
});
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>OneBot 11 · QQ</h1>
      <p class="muted">NapCat 反向 WebSocket。装好扫码，连接变绿就能用。</p>
    </header>
    <n-spin :show="loading">
      <p v-if="err" class="err">{{ err }}</p>
      <template v-else>
        <n-card title="细胞级上手" size="small" style="margin-bottom: 14px">
          <ol class="steps">
            <li v-for="(s, i) in info?.napcat?.steps || []" :key="i">{{ s }}</li>
          </ol>
          <p class="tip">{{ info?.napcat?.tip || "—" }}</p>
          <n-space style="margin-top: 10px">
            <n-button type="primary" @click="router.push('/env-setup')">去环境配置安装 NapCat</n-button>
            <n-button :loading="acting === 'launch'" :disabled="!info?.napcat?.installed" @click="launchNapCat">
              启动 NapCat
            </n-button>
            <n-button :loading="acting === 'wire'" :disabled="!info?.napcat?.installed" @click="rewire">
              重新写入反向 WS
            </n-button>
            <n-button @click="copyWs">复制 WS 地址</n-button>
            <a
              class="doc-link"
              :href="info?.napcat?.docsUrl || 'https://napneko.github.io/guide/boot/Shell'"
              target="_blank"
              rel="noreferrer"
            >
              官网 Shell 说明
            </a>
          </n-space>
          <p v-if="info?.reverseWsUrl" class="ws-line">
            <code>{{ info.reverseWsUrl }}</code>
          </p>
          <p v-if="info?.napcat?.home" class="hint">安装目录：{{ info.napcat.home }}</p>
          <p v-if="info?.napcat?.launchCmd" class="hint">启动命令：{{ info.napcat.launchCmd }}</p>
        </n-card>

        <n-card title="状态" size="small" style="margin-bottom: 14px">
          <n-descriptions :column="2" label-placement="left" size="small">
            <n-descriptions-item label="连接">
              <n-tag :type="info?.connected ? 'success' : 'warning'" size="small">
                {{ info?.connected ? "已连接" : "未连接" }}
              </n-tag>
            </n-descriptions-item>
            <n-descriptions-item label="NapCat">
              <n-tag :type="info?.napcat?.installed ? 'success' : 'warning'" size="small">
                {{ info?.napcat?.installed ? `已装 ${info?.napcat?.version || ""}` : "未安装" }}
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
          <BotAccountCards
            v-model="botCards"
            :live="info?.bots || []"
            :reverse-ws-url="info?.reverseWsUrl || info?.napcat?.reverseWsUrl || ''"
            :gateway-port="8787"
          />
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
.steps {
  margin: 0;
  padding-left: 1.2rem;
  color: var(--ink);
  line-height: 1.55;
  font-size: 0.92rem;
}
.tip {
  margin: 10px 0 0;
  color: var(--amber-deep);
  font-size: 0.9rem;
}
.ws-line {
  margin: 12px 0 0;
  word-break: break-all;
}
.hint {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 0.84rem;
  word-break: break-all;
}
.doc-link {
  display: inline-flex;
  align-items: center;
  padding: 0 14px;
  height: 34px;
  border-radius: 6px;
  border: 1px solid var(--line);
  color: var(--ink);
  text-decoration: none;
  font-size: 0.9rem;
}
</style>
