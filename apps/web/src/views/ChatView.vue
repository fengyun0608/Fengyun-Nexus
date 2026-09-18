<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import { NButton, NInput, NSpace, useMessage } from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

type Msg = { role: "user" | "assistant"; content: string; at?: string };
type FeedRow = {
  id: string;
  channel: string;
  chatId: string;
  userId: string;
  role: string;
  content: string;
  createdAt: string;
};

const CHAT_ID = "console-main";
const auth = useAuthStore();
const message = useMessage();
const input = ref("");
const busy = ref(false);
const loadingHistory = ref(true);
const msgs = ref<Msg[]>([]);
const box = ref<HTMLElement | null>(null);

function pushWelcome() {
  if (!msgs.value.length) {
    msgs.value.push({
      role: "assistant",
      content: "发消息或 #帮助。群里要 @ 或呼唤前缀才会 AI。",
    });
  }
}

async function loadHistory() {
  loadingHistory.value = true;
  try {
    const res = await api<{ items: FeedRow[] }>(
      `/v1/messages/recent?chatId=${encodeURIComponent(CHAT_ID)}&limit=80`,
      { token: auth.token },
    );
    const rows = res.items || [];
    if (rows.length) {
      msgs.value = rows
        .filter((r) => r.role === "user" || r.role === "assistant")
        .map((r) => ({
          role: r.role === "user" ? "user" : "assistant",
          content: r.content,
          at: r.createdAt,
        }));
    } else {
      msgs.value = [];
      pushWelcome();
    }
  } catch {
    msgs.value = [];
    pushWelcome();
  } finally {
    loadingHistory.value = false;
    await nextTick();
    box.value?.scrollTo({ top: box.value.scrollHeight });
  }
}

async function send() {
  const text = input.value.trim();
  if (!text || busy.value) return;
  input.value = "";
  msgs.value.push({ role: "user", content: text });
  busy.value = true;
  try {
    const res = await api<{ assistant?: string; replies?: Array<{ content?: string }> }>("/v1/chat", {
      method: "POST",
      token: auth.token,
      body: JSON.stringify({ content: text, chatId: CHAT_ID, userId: "console" }),
    });
    const out =
      res.assistant ||
      (res.replies || []).map((r) => r.content).filter(Boolean).join("\n") ||
      "（无回复）";
    msgs.value.push({ role: "assistant", content: out });
  } catch (e) {
    message.error(e instanceof Error ? e.message : String(e));
  } finally {
    busy.value = false;
    await nextTick();
    box.value?.scrollTo({ top: box.value.scrollHeight });
  }
}

onMounted(() => void loadHistory());
</script>

<template>
  <div class="page chat-page">
    <header class="page-head">
      <div>
        <h1>对话</h1>
        <p class="muted">控制台直连网关；历史从本机库回放，刷新还在。</p>
      </div>
      <n-space>
        <n-button size="small" quaternary :loading="loadingHistory" @click="loadHistory">刷新历史</n-button>
      </n-space>
    </header>
    <div ref="box" class="chat-box">
      <p v-if="loadingHistory" class="muted pad">加载历史…</p>
      <div v-for="(m, i) in msgs" :key="i" class="bubble" :class="m.role">
        <div class="bubble-meta">
          <strong>{{ m.role === "user" ? "你" : "Nexus" }}</strong>
          <span v-if="m.at" class="at">{{ m.at.replace("T", " ").slice(0, 19) }}</span>
        </div>
        <pre>{{ m.content }}</pre>
      </div>
    </div>
    <div class="composer">
      <n-input
        v-model:value="input"
        type="textarea"
        :autosize="{ minRows: 2, maxRows: 5 }"
        placeholder="输入内容，Enter 发送"
        @keydown.enter.exact.prevent="send"
      />
      <n-button type="primary" :loading="busy" @click="send">发送</n-button>
    </div>
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.page-head h1 {
  margin: 0 0 4px;
  font-family: var(--font-display);
  font-size: 1.75rem;
  color: var(--amber);
}
.muted { color: var(--muted); margin: 0 0 12px; }
.pad { padding: 12px; }
.chat-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 48px);
  min-height: 420px;
}
.chat-box {
  flex: 1;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 12px;
  background: rgba(255, 255, 255, 0.72);
}
.bubble {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--surface-2);
}
.bubble.user {
  background: rgba(47, 155, 120, 0.12);
}
.bubble-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.bubble-meta .at {
  color: var(--muted);
  font-size: 0.75rem;
}
.bubble pre {
  margin: 6px 0 0;
  white-space: pre-wrap;
  font-family: var(--font-ui);
  font-size: 0.95rem;
}
.composer {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  margin-top: 12px;
  align-items: end;
}
</style>
