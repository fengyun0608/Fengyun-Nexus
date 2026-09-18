<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  NButton,
  NInput,
  NInputNumber,
  NModal,
  NSelect,
  NSpace,
  useMessage,
} from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
import { DEFAULT_WALLPAPER_URL, useConsoleStore } from "@/stores/console";

const auth = useAuthStore();
const consoleUi = useConsoleStore();
const message = useMessage();

const displayUser = ref("");
const mustReconfigure = ref(false);
const showPwd = ref(false);
const confirmStep = ref(false);
const busy = ref(false);
const formErr = ref("");

const curPass = ref("");
const newUser = ref("");
const newPass = ref("");
const newPass2 = ref("");

const wallUrl = ref(DEFAULT_WALLPAPER_URL);
const wallFit = ref<"cover" | "contain" | "fill">("cover");
const wallDim = ref(0.42);
const wallSaving = ref(false);
const defaultUrl = ref(DEFAULT_WALLPAPER_URL);

const fitOptions = [
  { label: "铺满裁切（cover）", value: "cover" },
  { label: "完整显示（contain）", value: "contain" },
  { label: "拉伸填满（fill）", value: "fill" },
];

async function loadMe() {
  try {
    const me = await api<{ username?: string; mustReconfigure?: boolean }>("/v1/admin/me", {
      token: auth.token,
    });
    displayUser.value = me.username || auth.username || "";
    mustReconfigure.value = Boolean(me.mustReconfigure);
    if (mustReconfigure.value) openPasswordModal();
  } catch {
    /* ignore */
  }
}

async function loadAppearance() {
  try {
    const res = await api<{
      appearance?: {
        wallpaperUrl?: string;
        wallpaperFit?: "cover" | "contain" | "fill";
        wallpaperDim?: number;
      };
      defaults?: { wallpaperUrl?: string };
    }>("/v1/admin/console", { token: auth.token });
    wallUrl.value = res.appearance?.wallpaperUrl || DEFAULT_WALLPAPER_URL;
    wallFit.value = res.appearance?.wallpaperFit || "cover";
    wallDim.value =
      typeof res.appearance?.wallpaperDim === "number" ? res.appearance.wallpaperDim : 0.42;
    defaultUrl.value = res.defaults?.wallpaperUrl || DEFAULT_WALLPAPER_URL;
    if (res.appearance) consoleUi.applyLocal(res.appearance);
  } catch {
    /* ignore */
  }
}

async function saveAppearance() {
  wallSaving.value = true;
  try {
    const res = await api<{
      message?: string;
      appearance?: {
        wallpaperUrl: string;
        wallpaperFit: "cover" | "contain" | "fill";
        wallpaperDim: number;
      };
    }>("/v1/admin/console", {
      method: "PUT",
      token: auth.token,
      body: JSON.stringify({
        wallpaperUrl: wallUrl.value.trim() || defaultUrl.value,
        wallpaperFit: wallFit.value,
        wallpaperDim: wallDim.value,
      }),
    });
    if (res.appearance) {
      wallUrl.value = res.appearance.wallpaperUrl;
      wallFit.value = res.appearance.wallpaperFit;
      wallDim.value = res.appearance.wallpaperDim;
      consoleUi.applyLocal(res.appearance);
    }
    message.success(res.message || "外观已保存");
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    wallSaving.value = false;
  }
}

function resetWallpaperDefault() {
  wallUrl.value = defaultUrl.value;
  wallFit.value = "cover";
  wallDim.value = 0.42;
}

function openPasswordModal() {
  formErr.value = "";
  confirmStep.value = false;
  curPass.value = "";
  newUser.value = displayUser.value;
  newPass.value = "";
  newPass2.value = "";
  showPwd.value = true;
}

function closePasswordModal() {
  if (mustReconfigure.value) return;
  showPwd.value = false;
}

function goConfirmStep() {
  formErr.value = "";
  if (!mustReconfigure.value && !curPass.value) {
    formErr.value = "请填写当前密码";
    return;
  }
  if (newPass.value && newPass.value !== newPass2.value) {
    formErr.value = "两次新密码不一致";
    return;
  }
  if (mustReconfigure.value && (!newUser.value.trim() || !newPass.value)) {
    formErr.value = "请设置用户名和新密码";
    return;
  }
  confirmStep.value = true;
}

