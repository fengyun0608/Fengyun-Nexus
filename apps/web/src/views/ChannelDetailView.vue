<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  NButton,
  NInput,
  NList,
  NListItem,
  NModal,
  NSpace,
  NSpin,
  NSwitch,
  NInputNumber,
  NThing,
  useMessage,
} from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
import BotAccountCards, { type BotDraft } from "@/components/BotAccountCards.vue";

type Settings = {
  label?: string;
  masters?: string[];
  coreMasters?: string[];
  newMasters?: string[];
  normalMasters?: string[];
  onlyMasters?: boolean;
  replyGroupIds?: string[];
  systemPrompt?: string;
  note?: string;
};

type PluginItem = {
  id: string;
  name?: string;
  enabled?: boolean;
  kind?: "channel" | "framework";
  adapterScope?: "all" | "channel" | "specified";
  channels?: string[];
};

type DevPlugin = {
  id: string;
  dir: string;
  name?: string;
};

type OneBotInfo = {
  connected?: boolean;
  clients?: number;
  selfId?: string;
  message?: string;
  reverseWsUrl?: string;
  wsHosts?: string[];
  wsPath?: string;
  gatewayPort?: number;
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
const route = useRoute();
const router = useRouter();
const message = useMessage();

const id = computed(() => String(route.params.id || ""));
const loading = ref(true);
const saving = ref(false);
const err = ref("");

const label = ref("");
const coreMasters = ref("");
const newMasters = ref("");
const normalMasters = ref("");
const onlyMasters = ref(false);
const replyGroupIds = ref("");
const systemPrompt = ref("");
const note = ref("");

const showSettings = ref(false);
const showPlugins = ref(false);
const showOnebot = ref(false);

const plugins = ref<PluginItem[]>([]);
const devItems = ref<DevPlugin[]>([]);
const onebot = ref<OneBotInfo | null>(null);
const obEnabled = ref(false);
const obToken = ref("");
const obWs = ref("");
const obHttp = ref("/onebot/v11");
const obBotCards = ref<BotDraft[]>([]);
let onebotTimer: number | undefined;

async function refreshOnebotLive() {
  if (id.value !== "onebot11") return;
  onebot.value = await api<OneBotInfo>("/v1/channels/onebot11", { token: auth.token });
}

const showCfg = ref(false);
const cfgId = ref("");
const cfgTitle = ref("");
const cfgSupported = ref(false);
const cfgMsg = ref("");
const cfgSchema = ref<Array<{ key: string; label: string; type?: string; description?: string }>>([]);
const cfgValues = ref<Record<string, unknown>>({});
const cfgSaved = ref("");

const showSource = ref(false);
const activeDir = ref("");
const files = ref<Array<{ path: string; size: number }>>([]);
const filePath = ref("");
const fileContent = ref("");
const savingFile = ref(false);

const channelPlugins = computed(() =>
  plugins.value.filter((p) => {
    const scope = p.adapterScope || (p.kind === "framework" ? "all" : "specified");
    if (scope === "all") return true;
    return (p.channels || []).includes(id.value);
  }),
);

async function loadSettings() {
  const res = await api<{ settings: Settings }>(
    `/v1/channels/${encodeURIComponent(id.value)}/settings`,
    { token: auth.token },
  );
  const s = res.settings || {};
  label.value = s.label || id.value;
  coreMasters.value = (s.coreMasters || s.masters || []).join(", ");
  newMasters.value = (s.newMasters || []).join(", ");
  normalMasters.value = (s.normalMasters || []).join(", ");
  onlyMasters.value = Boolean(s.onlyMasters);
  replyGroupIds.value = (s.replyGroupIds || []).join(", ");
  systemPrompt.value = s.systemPrompt || "";
  note.value = s.note || "";
}

async function loadPlugins() {
  const [rt, dev] = await Promise.all([
    api<{ items: PluginItem[] }>("/v1/plugins", { token: auth.token }),
    api<{ items: DevPlugin[] }>("/v1/admin/dev/plugins", { token: auth.token }).catch(() => ({
      items: [] as DevPlugin[],
    })),
  ]);
  plugins.value = rt.items || [];
  devItems.value = dev.items || [];
}

async function loadOnebot() {
  if (id.value !== "onebot11") return;
  onebot.value = await api<OneBotInfo>("/v1/channels/onebot11", { token: auth.token });
  obEnabled.value = Boolean(onebot.value.config?.enabled);
  obToken.value = onebot.value.config?.accessToken || "";
  obWs.value = onebot.value.config?.reverseWsPath || "/onebot/v11/ws";
  obHttp.value = onebot.value.config?.httpPath || "/onebot/v11";
  const bots = onebot.value.config?.bots || [];
  obBotCards.value = bots.map((b) => ({
    selfId: b.selfId || "",
    label: b.label || "",
    apiBase: b.apiBase || "",
    accessToken: b.accessToken || "",
    listenPort: Number(b.listenPort) || 0,
  }));
}

async function load() {
  if (!id.value) return;
  loading.value = true;
  err.value = "";
  try {
    await Promise.all([loadSettings(), loadPlugins(), loadOnebot()]);
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function saveSettings() {
  saving.value = true;
  try {
    await api(`/v1/channels/${encodeURIComponent(id.value)}/settings`, {
      method: "PUT",
      token: auth.token,
      body: JSON.stringify({
        label: label.value,
        coreMasters: coreMasters.value,
        newMasters: newMasters.value,
        normalMasters: normalMasters.value,
        onlyMasters: onlyMasters.value,
        replyGroupIds: replyGroupIds.value,
        systemPrompt: systemPrompt.value,
        note: note.value,
      }),
    });
    message.success("已修改成功，立即生效");
    showSettings.value = false;
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

async function togglePlugin(p: PluginItem, enabled: boolean) {
  try {
    await api(`/v1/plugins/${encodeURIComponent(p.id)}/${enabled ? "enable" : "disable"}`, {
      method: "POST",
      token: auth.token,
    });
    p.enabled = enabled;
    message.success(enabled ? `已启用 ${p.name || p.id}` : `已停用 ${p.name || p.id}`);
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  }
}

async function openConfig(p: PluginItem) {
  cfgId.value = p.id;
  cfgTitle.value = p.name || p.id;
  cfgSaved.value = "";
  showCfg.value = true;
  try {
    const res = await api<{
      supported?: boolean;
      message?: string;
      schema?: Array<{ key: string; label: string; type?: string; description?: string }>;
      values?: Record<string, unknown>;
    }>(`/v1/plugins/${encodeURIComponent(p.id)}/config`, { token: auth.token });
    cfgSupported.value = Boolean(res.supported);
    cfgMsg.value = res.message || "";
    cfgSchema.value = res.schema || [];
    cfgValues.value = { ...(res.values || {}) };
  } catch (e) {
    cfgSupported.value = false;
    cfgMsg.value = e instanceof Error ? e.message : String(e);
  }
}

async function saveConfig() {
  try {
    const res = await api<{ message?: string; values?: Record<string, unknown> }>(
      `/v1/plugins/${encodeURIComponent(cfgId.value)}/config`,
      {
        method: "PUT",
        token: auth.token,
        body: JSON.stringify({ values: cfgValues.value }),
      },
    );
    if (res.values) cfgValues.value = { ...res.values };
    cfgSaved.value = res.message || "已修改成功，立即生效";
    message.success(cfgSaved.value);
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  }
}

function findDev(p: PluginItem): DevPlugin | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/[._]/g, "-");
  const pid = norm(p.id);
  return (
    devItems.value.find((d) => d.id === p.id) ||
    devItems.value.find((d) => d.dir === p.id) ||
    devItems.value.find((d) => d.name && p.name && d.name === p.name) ||
    devItems.value.find((d) => norm(d.id) === pid || norm(d.dir) === pid)
  );
}

async function openSource(p: PluginItem) {
  const hit = findDev(p);
  if (!hit) {
    message.warning("未找到对应插件目录，无法编辑");
    return;
  }
  activeDir.value = hit.dir;
  showSource.value = true;
  filePath.value = "";
  fileContent.value = "";
  try {
    const res = await api<{ files: Array<{ path: string; size: number }> }>(
      `/v1/admin/dev/plugins/${encodeURIComponent(hit.dir)}/files`,
      { token: auth.token },
    );
    files.value = res.files || [];
    const prefer =
      files.value.find((f) => f.path.endsWith("/index.ts")) ||
      files.value.find((f) => f.path.endsWith("/index.js")) ||
      files.value.find((f) => /\/plugin\/.+\.ts$/.test(f.path)) ||
      files.value[0];
    if (prefer) await loadFile(prefer.path);
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  }
}

async function loadFile(path: string) {
  try {
    const res = await api<{ path: string; content: string }>(
      `/v1/admin/dev/file?path=${encodeURIComponent(path)}`,
      { token: auth.token },
    );
    filePath.value = res.path;
    fileContent.value = res.content;
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  }
}

async function saveFile() {
  if (!filePath.value) return;
  savingFile.value = true;
  try {
    await api("/v1/admin/dev/file", {
      method: "PUT",
      token: auth.token,
      body: JSON.stringify({ path: filePath.value, content: fileContent.value }),
    });
    message.success("已保存");
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    savingFile.value = false;
  }
}

async function saveOnebot() {
  saving.value = true;
  try {
    const bots = obBotCards.value.map((b) => ({
      selfId: b.selfId.trim(),
      label: b.label.trim(),
      apiBase: b.apiBase.trim(),
      accessToken: b.accessToken.trim(),
      listenPort: Number(b.listenPort) || 0,
    }));
    onebot.value = await api<OneBotInfo>("/v1/channels/onebot11/config", {
      method: "POST",
      token: auth.token,
      body: JSON.stringify({
        enabled: obEnabled.value,
        accessToken: obToken.value,
        reverseWsPath: obWs.value,
        httpPath: obHttp.value,
        bots,
      }),
    });
    message.success(onebot.value.message || "已保存");
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

watch(id, () => void load(), { immediate: false });
onMounted(() => void load());
onUnmounted(() => {
  if (onebotTimer) window.clearInterval(onebotTimer);
});
watch(showOnebot, (open) => {
  if (onebotTimer) window.clearInterval(onebotTimer);
  onebotTimer = undefined;
  if (!open || id.value !== "onebot11") return;
  onebotTimer = window.setInterval(() => {
    void refreshOnebotLive().catch(() => undefined);
  }, 5000);
});
</script>

<template>
  <div class="page">
    <header class="page-head">
      <p class="crumb">
        <button type="button" class="linkish" @click="router.push('/channels')">消息通道</button>
        <span> / </span>
        <span>{{ label || id }}</span>
      </p>
      <h1>{{ label || id }}</h1>
      <p class="muted">通道中枢 · 设置与插件用中央弹窗</p>
    </header>

    <n-spin :show="loading">
      <p v-if="err" class="err">{{ err }}</p>
      <template v-else>
        <div class="layer-grid tight">
          <button type="button" class="layer-card" @click="showSettings = true">
            <strong>通道设置</strong>
            <span>主人、AI 回复群、人设等</span>
          </button>
          <button type="button" class="layer-card" @click="showPlugins = true">
            <strong>本通道插件</strong>
            <span>{{ channelPlugins.length }} 个可用 · 可配置 / 编辑</span>
          </button>
          <button
            v-if="id === 'onebot11'"
            type="button"
            class="layer-card"
            @click="showOnebot = true"
          >
            <strong>OneBot 连接</strong>
            <span>{{ onebot?.connected ? "已连接" : "未连接" }}</span>
          </button>
        </div>
      </template>
    </n-spin>

    <n-modal
      v-model:show="showSettings"
      preset="card"
      title="通道设置"
      :style="{ width: 'min(520px, 94vw)' }"
    >
      <label class="field">显示名 <n-input v-model:value="label" /></label>
      <label class="field">
        核心主人 QQ
        <n-input v-model:value="coreMasters" placeholder="逗号分隔；控制台也可设" />
      </label>
      <label class="field">
        新主人 QQ
        <n-input v-model:value="newMasters" placeholder="可加普通/新主人；删不了核心" />
      </label>
      <label class="field">
        普通主人 QQ
        <n-input v-model:value="normalMasters" placeholder="可加/删普通主人" />
      </label>
      <label class="field row-switch">仅主人可用管理指令 <n-switch v-model:value="onlyMasters" /></label>
      <label class="field">
        AI 回复群
        <n-input v-model:value="replyGroupIds" placeholder="空=不限；# 指令不受此限" />
      </label>
      <label class="field">人设 / 系统提示 <n-input v-model:value="systemPrompt" type="textarea" :rows="4" /></label>
      <label class="field">备注 <n-input v-model:value="note" /></label>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showSettings = false">关闭</n-button>
          <n-button type="primary" :loading="saving" @click="saveSettings">保存</n-button>
        </n-space>
      </template>
    </n-modal>

    <n-modal
      v-model:show="showPlugins"
      preset="card"
      title="本通道插件管理"
      :style="{ width: 'min(560px, 94vw)' }"
    >
      <p class="hint">含系统通用插件与本通道专用插件。</p>
      <div v-for="p in channelPlugins" :key="p.id" class="plug-row">
        <div>
          <strong>{{ p.name || p.id }}</strong>
          <p class="hint">{{ p.id }} · {{ p.kind === "framework" ? "系统" : "通道" }}</p>
        </div>
        <n-space align="center">
          <n-button size="tiny" quaternary @click="openConfig(p)">配置</n-button>
          <n-button size="tiny" type="primary" @click="openSource(p)">编辑</n-button>
          <n-switch :value="Boolean(p.enabled)" @update:value="(v) => togglePlugin(p, v)" />
        </n-space>
      </div>
      <p v-if="!channelPlugins.length" class="muted">本通道暂无可用插件</p>
      <template #footer>
        <n-space justify="end">
          <n-button @click="router.push('/plugins')">打开插件包</n-button>
          <n-button @click="showPlugins = false">关闭</n-button>
        </n-space>
      </template>
    </n-modal>

    <n-modal
      v-model:show="showCfg"
      preset="card"
      :title="`配置 · ${cfgTitle}`"
      :style="{ width: 'min(560px, 94vw)' }"
    >
      <p v-if="!cfgSupported" class="muted">{{ cfgMsg || "该插件暂未支持配置" }}</p>
      <template v-else>
        <p v-if="cfgSaved" class="ok-line">{{ cfgSaved }}</p>
        <label
          v-for="f in cfgSchema"
          :key="f.key"
          class="field"
          :class="{ 'row-switch': f.type === 'boolean' }"
        >
          {{ f.label }}
          <p v-if="f.description" class="hint" style="margin: 0 0 4px">{{ f.description }}</p>
          <n-switch
            v-if="f.type === 'boolean'"
            :value="Boolean(cfgValues[f.key])"
            @update:value="(v) => (cfgValues[f.key] = v)"
          />
          <n-input-number
            v-else-if="f.type === 'number'"
            :value="Number(cfgValues[f.key] ?? 0)"
            @update:value="(v) => (cfgValues[f.key] = v ?? 0)"
          />
          <n-input
            v-else-if="f.type === 'textarea'"
            type="textarea"
            :rows="8"
            :value="String(cfgValues[f.key] ?? '')"
            @update:value="(v) => (cfgValues[f.key] = v)"
          />
          <n-input
            v-else
            :value="String(cfgValues[f.key] ?? '')"
            @update:value="(v) => (cfgValues[f.key] = v)"
          />
        </label>
      </template>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showCfg = false">关闭</n-button>
          <n-button v-if="cfgSupported" type="primary" @click="saveConfig">保存配置</n-button>
        </n-space>
      </template>
    </n-modal>

    <n-modal
      v-model:show="showSource"
      preset="card"
      :title="`编辑源码 · ${activeDir}`"
      :style="{ width: 'min(720px, 96vw)' }"
      :segmented="{ content: true, footer: 'soft' }"
    >
      <n-list v-if="!filePath" hoverable clickable>
        <n-list-item v-for="f in files" :key="f.path" @click="loadFile(f.path)">
          <n-thing :title="f.path" :description="`${f.size} B`" />
        </n-list-item>
      </n-list>
      <div v-else>
        <p class="hint"><code>{{ filePath }}</code></p>
        <textarea v-model="fileContent" class="code" rows="18" />
      </div>
      <template #footer>
        <n-space justify="end">
          <n-button v-if="filePath" @click="filePath = ''">返回文件列表</n-button>
          <n-button @click="showSource = false">关闭</n-button>
          <n-button v-if="filePath" type="primary" :loading="savingFile" @click="saveFile">保存</n-button>
        </n-space>
      </template>
    </n-modal>

    <n-modal
      v-model:show="showOnebot"
      preset="card"
      title="OneBot 连接"
      :style="{ width: 'min(640px, 94vw)' }"
    >
      <p class="hint">
        {{ onebot?.connected ? "已连接" : "未连接" }}
        · 客户端 {{ onebot?.clients ?? 0 }}
        · QQ {{ onebot?.selfId || "—" }}
      </p>
      <label class="field row-switch">启用 <n-switch v-model:value="obEnabled" /></label>
      <label class="field">共用令牌 <n-input v-model:value="obToken" type="password" show-password-on="click" placeholder="某个号单独填了就以那个号为准" /></label>
      <label class="field">反向 WS 路径 <n-input v-model:value="obWs" /></label>
      <label class="field">HTTP 路径 <n-input v-model:value="obHttp" /></label>
      <BotAccountCards
        v-model="obBotCards"
        :live="onebot?.bots || []"
        :ws-hosts="onebot?.wsHosts || []"
        :ws-path="onebot?.wsPath || obWs"
        :gateway-port="onebot?.gatewayPort || 8787"
      />
      <template #footer>
        <n-space justify="end">
          <n-button @click="loadOnebot">刷新</n-button>
          <n-button type="primary" :loading="saving" @click="saveOnebot">保存</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
@import "@/styles/page.css";
.layer-grid.tight {
  padding: 8px 0 0;
}
.row-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.plug-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.code {
  width: 100%;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.45;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: inherit;
  resize: vertical;
}
</style>
