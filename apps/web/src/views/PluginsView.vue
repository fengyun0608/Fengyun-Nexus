<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  NButton,
  NInput,
  NList,
  NListItem,
  NModal,
  NSpace,
  NSpin,
  NTag,
  NThing,
  useMessage,
} from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

type PluginItem = {
  id: string;
  name?: string;
  version?: string;
  enabled?: boolean;
  kind?: "channel" | "framework";
  adapterScope?: "all" | "channel" | "specified";
  channels?: string[];
  configSupported?: boolean;
};

type ChannelItem = { id: string; label?: string; masters?: string[] };

type DevPlugin = {
  id: string;
  dir: string;
  hasIndex: boolean;
  modular?: boolean;
  layout?: string[];
  name?: string;
};

type Layer =
  | { step: "home" }
  | { step: "channels" }
  | { step: "list"; kind: "channel" | "framework"; channelId?: string }
  | { step: "docs"; kind: "channel" | "framework" };

const auth = useAuthStore();
const message = useMessage();
const loading = ref(false);
const plugins = ref<PluginItem[]>([]);
const channels = ref<ChannelItem[]>([]);
const devItems = ref<DevPlugin[]>([]);
const layer = ref<Layer>({ step: "home" });

const showSource = ref(false);
const activeDir = ref("");
const files = ref<Array<{ path: string; size: number }>>([]);
const filePath = ref("");
const fileContent = ref("");
const saving = ref(false);

const showCfg = ref(false);
const cfgId = ref("");
const cfgTitle = ref("");
const cfgSupported = ref(false);
const cfgMsg = ref("");
const cfgSchema = ref<Array<{ key: string; label: string; type?: string }>>([]);
const cfgValues = ref<Record<string, unknown>>({});

const frameworkPlugins = computed(() =>
  plugins.value.filter((p) => p.adapterScope === "all" || p.kind === "framework"),
);

function visibleOnChannel(channelId?: string): PluginItem[] {
  return plugins.value.filter((p) => {
    const scope = p.adapterScope || (p.kind === "framework" ? "all" : "specified");
    if (scope === "all") return true;
    if (!channelId) return scope === "channel" || scope === "specified";
    return (p.channels || []).includes(channelId);
  });
}

const listPlugins = computed(() => {
  if (layer.value.step !== "list") return [];
  if (layer.value.kind === "framework") return frameworkPlugins.value;
  return visibleOnChannel(layer.value.channelId);
});

const listTitle = computed(() => {
  if (layer.value.step === "list" && layer.value.kind === "framework") return "系统插件包";
  if (layer.value.step === "list" && layer.value.channelId) {
    const c = channels.value.find((x) => x.id === layer.value.channelId);
    return `${c?.label || layer.value.channelId} · 本通道插件`;
  }
  if (layer.value.step === "list") return "消息通道插件";
  if (layer.value.step === "channels") return "消息通道插件";
  if (layer.value.step === "docs") {
    return layer.value.kind === "framework" ? "系统插件编写" : "通道插件编写";
  }
  return "插件管理";
});

async function refresh() {
  loading.value = true;
  try {
    const [rt, ch, dev] = await Promise.all([
      api<{ items: PluginItem[] }>("/v1/plugins", { token: auth.token }),
      api<{ items: ChannelItem[] }>("/v1/channels", { token: auth.token }),
      api<{ items: DevPlugin[] }>("/v1/admin/dev/plugins", { token: auth.token }).catch(() => ({
        items: [] as DevPlugin[],
      })),
    ]);
    plugins.value = rt.items || [];
    channels.value = ch.items || [];
    devItems.value = dev.items || [];
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    loading.value = false;
  }
}

function backLayer() {
  if (layer.value.step === "list" && layer.value.kind === "channel" && layer.value.channelId) {
    layer.value = { step: "channels" };
    return;
  }
  if (layer.value.step === "list" || layer.value.step === "channels" || layer.value.step === "docs") {
    layer.value = { step: "home" };
  }
}