async function saveCredentials() {
  busy.value = true;
  formErr.value = "";
  try {
    if (mustReconfigure.value) {
      const res = await api<{ message?: string }>("/v1/admin/setup-credentials", {
        method: "POST",
        token: auth.token,
        body: JSON.stringify({
          username: newUser.value.trim(),
          password: newPass.value,
          confirmPassword: newPass2.value || undefined,
        }),
      });
      message.success(res.message || "已设置，请重新登录");
      showPwd.value = false;
      auth.logout();
      return;
    }
    const res = await api<{ message?: string }>("/v1/admin/credentials", {
      method: "POST",
      token: auth.token,
      body: JSON.stringify({
        currentPassword: curPass.value,
        username: newUser.value.trim() || undefined,
        password: newPass.value || undefined,
        confirmPassword: newPass2.value || undefined,
      }),
    });
    message.success(res.message || "已更新，请重新登录");
    showPwd.value = false;
    auth.logout();
  } catch (e) {
    formErr.value = e instanceof Error ? e.message : String(e);
    confirmStep.value = false;
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  void loadMe();
  void loadAppearance();
});
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>管理</h1>
      <p class="muted">当前账号：{{ displayUser || "—" }}。改密与控制台壁纸都在本页。</p>
    </header>

    <div class="admin-row surface">
      <div>
        <strong>修改密码</strong>
        <p class="muted">修改管理端登录密码；可选同时改用户名。</p>
      </div>
      <n-button type="primary" @click="openPasswordModal">修改</n-button>
    </div>

    <div class="surface wall-card">
      <h2>控制台壁纸</h2>
      <p class="hint">
        默认地址
        <code>{{ defaultUrl }}</code>
        （本仓库图）。可改成任意 http(s) 链接或站点相对路径。
      </p>
      <label class="field">
        壁纸地址
        <n-input v-model:value="wallUrl" placeholder="/wallpapers/default.jpg" />
      </label>
      <label class="field">
        铺放方式
        <n-select v-model:value="wallFit" :options="fitOptions" />
      </label>
      <label class="field">
        浅色遮罩（0～0.85，越大字越清晰）
        <n-input-number
          v-model:value="wallDim"
          :min="0"
          :max="0.85"
          :step="0.05"
          style="width: 100%"
        />
      </label>
      <div class="wall-preview" :style="consoleUi.wallpaperStyle">
        <div class="wall-preview-dim" :style="consoleUi.dimStyle" />
        <span>预览</span>
      </div>
      <n-space>
        <n-button type="primary" :loading="wallSaving" @click="saveAppearance">保存外观</n-button>
        <n-button quaternary @click="resetWallpaperDefault">恢复默认地址</n-button>
      </n-space>
    </div>

    <n-modal
      v-model:show="showPwd"
      preset="card"
      title="修改密码"
      :style="{ width: 'min(440px, 92vw)' }"
      :mask-closable="!mustReconfigure"
      :closable="!mustReconfigure"
      @update:show="(v) => !v && closePasswordModal()"
    >
      <p class="hint">修改管理端登录密码；可选同时改用户名。</p>
      <p v-if="mustReconfigure" class="hint warn">首次使用必须重新设置用户名和密码。</p>
      <p v-if="formErr" class="err">{{ formErr }}</p>

      <label v-if="!mustReconfigure" class="field">
        当前密码
        <n-input v-model:value="curPass" type="password" show-password-on="click" />
      </label>
      <label class="field">
        {{ mustReconfigure ? "用户名" : "新用户名（可选）" }}
        <n-input v-model:value="newUser" />
      </label>
      <label class="field">
        {{ mustReconfigure ? "新密码" : "新密码（可选）" }}
        <n-input v-model:value="newPass" type="password" show-password-on="click" />
      </label>
      <label class="field">
        确认新密码
        <n-input v-model:value="newPass2" type="password" show-password-on="click" />
      </label>
      <p v-if="confirmStep" class="hint">确认后所有登录态会失效，请用新凭据重新登录。</p>

      <template #footer>
        <n-space justify="end">
          <n-button v-if="!mustReconfigure" @click="showPwd = false">取消</n-button>
          <n-button v-if="!confirmStep" type="primary" @click="goConfirmStep">更新凭据</n-button>
          <n-button v-else type="primary" :loading="busy" @click="saveCredentials">确认更新</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
@import "@/styles/page.css";
.admin-row.surface {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  margin-bottom: 14px;
}
.wall-card {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  padding: 16px 18px 18px;
}
.wall-card h2 {
  margin: 0 0 8px;
  font-size: 1.05rem;
  color: var(--amber);
}
.wall-preview {
  position: relative;
  height: 120px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--line);
  margin: 4px 0 14px;
  display: grid;
  place-items: center;
}
.wall-preview-dim {
  position: absolute;
  inset: 0;
}
.wall-preview span {
  position: relative;
  z-index: 1;
  color: var(--ink);
  font-weight: 600;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.6);
}
.warn {
  color: var(--amber);
}
</style>
