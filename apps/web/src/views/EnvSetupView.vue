<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  NButton,
  NCard,
  NSelect,
  NSpace,
  NSpin,
  NTag,
  useMessage,
} from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

type EnvRuntimeId = "go" | "python" | "browser" | "napcat" | "desktop-pet";
type EnvRuntimeDef = {
  id: EnvRuntimeId;
  label: string;
  versions: string[];
  modes: Array<"compile" | "binary">;
  installed?: boolean;
  activeVersion?: string;
  hint?: string;
  deployable?: boolean;
  unavailableReason?: string;
};

const auth = useAuthStore();
const router = useRouter();
const message = useMessage();
const loading = ref(true);
const busy = ref("");
const err = ref("");
const runtimes = ref<EnvRuntimeDef[]>([]);
const picks = ref<Record<string, { version: string; mode: string }>>({});
let timer: number | undefined;

const versionLabel = (id: string, v: string) => {
  if (id === "napcat") {
    const map: Record<string, string> = {
      auto: "自动检测本机",
      shell: "Windows Shell",
      linux: "Linux Launcher",
      termux: "Termux",
      docker: "Docker 说明包",
    };
    return map[v] || v;
  }
  if (id === "desktop-pet") {
    return v === "electron" ? "Electron 桌宠运行时" : v;
  }
  return v;
};

const isChannelRuntime = (id: string) => id === "napcat" || id === "desktop-pet";

async function load() {
  try {
    const res = await api<{ runtimes: EnvRuntimeDef[] }>("/v1/admin/env-runtimes", {
      token: auth.token,
    });
    runtimes.value = res.runtimes || [];
    for (const r of runtimes.value) {
      if (!picks.value[r.id]) {
        picks.value[r.id] = {
          version:
            r.id === "napcat"
              ? "auto"
              : r.id === "desktop-pet"
                ? "electron"
                : r.activeVersion || r.versions[0] || "",
          mode: r.modes[0] || "binary",
        };
      }
    }
    err.value = "";
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function autoQueue() {
  busy.value = "auto";
  try {
    const res = await api<{ message?: string }>("/v1/admin/env-runtimes/auto-queue", {
      method: "POST",
      token: auth.token,
    });
    message.success(res.message || "已排队");
    await router.push("/env-tasks");
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    busy.value = "";
  }
}

async function install(runtime: EnvRuntimeId) {
  busy.value = runtime;
  try {
    const p = picks.value[runtime];
    await api("/v1/admin/env-tasks", {
      method: "POST",
      token: auth.token,
      body: JSON.stringify({
        runtime,
        version: p?.version,
        mode: p?.mode,
        auto: true,
      }),
    });
    const tip =
      runtime === "napcat"
        ? "NapCat 已排队：装完请启动并扫码"
        : runtime === "desktop-pet"
          ? "桌宠运行时已排队：装完到消息通道打开开关"
          : "已加入队列并自动开始";
    message.success(tip);
    await router.push("/env-tasks");
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    busy.value = "";
  }
}

onMounted(() => {
  void load();
  timer = window.setInterval(() => void load(), 8000);
});
onUnmounted(() => {
  if (timer) window.clearInterval(timer);
});
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>环境配置</h1>
      <p class="muted">
        Go / Python / 浏览器，以及消息通道类（NapCat、桌宠）都要自己点安装；「一键排队」不会装通道类资源。
      </p>
    </header>
    <n-space style="margin-bottom: 12px">
      <n-button type="primary" :loading="busy === 'auto'" @click="autoQueue">一键排队缺失项</n-button>
      <n-button @click="router.push('/env-tasks')">查看任务</n-button>
      <n-button @click="router.push('/onebot')">QQ / OneBot</n-button>
      <n-button @click="router.push('/channels/desktop-pet')">桌宠通道</n-button>
      <n-button @click="load">刷新</n-button>
    </n-space>
    <n-spin :show="loading">
      <p v-if="err" class="err">{{ err }}</p>
      <div v-else class="grid-2">
        <n-card v-for="r in runtimes" :key="r.id" :title="r.label" size="small">
          <n-tag size="small" :type="r.installed ? 'success' : 'warning'" style="margin-bottom: 10px">
            {{ r.installed ? `已安装 ${r.activeVersion || ""}` : "未安装" }}
          </n-tag>
          <n-tag
            v-if="r.deployable === false"
            size="small"
            type="error"
            style="margin-bottom: 10px; margin-left: 6px"
          >
            {{ r.unavailableReason || "当前环境无法部署" }}
          </n-tag>
          <p v-if="r.hint || isChannelRuntime(r.id)" class="hint">
            {{
              r.hint ||
              (r.id === "napcat"
                ? "Windows→Shell · Linux→Launcher · 安卓→Termux · 也可选 Docker 说明包"
                : "")
            }}
          </p>
          <div class="env-pick">
            <label class="field">
              {{ isChannelRuntime(r.id) ? "安装包" : "版本" }}
              <n-select
                v-model:value="picks[r.id].version"
                :disabled="r.deployable === false"
                :options="(r.versions || []).map((v) => ({ label: versionLabel(r.id, v), value: v }))"
              />
            </label>
            <n-button
              type="primary"
              :disabled="
                r.deployable === false || (!isChannelRuntime(r.id) && r.installed)
              "
              :loading="busy === r.id"
              @click="install(r.id)"
            >
              {{
                r.deployable === false
                  ? "无法部署"
                  : r.id === "napcat" && r.installed
                    ? "重装/接线"
                    : r.id === "desktop-pet" && r.installed
                      ? "重装运行时"
                      : "安装"
              }}
            </n-button>
          </div>
          <label v-if="!isChannelRuntime(r.id)" class="field">
            安装方式
            <n-select
              v-model:value="picks[r.id].mode"
              :options="
                (r.modes || []).map((m) => ({
                  label: m === 'compile' ? '编译安装' : '二进制安装',
                  value: m,
                }))
              "
            />
          </label>
          <p v-if="r.id === 'napcat'" class="hint">
            Termux 装 Debian 可能被墙：会自动试本机代理，再不行改拉国内 LXC 源。有 Clash 请开「允许局域网」。
            官网：
            <a href="https://napneko.github.io/guide/boot/Shell" target="_blank" rel="noreferrer">Shell 说明</a>
          </p>
          <p v-if="r.id === 'desktop-pet'" class="hint">
            下载 Electron 体积较大；国内默认走 npmmirror。装好后到
            <button type="button" class="linkish" @click="router.push('/channels/desktop-pet')">
              消息通道 · 桌面桌宠
            </button>
            打开开关。
          </p>
        </n-card>
      </div>
    </n-spin>
  </div>
</template>

<style scoped>
@import "@/styles/page.css";
.env-pick {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: end;
}
.hint {
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 0.86rem;
  line-height: 1.45;
}
.hint a,
.linkish {
  color: var(--amber);
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  font: inherit;
  text-decoration: underline;
}
</style>
