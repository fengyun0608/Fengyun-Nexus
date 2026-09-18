<script setup lang="ts">
import { NButton } from "naive-ui";

export type NavItem = { to: string; label: string; names?: string[] };
export type NavGroup = { title: string; items: NavItem[] };

defineProps<{
  username: string;
  navGroups: NavGroup[];
  isActive: (item: NavItem) => boolean;
}>();

const emit = defineEmits<{
  navigate: [];
  logout: [];
}>();
</script>

<template>
  <div class="sidebar-brand">
    <strong>Fengyun Nexus</strong>
    <span>{{ username || "已登录" }}</span>
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
        @click="emit('navigate')"
      >
        {{ item.label }}
      </router-link>
    </div>
  </nav>
  <div class="sidebar-foot">
    <n-button quaternary size="small" @click="emit('logout')">退出</n-button>
  </div>
</template>

<style scoped>
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
</style>
