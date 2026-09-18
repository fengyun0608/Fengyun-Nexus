<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { NButton, NInput, NForm, NFormItem, useMessage } from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
import { useConsoleStore } from "@/stores/console";

const auth = useAuthStore();
const consoleUi = useConsoleStore();
const route = useRoute();
const router = useRouter();
const message = useMessage();
const navOpen = ref(false);

const user = ref("fengyun");
const pass = ref("");

watch(
  () => route.fullPath,
  () => {
    navOpen.value = false;
  },
);

type NavItem = { to: string; label: string; names?: string[] };
type NavGroup = { title: string; items: NavItem[] };

const channelNav = ref<NavItem[]>([]);

const staticGroups: NavGroup[] = [
  {
    title: "总览",
    items: [
      { to: "/home", label: "概览", names: ["home"] },
      { to: "/chat", label: "对话", names: ["chat"] },
      { to: "/logs", label: "日志", names: ["logs"] },
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

const navGroups = computed<NavGroup[]>(() => {
  const channelItems: NavItem[] = [
    { to: "/channels", label: "消息通道", names: ["channels"] },
    ...channelNav.value,
    { to: "/onebot", label: "OneBot 11", names: ["onebot"] },
  ];
  return [
    staticGroups[0],
    { title: "通道", items: channelItems },
    ...staticGroups.slice(1),
  ];
});

const active = computed(() => String(route.name || "home"));

function isActive(item: NavItem): boolean {
  if (item.to.startsWith("/channels/") && route.name === "channel-detail") {
    const id = String(route.params.id || "");
    return item.to === `/channels/${encodeURIComponent(id)}` || item.to === `/channels/${id}`;
  }
  if (item.to === "/channels") return active.value === "channels";
  return (item.names || [item.to.slice(1)]).includes(active.value);
}

async function refreshChannelNav() {
  if (!auth.loggedIn || !auth.token) {
    channelNav.value = [];
    return;
  }
  try {
    const res = await api<{ items: Array<{ id: string; label: string }> }>("/v1/channels", {
      token: auth.token,
    });
    channelNav.value = (res.items || []).map((c) => ({
      to: `/channels/${encodeURIComponent(c.id)}`,
      label: c.label || c.id,
      names: ["channel-detail"],
    }));
  } catch {
    channelNav.value = [];
  }
}

onMounted(() => {
  void consoleUi.refresh();
  void auth.refreshMe().then(() => refreshChannelNav());
});

watch(
  () => auth.loggedIn,
  (ok) => {
    if (ok) void refreshChannelNav();
    else channelNav.value = [];
  },
);

async function onLogin() {
  try {
    await auth.login(user.value.trim(), pass.value);
    message.success("登录成功");
    await refreshChannelNav();
    await router.replace("/home");
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  }
}
</script>

<template>
  <div v-if="!auth.loggedIn" class="login-wrap" :style="consoleUi.wallpaperStyle">
    <div class="login-bg" aria-hidden="true" :style="consoleUi.dimStyle">
      <span class="orb orb-a" />
      <span class="orb orb-b" />
      <span class="orb orb-c" />
      <span class="grid-fade" />
    </div>
    <div class="login-card">
      <div class="brand-mark" aria-hidden="true">
        <span class="brand-ring" />
        <span class="brand-core" />
      </div>
      <h1>Fengyun Nexus</h1>
      <p class="muted">后台控制台</p>
      <n-form class="login-form" @submit.prevent="onLogin">
        <n-form-item label="用户名">
          <n-input v-model:value="user" autocomplete="username" size="large" />
        </n-form-item>
        <n-form-item label="密码">
          <n-input
            v-model:value="pass"
            type="password"
            size="large"
            show-password-on="click"
            autocomplete="current-password"
            @keyup.enter="onLogin"
          />
        </n-form-item>
        <n-button
          class="login-btn"
          type="primary"
          block
          size="large"
          :loading="auth.busy"
          @click="onLogin"
        >
          进入控制台
        </n-button>
      </n-form>
    </div>
  </div>

  <div v-else class="shell-wrap" :style="consoleUi.wallpaperStyle">
    <div class="shell-dim" aria-hidden="true" :style="consoleUi.dimStyle" />
    <div class="mobile-bar">
      <button type="button" class="menu-btn" @click="navOpen = !navOpen">
        {{ navOpen ? "关闭" : "菜单" }}
      </button>
      <strong>Fengyun Nexus</strong>
    </div>
    <div class="shell" :class="{ 'nav-open': navOpen }">
      <button
        v-if="navOpen"
        type="button"
        class="nav-mask"
        aria-label="关闭菜单"
        @click="navOpen = false"
      />
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
              @click="navOpen = false"
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
  </div>
</template>

<style scoped>
.login-wrap {
  position: relative;
  isolation: isolate;
  min-height: 100%;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 28px 20px;
  overflow: hidden;
}
.login-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(48px);
  opacity: 0.55;
  will-change: transform;
}
.orb-a {
  width: min(42vw, 380px);
  height: min(42vw, 380px);
  left: 8%;
  top: 12%;
  background: rgba(94, 196, 212, 0.28);
  animation: orb-drift-a 14s ease-in-out infinite;
}
.orb-b {
  width: min(48vw, 420px);
  height: min(48vw, 420px);
  right: 4%;
  bottom: 8%;
  background: rgba(76, 175, 138, 0.26);
  animation: orb-drift-b 18s ease-in-out infinite;
}
.orb-c {
  width: min(28vw, 240px);
  height: min(28vw, 240px);
  left: 42%;
  top: 38%;
  background: rgba(47, 155, 120, 0.14);
  animation: orb-drift-c 11s ease-in-out infinite;
}
.grid-fade {
  position: absolute;
  inset: 0;
  opacity: 0.22;
  background-image:
    linear-gradient(rgba(28, 50, 44, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(28, 50, 44, 0.05) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse 70% 60% at 50% 45%, #000 20%, transparent 75%);
  animation: grid-breathe 8s ease-in-out infinite;
}
.login-card {
  position: relative;
  z-index: 1;
  width: min(400px, 100%);
  padding: 36px 30px 30px;
  border: 1px solid rgba(45, 140, 110, 0.2);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow:
    0 0 0 1px rgba(76, 175, 138, 0.08) inset,
    0 24px 60px rgba(40, 90, 70, 0.12);
  text-align: center;
  animation: card-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.brand-mark {
  position: relative;
  width: 52px;
  height: 52px;
  margin: 0 auto 16px;
}
.brand-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1.5px solid rgba(47, 155, 120, 0.4);
  animation: ring-spin 10s linear infinite;
}
.brand-ring::after {
  content: "";
  position: absolute;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--amber);
  top: -4px;
  left: calc(50% - 3.5px);
  box-shadow: 0 0 10px rgba(47, 155, 120, 0.45);
}
.brand-core {
  position: absolute;
  inset: 12px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 35% 30%, rgba(242, 239, 230, 0.35), transparent 45%),
    linear-gradient(145deg, rgba(47, 155, 120, 0.55), rgba(76, 175, 138, 0.35));
  animation: core-pulse 3.2s ease-in-out infinite;
}
.login-card h1 {
  margin: 0 0 6px;
  font-family: var(--font-display);
  color: var(--amber);
  font-size: clamp(1.75rem, 4vw, 2.05rem);
  font-weight: 600;
  letter-spacing: 0.02em;
  animation: title-in 0.85s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both;
}
.login-card .muted {
  margin: 0 0 22px;
  animation: title-in 0.85s cubic-bezier(0.22, 1, 0.36, 1) 0.22s both;
}
.login-form {
  text-align: left;
  animation: title-in 0.85s cubic-bezier(0.22, 1, 0.36, 1) 0.32s both;
}
.login-btn {
  margin-top: 4px;
  transition: transform 0.2s ease, filter 0.2s ease;
}
.login-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.06);
}
@keyframes card-in {
  from {
    opacity: 0;
    transform: translateY(22px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes title-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes orb-drift-a {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(28px, 36px) scale(1.08);
  }
}
@keyframes orb-drift-b {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(-36px, -24px) scale(1.06);
  }
}
@keyframes orb-drift-c {
  0%,
  100% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(18px, -28px);
  }
}
@keyframes grid-breathe {
  0%,
  100% {
    opacity: 0.14;
  }
  50% {
    opacity: 0.22;
  }
}
@keyframes ring-spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes core-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.9;
  }
  50% {
    transform: scale(1.06);
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .orb,
  .grid-fade,
  .brand-ring,
  .brand-core,
  .login-card,
  .login-card h1,
  .login-card .muted,
  .login-form {
    animation: none !important;
  }
}
.shell-wrap {
  position: relative;
  isolation: isolate;
  min-height: 100%;
  height: 100%;
}
.shell-dim {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
.shell {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 220px 1fr;
  min-height: 100%;
  height: 100%;
}
.sidebar {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
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
}
.nav-item {
  display: block;
  padding: 8px 12px;
  border-radius: 8px;
  color: var(--ink);
  text-decoration: none;
  font-size: 0.92rem;
  opacity: 0.78;
}
.nav-item:hover,
.nav-item.active {
  opacity: 1;
  color: var(--amber-deep);
  background: rgba(47, 155, 120, 0.12);
  font-weight: 600;
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
.mobile-bar,
.nav-mask {
  display: none;
}
@media (max-width: 860px) {
  .shell {
    grid-template-columns: 1fr;
  }
  .mobile-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    position: sticky;
    top: 0;
    z-index: 50;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.94);
    border-bottom: 1px solid var(--line);
  }
  .mobile-bar strong {
    color: var(--amber);
    font-family: var(--font-display);
  }
  .menu-btn {
    border: 1px solid var(--line);
    background: #fff;
    color: var(--ink);
    border-radius: 8px;
    padding: 6px 12px;
    font-weight: 700;
  }
  /* 遮罩与侧栏同属 .shell 层叠上下文，侧栏必须高于遮罩 */
  .nav-mask {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 40;
    border: 0;
    padding: 0;
    margin: 0;
    background: rgba(20, 40, 32, 0.42);
    -webkit-tap-highlight-color: transparent;
  }
  .sidebar {
    position: fixed;
    z-index: 45;
    top: 0;
    left: 0;
    width: min(280px, 86vw);
    height: 100dvh;
    max-height: 100dvh;
    min-height: 0;
    transform: translateX(-105%);
    transition: transform 0.2s ease;
    box-shadow: 8px 0 28px rgba(20, 40, 32, 0.12);
    pointer-events: auto;
  }
  .shell.nav-open .sidebar {
    transform: translateX(0);
  }
  .main {
    padding: 14px 12px 28px;
  }
}
</style>
