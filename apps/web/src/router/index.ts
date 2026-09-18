import { createRouter, createWebHashHistory } from "vue-router";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/home" },
    {
      path: "/home",
      name: "home",
      component: () => import("@/views/HomeView.vue"),
      meta: { title: "概览" },
    },
    {
      path: "/chat",
      name: "chat",
      component: () => import("@/views/ChatView.vue"),
      meta: { title: "对话" },
    },
    {
      path: "/channels",
      name: "channels",
      component: () => import("@/views/ChannelsView.vue"),
      meta: { title: "消息通道" },
    },
    {
      path: "/channels/:id",
      name: "channel-detail",
      component: () => import("@/views/ChannelDetailView.vue"),
      meta: { title: "通道配置" },
    },
    {
      path: "/onebot",
      name: "onebot",
      component: () => import("@/views/OneBotView.vue"),
      meta: { title: "OneBot 11" },
    },
    {
      path: "/automation",
      name: "automation",
      component: () => import("@/views/AutomationView.vue"),
      meta: { title: "工作流与工具" },
    },
    {
      path: "/database",
      name: "database",
      component: () => import("@/views/DatabaseView.vue"),
      meta: { title: "数据库" },
    },
    {
      path: "/env-setup",
      name: "env-setup",
      component: () => import("@/views/EnvSetupView.vue"),
      meta: { title: "环境配置" },
    },
    {
      path: "/env-tasks",
      name: "env-tasks",
      component: () => import("@/views/EnvTasksView.vue"),
      meta: { title: "环境任务" },
    },
    {
      path: "/plugins",
      name: "plugins",
      component: () => import("@/views/PluginsView.vue"),
      meta: { title: "插件" },
    },
    {
      path: "/registry",
      name: "registry",
      component: () => import("@/views/RegistryView.vue"),
      meta: { title: "插件更新" },
    },
    {
      path: "/logs",
      name: "logs",
      component: () => import("@/views/LogsView.vue"),
      meta: { title: "日志" },
    },
    {
      path: "/ai",
      name: "ai",
      component: () => import("@/views/AiView.vue"),
      meta: { title: "AI 层" },
    },
    {
      path: "/config",
      name: "config",
      component: () => import("@/views/ConfigView.vue"),
      meta: { title: "配置" },
    },
    {
      path: "/admin",
      name: "admin",
      component: () => import("@/views/AdminView.vue"),
      meta: { title: "管理" },
    },
  ],
});

router.afterEach((to) => {
  document.title = `${String(to.meta.title || "Nexus")} · Fengyun Nexus`;
});
