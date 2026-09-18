<script setup lang="ts">
import { nextTick, ref } from "vue";
import { NButton, NInput, useMessage } from "naive-ui";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

type Msg = { role: "user" | "assistant"; content: string };

const auth = useAuthStore();
const message = useMessage();
const input = ref("");
const busy = ref(false);
const msgs = ref<Msg[]>([{ role: "assistant", content: "发消息或 #帮助。群里要 @ 或呼唤前缀才会 AI。" }]);
const box = ref<HTMLElement | null>(null);

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
      body: JSON.stringify({ content: text, chatId: "console-main", userId: "console" }),
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
</script>

<template>
  <div class="page chat-page">
    <header class="page-head">
      <h1>对话</h1>
      <p class="muted">控制台直连网关，不用去群里试指令也能看效果。</p>
    </header>
    <div ref="box" class="chat-box">
      <div v-for="(m, i) in msgs" :key="i" class="bubble" :class="m.role">
        <strong>{{ m.role === "user" ? "你" : "Nexus" }}</strong>
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
.page-head h1 {
  margin: 0 0 4px;
  font-family: var(--font-display);
  font-size: 1.75rem;
  color: var(--amber);
}
.muted { color: var(--muted); margin: 0 0 12px; }
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
  background: rgba(18, 20, 16, 0.55);
}
.bubble {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(36, 43, 34, 0.9);
}
.bubble.user {
  background: rgba(232, 165, 75, 0.12);
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