async function toggle(p: PluginItem, enabled: boolean) {
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
  showCfg.value = true;
  try {
    const res = await api<{
      supported?: boolean;
      message?: string;
      schema?: Array<{ key: string; label: string; type?: string }>;
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
    await api(`/v1/plugins/${encodeURIComponent(cfgId.value)}/config`, {
      method: "PUT",
      token: auth.token,
      body: JSON.stringify({ values: cfgValues.value }),
    });
    message.success("配置已保存");
    showCfg.value = false;
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  }
}

function findDev(p: PluginItem): DevPlugin | undefined {
  return (
    devItems.value.find((d) => d.id === p.id) ||
    devItems.value.find((d) => d.dir === p.id || d.name === p.name)
  );
}

async function openSource(p: PluginItem) {
  const hit = findDev(p);
  if (!hit) {
    message.warning("未找到对应插件目录");
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
  saving.value = true;
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
    saving.value = false;
  }
}

onMounted(() => void refresh());
</script>

<template>
  <div class="page">
    <header class="page-head">
      <template v-if="layer.step === 'home'">
        <h1>插件管理</h1>
        <p class="muted">先选插件包：消息通道插件 / 系统插件。编写说明也分开，可随时返回上一层。</p>
      </template>
      <template v-else>
        <p class="crumb">
          <button type="button" class="linkish" @click="backLayer">
            {{ layer.step === "list" && layer.kind === "channel" && layer.channelId ? "消息通道插件" : "插件管理" }}
          </button>
          <span> / </span>
          <strong>{{ listTitle }}</strong>
        </p>
        <h1>{{ listTitle }}</h1>
        <p v-if="layer.step === 'list' && layer.kind === 'framework'" class="muted">
          系统级通用插件（菜单、生图、回声等），两边通道也能看到。
        </p>
        <p v-else-if="layer.step === 'channels'" class="muted">先选通道，再管理该通道插件；主人在通道设置里改。</p>
        <p v-else-if="layer.step === 'docs'" class="muted">编写基准与目录约定。</p>
        <p v-else class="muted">启用、停用、配置；模块化目录可看源码。</p>
      </template>
    </header>

    <n-space style="margin-bottom: 12px">
      <n-button size="small" :loading="loading" @click="refresh">刷新</n-button>
      <n-button v-if="layer.step !== 'home'" size="small" quaternary @click="backLayer">返回上一层</n-button>
    </n-space>

    <n-spin :show="loading">
      <div v-if="layer.step === 'home'" class="layer-grid tight">
        <button type="button" class="layer-card" @click="layer = { step: 'channels' }">
          <strong>消息通道插件包</strong>
          <span>绑定某一消息通道（如 QQ）的插件，写法与通道事件相关。</span>
        </button>
        <button
          type="button"
          class="layer-card"
          @click="layer = { step: 'list', kind: 'framework' }"
        >
          <strong>系统插件包</strong>
          <span>框架级通用插件（菜单、生图、回声等），adapterScope=all。</span>
        </button>
        <button type="button" class="layer-card" @click="layer = { step: 'docs', kind: 'channel' }">
          <strong>通道插件编写</strong>
          <span>消息通道插件的编写基准与示例。</span>
        </button>
        <button type="button" class="layer-card" @click="layer = { step: 'docs', kind: 'framework' }">
          <strong>系统插件编写</strong>
          <span>系统插件的编写基准与示例。</span>
        </button>
      </div>

      <div v-else-if="layer.step === 'channels'" class="list">
        <div v-for="c in channels" :key="c.id" class="list-row">
          <div>
            <strong>{{ c.label || c.id }}</strong>
            <div class="hint">
              {{ c.id }}
              · 可用插件 {{ visibleOnChannel(c.id).length }}
            </div>
          </div>
          <n-space>
            <n-button size="small" quaternary @click="$router.push(`/channels/${encodeURIComponent(c.id)}`)">
              通道设置
            </n-button>
            <n-button
              size="small"
              type="primary"
              @click="layer = { step: 'list', kind: 'channel', channelId: c.id }"
            >
              本通道插件 · {{ visibleOnChannel(c.id).length }}
            </n-button>
          </n-space>
        </div>
        <p v-if="!channels.length" class="muted">暂无通道</p>
      </div>

      <div v-else-if="layer.step === 'list'" class="list">
        <div v-for="p in listPlugins" :key="p.id" class="list-row">
          <div>
            <strong>{{ p.name || p.id }}</strong>
            <div class="hint">
              {{ p.id }}
              <n-tag v-if="findDev(p)?.modular" size="tiny" type="success" :bordered="false" style="margin-left: 6px">
                模块化
              </n-tag>
              <span v-if="!p.enabled"> · 已停用</span>
            </div>
          </div>
          <n-space>
            <n-button size="tiny" @click="openConfig(p)">管理</n-button>
            <n-button v-if="findDev(p)" size="tiny" type="primary" secondary @click="openSource(p)">
              在线编辑
            </n-button>
            <n-button
              size="tiny"
              :type="p.enabled ? 'warning' : 'primary'"
              secondary
              @click="toggle(p, !p.enabled)"
            >
              {{ p.enabled ? "停用" : "启用" }}
            </n-button>
          </n-space>
        </div>
        <p v-if="!listPlugins.length" class="muted">这个包里暂时没有插件</p>
      </div>

      <div v-else-if="layer.step === 'docs'" class="docs">
        <template v-if="layer.kind === 'framework'">
          <p><strong>系统插件</strong>：`kind=framework`，`adapterScope=all`。菜单 / 生图 / Echo 属于这一包。</p>
          <p>可放在「系统插件包」与「本通道插件」两边同时显示。</p>
          <p>支持模块化目录：`plugin/*.ts`，以及 adapter / workflow / http / events / www。</p>
          <p>
            <strong>生图（#生图）</strong>：调用系统截图把<strong>菜单/网页</strong>渲出来发群，
            <strong>不是</strong> AI 文生图。浏览器运行时在控制台「环境配置」安装。
          </p>
          <p>
            插件编写：用 <code>ctx.shot.renderMenu</code> / <code>ctx.shot.renderHtml</code>，
            再用 <code>e.replyImage(fileUrl)</code> 只发图（不要旁文）。
          </p>
          <p>列表里点「在线编辑」可改本机插件源码，保存后按需热重载。</p>
        </template>
        <template v-else>
          <p>通道插件：`kind=channel`，`adapterScope=channel` 或 `specified`，并用 `channels` 绑定通道。</p>
          <p>指令以 `#` 开头；主人配置在通道层，不在插件列表里。</p>
          <p>`id` 必须英文；`name` 写中文显示名。</p>
          <p>需要网页截图时，调用 <code>ctx.shot</code>（系统内置），不要自己再装一套浏览器。</p>
        </template>
      </div>
    </n-spin>

    <n-modal
      v-model:show="showCfg"
      preset="card"
      :title="cfgTitle"
      :style="{ width: 'min(480px, 94vw)' }"
    >
      <p v-if="!cfgSupported" class="muted">{{ cfgMsg || "该插件暂未支持配置" }}</p>
      <template v-else>
        <label v-for="f in cfgSchema" :key="f.key" class="field">
          {{ f.label }}
          <n-input
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
      :title="`在线编辑 · ${activeDir}`"
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
        <textarea v-model="fileContent" class="code" rows="20" />
      </div>
      <template #footer>
        <n-space justify="end">
          <n-button v-if="filePath" @click="filePath = ''">返回文件列表</n-button>
          <n-button @click="showSource = false">关闭</n-button>
          <n-button v-if="filePath" type="primary" :loading="saving" @click="saveFile">保存</n-button>
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
.list {
  display: grid;
  gap: 0;
}
.list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 4px;
  border-bottom: 1px solid var(--line);
}
.docs {
  display: grid;
  gap: 10px;
  color: var(--muted);
  line-height: 1.55;
}
.docs strong {
  color: var(--amber);
}
.code {
  width: 100%;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 13px;
  background: #121410;
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px;
  resize: vertical;
}
</style>
