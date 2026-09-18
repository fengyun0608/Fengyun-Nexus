<script setup lang="ts">
import { onMounted, ref } from "vue";
import { NButton, NCard, NInput, NSpace, useMessage } from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const message = useMessage();

const username = ref("");
const password = ref("");
const password2 = ref("");
const busy = ref(false);
const mustReconfigure = ref(false);

async function loadMe() {
  try {
    const me = await api<{ username?: string; mustReconfigure?: boolean }>("/v1/admin/me", {
      token: auth.token,
    });
    username.value = me.username || auth.username || "";
    mustReconfigure.value = Boolean(me.mustReconfigure);
  } catch {
    /* ignore */
  }
}

async function saveCredentials() {
  if (password.value && password.value !== password2.value) {
    message.error("两次密码不一致");
    return;
  }
  busy.value = true;
  try {
    const path = mustReconfigure.value ? "/v1/admin/setup-credentials" : "/v1/admin/credentials";
    const res = await api<{ message?: string }>(path, {
      method: "POST",
      token: auth.token,
      body: JSON.stringify({
        username: username.value.trim(),
        password: password.value,
      }),
    });
    message.success(res.message || "已保存");
    password.value = "";
    password2.value = "";
    mustReconfigure.value = false;
    await auth.refreshMe();
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
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
      <p class="muted">控制台账号与密码。首次强制改密时也会落在这里。</p>
    </header>
    <n-card title="登录凭据" size="small">
      <p v-if="mustReconfigure" class="hint">当前必须重新设置用户名和密码。</p>
      <label class="field">用户名 <n-input v-model:value="username" /></label>
      <label class="field">新密码 <n-input v-model:value="password" type="password" show-password-on="click" /></label>
      <label class="field">确认密码 <n-input v-model:value="password2" type="password" show-password-on="click" /></label>
      <n-space>
        <n-button type="primary" :loading="busy" @click="saveCredentials">保存</n-button>
      </n-space>
    </n-card>
  </div>
</template>

<style scoped>
@import "@/styles/page.css";
</style>
