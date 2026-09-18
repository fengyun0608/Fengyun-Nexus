<script setup lang="ts">
import { onMounted, ref } from "vue";
import { NButton, NInput, NModal, NSpace, useMessage } from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const message = useMessage();

const botName = ref("Nexus");
const botWake = ref("");
const saving = ref(false);
const updateBusy = ref(false);
const showUpdate = ref(false);
const applyReport = ref("");
const updateInfo = ref<{
  currentVersion?: string;
  remoteVersion?: string;
  repoUrl?: string;
  pluginsRepoUrl?: string;
  updateAvailable?: boolean;
  message?: string;
  plugins?: {
    available: number;
    skipped?: number;
    items: Array<{ name: string; dir: string; status: string; detail?: string; repoUrl?: string }>;
  };
} | null>(null);

async function loadBot() {
  try {
    const res = await api<{ bot: { name?: string; wakePrefixes?: string[] } }>("/v1/admin/bot", {
      token: auth.token,
    });
    botName.value = res.bot?.name || "Nexus";
    botWake.value = (res.bot?.wakePrefixes || []).join(", ");
  } catch {
    /* ignore */
  }
}

async function saveBot() {
  saving.value = true;
  try {
    await api("/v1/admin/bot", {
      method: "PUT",
      token: auth.token,
      body: JSON.stringify({ name: botName.value, wakePrefixes: botWake.value }),
    });
    message.success("已保存");
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}

async function checkUpdate() {
  updateBusy.value = true;
  applyReport.value = "";
  try {
    updateInfo.value = await api("/v1/admin/update/check", { token: auth.token });
    showUpdate.value = true;
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    updateBusy.value = false;
  }
}

async function applyUpdate() {
  updateBusy.value = true;
  try {
    const res = await api<{
      message?: string;
      reportText?: string;
      updateSummary?: string[];
      shouldExit?: boolean;
    }>("/v1/admin/update/apply", {
      method: "POST",
      token: auth.token,
      body: JSON.stringify({ confirm: true }),
    });
    applyReport.value = res.reportText || res.message || "更新完成";
    if (res.shouldExit) {
      message.success("已拉取，网关即将重启");
    } else {
      message.success(res.message || "已是最新");
    }
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    updateBusy.value = false;
  }
}

onMounted(() => void loadBot());
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>配置</h1>
      <p class="muted">呼唤前缀在此改；框架与系统插件更新点右侧按钮，结果在中央弹窗确认。</p>
    </header>

    <div class="surface">
      <h2>机器人</h2>
      <label class="field">名称 <n-input v-model:value="botName" /></label>
      <label class="field">
        呼唤前缀
        <n-input v-model:value="botWake" placeholder="例如 nexus，逗号分隔；留空=群里只能@" />
      </label>
      <p class="hint">群聊：@ 机器人或开头呼唤词才走 AI。私聊/本控制台不限。</p>
      <n-button type="primary" :loading="saving" @click="saveBot">保存</n-button>
    </div>

    <div class="admin-row surface" style="margin-top: 14px">
      <div>
        <strong>框架与系统插件更新</strong>
        <p class="muted">检查远端框架与官方系统插件专仓；有更新时在弹窗里确认拉取并重启。</p>
      </div>
      <n-button type="primary" :loading="updateBusy" @click="checkUpdate">检查更新</n-button>
    </div>

    <n-modal
      v-model:show="showUpdate"
      preset="card"
      title="框架与系统插件更新"
      :style="{ width: 'min(560px, 94vw)' }"
    >
      <template v-if="!applyReport">
        <p v-if="updateInfo" class="upd-line">
          主框架版本 {{ updateInfo.currentVersion || "?" }}
          <template v-if="updateInfo.updateAvailable && updateInfo.remoteVersion && updateInfo.remoteVersion !== updateInfo.currentVersion">
            → {{ updateInfo.remoteVersion }}
          </template>
          <template v-else-if="!updateInfo.updateAvailable">（已是最新）</template>
        </p>
        <p v-if="updateInfo?.repoUrl" class="hint">
          主框架仓库
          <a :href="updateInfo.repoUrl" target="_blank" rel="noopener noreferrer">{{ updateInfo.repoUrl }}</a>
        </p>
        <p v-if="updateInfo?.pluginsRepoUrl" class="hint">
          系统插件仓库
          <a :href="updateInfo.pluginsRepoUrl" target="_blank" rel="noopener noreferrer">{{ updateInfo.pluginsRepoUrl }}</a>
        </p>
        <p class="hint">{{ updateInfo?.message }}</p>
        <div v-if="updateInfo?.plugins?.items?.length" class="plugin-box">
          <strong>有更新的插件</strong>
          <ul>
            <li v-for="p in updateInfo.plugins.items" :key="p.dir || p.name">
              {{ p.name }}
              <span v-if="p.detail"> · {{ p.detail }}</span>
              <div v-if="p.repoUrl" class="hint">
                <a :href="p.repoUrl" target="_blank" rel="noopener noreferrer">{{ p.repoUrl }}</a>
              </div>
            </li>
          </ul>
        </div>
        <p v-else-if="updateInfo" class="hint">
          {{ updateInfo.plugins?.skipped ? `${updateInfo.plugins.skipped} 个插件无更新，已跳过` : "没有待更新的插件" }}
        </p>
      </template>
      <pre v-else class="report">{{ applyReport }}</pre>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showUpdate = false">关闭</n-button>
          <n-button
            v-if="!applyReport"
            type="primary"
            :disabled="!updateInfo?.updateAvailable"
            :loading="updateBusy"
            @click="applyUpdate"
          >
            拉取并重启
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
@import "@/styles/page.css";
.surface {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  padding: 16px;
}
.surface h2 {
  margin: 0 0 12px;
  font-family: var(--font-display);
  font-size: 1.1rem;
  color: var(--amber);
}
.upd-line {
  margin: 0 0 6px;
  font-size: 1.05rem;
}
.hint a {
  color: var(--amber);
  word-break: break-all;
}
.plugin-box {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--line);
}
.plugin-box ul {
  margin: 8px 0 0;
  padding-left: 18px;
}
.plugin-box li {
  margin: 4px 0;
}
.report {
  margin: 0;
  max-height: 360px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.5;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--line);
}
</style>
