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
const updateInfo = ref<{
  currentVersion?: string;
  remoteVersion?: string;
  updateAvailable?: boolean;
  currentCommit?: string;
  remoteCommit?: string;
  message?: string;
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
    const res = await api<{ message?: string; reportText?: string }>("/v1/admin/update/apply", {
      method: "POST",
      token: auth.token,
      body: JSON.stringify({ confirm: true }),
    });
    message.success(res.reportText || res.message || "更新中，网关即将重启");
    showUpdate.value = false;
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
      <p class="muted">呼唤前缀在此改；框架更新点右侧按钮，结果在中央弹窗确认。</p>
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
        <strong>框架更新</strong>
        <p class="muted">检查远端版本；有更新时在弹窗里确认拉取并重启。</p>
      </div>
      <n-button type="primary" :loading="updateBusy" @click="checkUpdate">检查更新</n-button>
    </div>

    <n-modal
      v-model:show="showUpdate"
      preset="card"
      title="框架更新"
      :style="{ width: 'min(440px, 92vw)' }"
    >
      <p v-if="updateInfo" class="upd-line">
        {{ updateInfo.currentVersion }} → {{ updateInfo.remoteVersion || "—" }}
      </p>
      <p v-if="updateInfo" class="hint mono">
        {{ updateInfo.currentCommit || "?" }} → {{ updateInfo.remoteCommit || "?" }}
      </p>
      <p class="hint">{{ updateInfo?.message }}</p>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showUpdate = false">关闭</n-button>
          <n-button
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
  background: rgba(0, 0, 0, 0.22);
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
</style>
