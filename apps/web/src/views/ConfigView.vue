<script setup lang="ts">
import { onMounted, ref } from "vue";
import { NButton, NCard, NInput, NSpace, useMessage } from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const message = useMessage();

const botName = ref("Nexus");
const botWake = ref("");
const saving = ref(false);
const updateBusy = ref(false);
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
    message.info(updateInfo.value?.message || "已检查");
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
    message.success(res.reportText || res.message || "更新中");
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
      <p class="muted">呼唤前缀、更新都在后台改，不用去群里敲指令确认。</p>
    </header>

    <n-card title="机器人" size="small" style="margin-bottom: 14px">
      <label class="field">
        名称
        <n-input v-model:value="botName" />
      </label>
      <label class="field">
        呼唤前缀
        <n-input v-model:value="botWake" placeholder="例如 nexus，逗号分隔；留空=群里只能@" />
      </label>
      <p class="hint">群聊：@ 机器人或开头呼唤词才走 AI。私聊/本控制台不限。</p>
      <n-button type="primary" :loading="saving" @click="saveBot">保存</n-button>
    </n-card>

    <n-card title="框架更新" size="small">
      <n-space>
        <n-button :loading="updateBusy" @click="checkUpdate">检查更新</n-button>
        <n-button
          type="primary"
          :disabled="!updateInfo?.updateAvailable"
          :loading="updateBusy"
          @click="applyUpdate"
        >
          拉取并重启
        </n-button>
      </n-space>
      <div v-if="updateInfo" class="upd">
        <p>
          {{ updateInfo.currentVersion }} → {{ updateInfo.remoteVersion || "—" }}
          ·
          {{ updateInfo.currentCommit || "?" }} → {{ updateInfo.remoteCommit || "?" }}
        </p>
        <p class="hint">{{ updateInfo.message }}</p>
      </div>
    </n-card>
  </div>
</template>

<style scoped>
.page-head h1 {
  margin: 0 0 4px;
  font-family: var(--font-display);
  font-size: 1.75rem;
  color: var(--amber);
}
.muted { color: var(--muted); margin: 0 0 12px; }
.field {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
  color: var(--muted);
  font-size: 0.9rem;
}
.hint {
  color: var(--muted);
  font-size: 0.85rem;
  margin: 8px 0 14px;
}
.upd {
  margin-top: 12px;
  color: var(--ink);
}
</style>
