<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { NButton, NSpace, NSpin } from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

type ChannelItem = {
  id: string;
  label?: string;
  masters?: string[];
  onlyMasters?: boolean;
  source?: "core" | "plugin";
};

const auth = useAuthStore();
const router = useRouter();
const loading = ref(true);
const err = ref("");
const items = ref<ChannelItem[]>([]);

async function load() {
  loading.value = true;
  err.value = "";
  try {
    const res = await api<{ items: ChannelItem[] }>("/v1/channels", { token: auth.token });
    items.value = res.items || [];
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

onMounted(() => void load());
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>消息通道</h1>
      <p class="muted">点进通道中枢：主人、本通道插件、连接都从卡片打开。</p>
    </header>
    <n-space style="margin-bottom: 12px">
      <n-button @click="load">刷新</n-button>
      <n-button type="primary" @click="router.push('/onebot')">OneBot 11</n-button>
    </n-space>
    <n-spin :show="loading">
      <p v-if="err" class="err">{{ err }}</p>
      <div v-else class="layer-grid tight">
        <button
          v-for="c in items"
          :key="c.id"
          type="button"
          class="layer-card"
          @click="router.push(`/channels/${encodeURIComponent(c.id)}`)"
        >
          <strong>{{ c.label || c.id }}</strong>
          <span>
            {{ c.id }}
            · {{ c.source === "plugin" ? "插件自动挂载" : "内置" }}
            · 主人 {{ (c.masters || []).length || "—" }}
            · {{ c.onlyMasters ? "仅主人" : "全员可触发" }}
          </span>
        </button>
        <p v-if="!items.length" class="muted">暂无通道</p>
      </div>
    </n-spin>
  </div>
</template>

<style scoped>
@import "@/styles/page.css";
.layer-grid.tight {
  padding: 8px 0 0;
}
</style>
