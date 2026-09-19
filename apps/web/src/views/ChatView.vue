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

function shotSrc(content: string): string {
  const cq = content.match(/\[CQ:image,file=([^\]]+)\]/);
  const raw = cq?.[1] || "";
  if (!raw) return "";
  const name = decodeURIComponent(raw.split(/[/\\]/).pop() || "");
  if (!/^[\w.-]+\.(png|svg)$/i.test(name)) return "";
  return `/v1/media/shot/${encodeURIComponent(name)}?token=${encodeURIComponent(auth.token)}`;
}

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
  const assistantIdx = msgs.value.length;
  msgs.value.push({ role: "assistant", content: "" });
  busy.value = true;
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 100_000);
    let res: Response;
    try {
      res = await fetch("/v1/chat/stream", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ content: text, chatId: CHAT_ID, userId: "console" }),
        signal: ctrl.signal,
      });
    } finally {
      window.clearTimeout(timer);
    }
    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => "");
      throw new Error(errText || `HTTP ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let got = "";
    const flushLine = (line: string) => {
      const s = line.trim();
      if (!s.startsWith("data:")) return;
      const payload = s.slice(5).trim();
      if (!payload) return;
      let data: { delta?: string; done?: boolean; assistant?: string; error?: string };
      try {
        data = JSON.parse(payload) as typeof data;
      } catch {
        return;
      }
      if (data.error) throw new Error(data.error);
      if (data.delta) {
        got += data.delta;
        msgs.value[assistantIdx] = { role: "assistant", content: got };
        void nextTick().then(() => box.value?.scrollTo({ top: box.value.scrollHeight }));
      }
      if (data.done && data.assistant && !got) {
        got = data.assistant;
        msgs.value[assistantIdx] = { role: "assistant", content: got };
      }
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() || "";
      for (const line of lines) flushLine(line);
    }
    if (buf.trim()) flushLine(buf);
    if (!got.trim()) msgs.value[assistantIdx] = { role: "assistant", content: "（无回复）" };
  } catch (e) {
    const tip = e instanceof Error ? e.message : String(e);
    message.error(tip);
    msgs.value[assistantIdx] = { role: "assistant", content: tip.includes("abort") ? "请求超时" : tip };
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
        <p class="muted">控制台直连网关；回复会流式显示。历史从本机库回放。</p>
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
        <img v-if="shotSrc(m.content)" class="shot" :src="shotSrc(m.content)" alt="菜单图" />
        <pre v-else>{{ m.content }}</pre>
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
.shot {
  display: block;
  max-width: min(100%, 520px);
  border-radius: 12px;
  border: 1px solid var(--line);
}
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
