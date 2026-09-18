<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { NButton, NCard, NSpin, NTag, NSpace } from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

type ChannelItem = {
  id: string;
  label?: string;
  masters?: string[];
  onlyMasters?: boolean;
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
      <p class="muted">选通道进中枢：主人、回复群、本通道插件都在里面。</p>
    </header>
    <n-space style="margin-bottom: 12px">
      <n-button @click="load">刷新</n-button>
      <n-button type="primary" @click="router.push('/onebot')">OneBot 11</n-button>
    </n-space>
    <n-spin :show="loading">
      <p v-if="err" class="err">{{ err }}</p>
      <div v-else class="grid-2">
        <n-card
          v-for="c in items"
          :key="c.id"
          size="small"
          class="list-card"
          hoverable
          @click="router.push(`/channels/${encodeURIComponent(c.id)}`)"
        >
          <div class="row">
            <strong>{{ c.label || c.id }}</strong>
            <n-tag size="small" :bordered="false">{{ c.id }}</n-tag>
          </div>
          <p class="hint">
            主人 {{ (c.masters || []).length || "—" }}
            ·
            {{ c.onlyMasters ? "仅主人" : "全员可触发" }}
          </p>
        </n-card>
        <p v-if="!items.length" class="muted">暂无通道</p>
      </div>
    </n-spin>
  </div>
</template>

<style scoped>
@import "@/styles/page.css";
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
</style>
