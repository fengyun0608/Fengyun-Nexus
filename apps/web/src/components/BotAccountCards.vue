<script setup lang="ts">
import { NButton, NInput, NTag } from "naive-ui";

export type BotDraft = {
  selfId: string;
  label: string;
  apiBase: string;
  accessToken: string;
};

const props = defineProps<{
  modelValue: BotDraft[];
  live?: Array<{ selfId: string; connected?: boolean }>;
  reverseWsUrl?: string;
  gatewayPort?: number;
}>();

const emit = defineEmits<{
  "update:modelValue": [BotDraft[]];
}>();

function patch(i: number, part: Partial<BotDraft>) {
  emit(
    "update:modelValue",
    props.modelValue.map((b, idx) => (idx === i ? { ...b, ...part } : b)),
  );
}

function add() {
  emit("update:modelValue", [
    ...props.modelValue,
    { selfId: "", label: "新号", apiBase: "", accessToken: "" },
  ]);
}

function remove(i: number) {
  emit(
    "update:modelValue",
    props.modelValue.filter((_, idx) => idx !== i),
  );
}

function connected(b: BotDraft): boolean {
  const sid = b.selfId.trim();
  if (!sid) return false;
  return Boolean(props.live?.some((x) => x.selfId === sid && x.connected));
}

function portOf(apiBase: string): string {
  const s = String(apiBase || "").trim();
  if (!s) return "";
  try {
    const u = new URL(s.includes("://") ? s : `http://${s}`);
    const port = u.port || "";
    if (props.gatewayPort && Number(port) === props.gatewayPort) return "";
    return port;
  } catch {
    return /^\d+$/.test(s) ? s : "";
  }
}

function setPort(i: number, raw: string) {
  const p = raw.trim();
  if (!p) {
    patch(i, { apiBase: "" });
    return;
  }
  if (!/^\d+$/.test(p)) return;
  patch(i, { apiBase: `http://127.0.0.1:${p}` });
}

async function copyUrl() {
  const url = props.reverseWsUrl || "";
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    /* 剪贴板不可用时地址仍显示在卡片上 */
  }
}
</script>

<template>
  <div class="bot-cards">
    <p class="hint">每个号一张卡。反向地址已经写好，不用自己拼。接口端口忘了就留空，走反向连接。</p>
    <p v-if="reverseWsUrl" class="ws-shared">
      <span>反向地址</span>
      <code>{{ reverseWsUrl }}</code>
      <n-button size="tiny" @click="copyUrl">复制</n-button>
    </p>
    <article v-for="(b, i) in modelValue" :key="i" class="bot-card">
      <header>
        <strong>{{ b.label.trim() || "未备注" }}</strong>
        <n-tag :type="connected(b) ? 'success' : 'warning'" size="small">
          {{ connected(b) ? "已连接" : "未连接" }}
        </n-tag>
      </header>
      <label class="field">
        备注
        <n-input :value="b.label" placeholder="主号 / 小号" @update:value="(v) => patch(i, { label: v })" />
      </label>
      <label class="field">
        QQ
        <n-input :value="b.selfId" placeholder="扫码连上后会自动填" @update:value="(v) => patch(i, { selfId: v })" />
      </label>
      <label class="field">
        反向地址
        <n-input :value="reverseWsUrl || '保存启用后出现，各号都连这一条'" readonly />
      </label>
      <label class="field">
        这个号的接口端口
        <n-input
          :value="portOf(b.apiBase)"
          placeholder="忘了就留空"
          @update:value="(v) => setPort(i, v)"
        />
      </label>
      <n-button size="tiny" quaternary @click="remove(i)">去掉这个号</n-button>
    </article>
    <n-button @click="add">添加一个号</n-button>
  </div>
</template>

<style scoped>
.hint {
  margin: 0 0 8px;
  color: #3d6b66;
  font-size: 13px;
}
.ws-shared {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin: 0 0 10px;
  font-size: 13px;
}
.ws-shared code {
  word-break: break-all;
}
.bot-card {
  border: 1px solid #cfe6e1;
  border-radius: 12px;
  padding: 10px 12px;
  margin-bottom: 10px;
  background: #f7fbfa;
}
.bot-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
  font-size: 13px;
}
</style>
