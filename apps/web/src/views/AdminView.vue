<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  NButton,
  NInput,
  NModal,
  NSpace,
  useMessage,
} from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
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
          confirmPassword: newPass2.value,
        }),
      });
      message.success(res.message || "已设置，请重新登录");
      showPwd.value = false;
      mustReconfigure.value = false;
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

onMounted(() => void loadMe());
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>管理</h1>
      <p class="muted">当前账号：{{ displayUser || "—" }}。改密从右侧点开，中央弹窗确认。</p>
    </header>

    <div class="admin-row surface">
      <div>
        <strong>修改密码</strong>
        <p class="muted">修改管理端登录密码；可选同时改用户名。</p>
      </div>
      <n-button type="primary" @click="openPasswordModal">修改</n-button>
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
}
.warn {
  color: var(--amber);
}
</style>
