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
  NModal,
  useMessage,
} from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
import BotAccountCards, { type BotDraft } from "@/components/BotAccountCards.vue";

type NapCatInfo = {
  installed?: boolean;
  canLaunch?: boolean;
  home?: string;
  flavor?: string;
  version?: string;
  reverseWsUrl?: string;
  launchCmd?: string;
  docsUrl?: string;
  steps?: string[];
  tip?: string;
  pm2?: {
    name?: string;
    online?: boolean;
    status?: string;
    pid?: number;
    restarts?: number;
    available?: boolean;
  };
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
  wsHosts?: string[];
  wsPath?: string;
  gatewayPort?: number;
  napcat?: NapCatInfo;
  bots?: Array<{ selfId: string; label: string; connected: boolean; apiBase: string; listenPort?: number }>;
  config?: {
    enabled?: boolean;
    accessToken?: string;
    reverseWsPath?: string;
    httpPath?: string;
    bots?: Array<{ selfId?: string; label?: string; apiBase?: string; accessToken?: string; listenPort?: number }>;
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
const logOpen = ref(false);
const logText = ref("");
const logLoading = ref(false);

const enabled = ref(false);
const reverseWsPath = ref("/onebot/v11/ws");
const httpPath = ref("/onebot/v11");
const botCards = ref<BotDraft[]>([]);
let timer: number | undefined;

async function load(quiet = false) {
  if (!quiet) loading.value = true;
  err.value = "";
  try {
    info.value = await api<OneBotInfo>("/v1/channels/onebot11", { token: auth.token });
    if (quiet) return;
    enabled.value = Boolean(info.value.config?.enabled ?? info.value.enabled);
    reverseWsPath.value = info.value.config?.reverseWsPath || info.value.reverseWsPath || "/onebot/v11/ws";
    httpPath.value = info.value.config?.httpPath || info.value.httpPath || "/onebot/v11";
    const bots = info.value.config?.bots || [];
    botCards.value = bots.map((b) => ({
      selfId: b.selfId || "",
      label: b.label || "",
      apiBase: b.apiBase || "",
      accessToken: b.accessToken || "",
      listenPort: Number(b.listenPort) || 0,
    }));
  } catch (e) {
    if (!quiet) err.value = e instanceof Error ? e.message : String(e);
  } finally {
    if (!quiet) loading.value = false;
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
      listenPort: Number(b.listenPort) || 0,
    }));
    info.value = await api<OneBotInfo>("/v1/channels/onebot11/config", {
      method: "POST",
      token: auth.token,
      body: JSON.stringify({
        enabled: enabled.value,
        accessToken: "",
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

async function launchNapCat() {
  acting.value = "launch";
  try {
    const res = await api<{
      message?: string;
      webuiUrl?: string;
      terminal?: string;
      logFile?: string;
    }>("/v1/admin/napcat/launch", {
      method: "POST",
      token: auth.token,
    });
    message.success(res.message || "已启动");
    const url = String(res.webuiUrl || "").trim();
    if (url.startsWith("http")) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    await load(true);
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    acting.value = "";
  }
}

async function stopNapCat() {
  acting.value = "stop";
  try {
    const res = await api<{ message?: string }>("/v1/admin/napcat/stop", {
      method: "POST",
      token: auth.token,
    });
    message.success(res.message || "已停止");
    await load(true);
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    acting.value = "";
  }
}

async function showLogs() {
  logOpen.value = true;
  logLoading.value = true;
  logText.value = "";
  try {
    const res = await api<{ logs?: string; message?: string }>("/v1/admin/napcat/logs?lines=120", {
      token: auth.token,
    });
    logText.value = res.logs || res.message || "（空）";
  } catch (e) {
    logText.value = e instanceof Error ? e.message : String(e);
  } finally {
    logLoading.value = false;
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
  timer = window.setInterval(() => void load(true), 5000);
});
onUnmounted(() => {
  if (timer) window.clearInterval(timer);
});
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>OneBot 11 · QQ</h1>
      <p class="muted">NapCat 用 PM2 后台跑。本页轻量启动 / 停止 / 看日志，扫码后连上即可。</p>
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
            <n-button
              type="primary"
              :loading="acting === 'launch'"
              :disabled="!(info?.napcat?.canLaunch || info?.napcat?.installed)"
              @click="launchNapCat"
            >
              启动 NapCat
            </n-button>
            <n-button
              :loading="acting === 'stop'"
              :disabled="!info?.napcat?.pm2?.available"
              @click="stopNapCat"
            >
              停止
            </n-button>
            <n-button :disabled="!info?.napcat?.pm2?.available" @click="showLogs">日志</n-button>
            <n-button
              :loading="acting === 'wire'"
              :disabled="!(info?.napcat?.home || info?.napcat?.installed)"
              @click="rewire"
            >
              重新写入反向 WS
            </n-button>
            <a
              class="doc-link"
              :href="info?.napcat?.docsUrl || 'https://napneko.github.io/guide/boot/Shell'"
              target="_blank"
              rel="noreferrer"
            >
              官网 Shell 说明
            </a>
          </n-space>
          <p v-if="info?.napcat?.home" class="hint">安装目录：{{ info.napcat.home }}</p>
          <p v-if="info?.napcat?.pm2" class="hint">
            PM2：
            <template v-if="!info.napcat.pm2.available">未安装（服务器执行 npm i -g pm2）</template>
            <template v-else>
              {{ info.napcat.pm2.name }} · {{ info.napcat.pm2.status
              }}{{ info.napcat.pm2.pid ? ` · pid ${info.napcat.pm2.pid}` : "" }}
            </template>
          </p>
          <p v-else-if="info?.napcat?.launchCmd" class="hint">启动命令：{{ info.napcat.launchCmd }}</p>
        </n-card>

        <n-modal
          v-model:show="logOpen"
          preset="card"
          title="NapCat · PM2 日志"
          style="width: min(920px, 94vw)"
          :bordered="false"
        >
          <n-spin :show="logLoading">
            <pre class="log-box">{{ logText || "—" }}</pre>
          </n-spin>
          <template #footer>
            <n-space justify="end">
              <n-button @click="showLogs">刷新</n-button>
              <n-button type="primary" @click="logOpen = false">关闭</n-button>
            </n-space>
          </template>
        </n-modal>

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
            <n-descriptions-item label="PM2">
              <n-tag
                :type="info?.napcat?.pm2?.online ? 'success' : info?.napcat?.pm2?.available ? 'warning' : 'default'"
                size="small"
              >
                {{
                  !info?.napcat?.pm2?.available
                    ? "无 PM2"
                    : info?.napcat?.pm2?.online
                      ? "运行中"
                      : info?.napcat?.pm2?.status || "已停"
                }}
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
          <label class="field">反向 WS 路径 <n-input v-model:value="reverseWsPath" /></label>
          <label class="field">HTTP 路径 <n-input v-model:value="httpPath" /></label>
          <BotAccountCards
            v-model="botCards"
            :live="info?.bots || []"
            :ws-hosts="info?.wsHosts || []"
            :ws-path="info?.wsPath || reverseWsPath"
            :gateway-port="info?.gatewayPort || 8787"
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
  font-size: 0.85rem;
  word-break: break-all;
}
.log-box {
  margin: 0;
  max-height: min(60vh, 520px);
  overflow: auto;
  padding: 12px 14px;
  border-radius: 10px;
  background: #0f1a17;
  color: #d7f5e8;
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
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
