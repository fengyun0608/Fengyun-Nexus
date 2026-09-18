<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { NButton, NInput, NForm, NFormItem, useMessage } from "naive-ui";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const message = useMessage();

const user = ref("fengyun");
const pass = ref("");

type NavItem = { to: string; label: string; names?: string[] };
type NavGroup = { title: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    title: "总览",
    items: [
      { to: "/home", label: "概览", names: ["home"] },
      { to: "/chat", label: "对话", names: ["chat"] },
      { to: "/logs", label: "日志", names: ["logs"] },
    ],
  },
  {
    title: "通道",
    items: [
      { to: "/channels", label: "消息通道", names: ["channels", "channel-detail"] },
      { to: "/onebot", label: "OneBot 11", names: ["onebot"] },
    ],
  },
  {
    title: "能力",
    items: [
      { to: "/automation", label: "工作流与工具", names: ["automation"] },
      { to: "/ai", label: "AI 层", names: ["ai"] },
      { to: "/database", label: "数据库", names: ["database"] },
    ],
  },
  {
    title: "环境",
    items: [
      { to: "/env-setup", label: "环境配置", names: ["env-setup"] },
      { to: "/env-tasks", label: "环境任务", names: ["env-tasks"] },
    ],
  },
  {
    title: "插件",
    items: [
      { to: "/plugins", label: "插件管理", names: ["plugins"] },
      { to: "/registry", label: "插件更新", names: ["registry"] },
    ],
  },
  {
    title: "系统",
    items: [
      { to: "/config", label: "配置", names: ["config"] },
      { to: "/admin", label: "管理", names: ["admin"] },
    ],
  },
];

const active = computed(() => String(route.name || "home"));

function isActive(item: NavItem): boolean {
  return (item.names || [item.to.slice(1)]).includes(active.value);
}

onMounted(() => {
  void auth.refreshMe();
});

async function onLogin() {
  try {
    await auth.login(user.value.trim(), pass.value);
    message.success("登录成功");
    await router.replace("/home");
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  }
}
</script>

<template>
  <div v-if="!auth.loggedIn" class="login-wrap">
    <div class="login-card">
      <h1>Fengyun Nexus</h1>
      <p class="muted">后台控制台 · Vue3</p>
      <n-form @submit.prevent="onLogin">
        <n-form-item label="用户名">
          <n-input v-model:value="user" autocomplete="username" />
        </n-form-item>
        <n-form-item label="密码">
          <n-input
            v-model:value="pass"
            type="password"
            show-password-on="click"
            autocomplete="current-password"
            @keyup.enter="onLogin"
          />
        </n-form-item>
        <n-button type="primary" block :loading="auth.busy" @click="onLogin">登录</n-button>
      </n-form>
    </div>
  </div>

  <div v-else class="shell">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <strong>Fengyun Nexus</strong>
        <span>{{ auth.username || "已登录" }}</span>
      </div>
      <nav class="nav">
        <div v-for="g in navGroups" :key="g.title" class="nav-group">
          <div class="nav-group-title">{{ g.title }}</div>
          <router-link
            v-for="item in g.items"
            :key="item.to"
            :to="item.to"
            class="nav-item"
            :class="{ active: isActive(item) }"
          >
            {{ item.label }}
          </router-link>
        </div>
      </nav>
      <div class="sidebar-foot">
        <n-button quaternary size="small" @click="auth.logout()">退出</n-button>
      </div>
    </aside>
    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.login-wrap {
  min-height: 100%;
  display: grid;
  place-items: center;
  padding: 24px;
}
.login-card {
  width: min(360px, 100%);
  padding: 28px 24px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: rgba(26, 31, 24, 0.92);
}
.login-card h1 {
  margin: 0 0 4px;
  font-family: var(--font-display);
  color: var(--amber);
  font-size: 1.6rem;
}
.shell {
  display: grid;
  grid-template-columns: 220px 1fr;
  min-height: 100%;
  height: 100%;
}
.sidebar {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--line);
  background: rgba(18, 20, 16, 0.96);
  min-height: 100vh;
  position: sticky;
  top: 0;
  max-height: 100vh;
  overflow: auto;
}
.sidebar-brand {
  padding: 16px 14px 10px;
  display: grid;
  gap: 4px;
  border-bottom: 1px solid var(--line);
}
.sidebar-brand strong {
  font-family: var(--font-display);
  color: var(--amber);
  font-size: 1.05rem;
}
.sidebar-brand span {
  color: var(--muted);
  font-size: 0.8rem;
}
.nav {
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 10px;
  flex: 1;
}
.nav-group-title {
  padding: 6px 12px 2px;
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
  opacity: 0.85;
}
.nav-item {
  display: block;
  padding: 8px 12px;
  border-radius: 8px;
  color: var(--muted);
  text-decoration: none;
  font-size: 0.92rem;
}
.nav-item:hover,
.nav-item.active {
  color: var(--ink);
  background: rgba(232, 165, 75, 0.12);
}
.sidebar-foot {
  padding: 12px;
  border-top: 1px solid var(--line);
}
.main {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 20px 22px 40px;
}
.muted {
  color: var(--muted);
  margin: 0 0 16px;
}
@media (max-width: 860px) {
  .shell {
    grid-template-columns: 1fr;
  }
  .sidebar {
    position: relative;
    max-height: none;
    min-height: auto;
  }
}
</style>
