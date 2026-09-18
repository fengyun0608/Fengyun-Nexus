<script setup lang="ts">
import { ref } from "vue";
import { NButton, NInput, NModal, NTag } from "naive-ui";

export type BotDraft = {
  selfId: string;
  label: string;
  apiBase: string;
  accessToken: string;
  listenPort: number;
};

const props = defineProps<{
  modelValue: BotDraft[];
  live?: Array<{ selfId: string; connected?: boolean; listenPort?: number }>;
  wsHosts?: string[];
  wsPath?: string;
  gatewayPort?: number;
}>();

const emit = defineEmits<{
  "update:modelValue": [BotDraft[]];
}>();

const askOpen = ref(false);
const askLabel = ref("");
const askPort = ref("3000");

function nextPort(): number {
  const used = new Set(props.modelValue.map((b) => Number(b.listenPort) || 0));
  let p = 3000;
  while (used.has(p)) p += 1;
  return p;
}

function openAsk() {
  askLabel.value = "";
  askPort.value = String(nextPort());
  askOpen.value = true;
}

function confirmAsk() {
  const label = askLabel.value.trim();
  if (!label) return;
  const listenPort = Math.floor(Number(askPort.value) || 0);
  emit("update:modelValue", [
    ...props.modelValue,
    { selfId: "", label, apiBase: "", accessToken: "", listenPort },
  ]);
  askOpen.value = false;
}

function patch(i: number, part: Partial<BotDraft>) {
  emit(
    "update:modelValue",
    props.modelValue.map((b, idx) => (idx === i ? { ...b, ...part } : b)),
  );
}

function remove(i: number) {
  emit(
    "update:modelValue",
    props.modelValue.filter((_, idx) => idx !== i),
  );
}

function connected(b: BotDraft): boolean {
  return Boolean(
    props.live?.some((x) => {
      if (!x.connected) return false;
      if (b.selfId && x.selfId === b.selfId) return true;
      if (b.listenPort && Number(x.listenPort) === Number(b.listenPort)) return true;
      return false;
    }),
  );
}

function cardUrls(b: BotDraft): string[] {
  const port = Number(b.listenPort) || Number(props.gatewayPort) || 8787;
  const path = (props.wsPath || "/onebot/v11/ws").startsWith("/")
    ? props.wsPath || "/onebot/v11/ws"
    : `/${props.wsPath}`;
  const hosts = (props.wsHosts || []).map((h) => String(h || "").trim()).filter(Boolean);
  const list = hosts.length ? hosts : ["127.0.0.1"];
  const urls = list.map((h) => `ws://${h}:${port}${path}`);
  urls.sort((a, c) => Number(a.includes("127.0.0.1")) - Number(c.includes("127.0.0.1")));
  return urls;
}

function setPort(i: number, raw: string) {
  const p = raw.trim();
  if (!p) {
    patch(i, { listenPort: 0 });
    return;
  }
  if (!/^\d+$/.test(p)) return;
  patch(i, { listenPort: Number(p) });
}

async function copyUrl(url: string) {
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    /* 地址仍显示在卡片上 */
  }
}
</script>

<template>
  <div class="bot-cards">
    <p class="hint">每个号自己的端口和令牌。添加时只写备注，QQ 号连上后写入。</p>
    <article v-for="(b, i) in modelValue" :key="`${b.label}-${i}`" class="bot-card">
      <header>
        <strong>{{ b.label.trim() || "未备注" }}</strong>
        <n-tag :type="connected(b) ? 'success' : 'warning'" size="small">
          {{ connected(b) ? "已连接" : "未连接" }}
        </n-tag>
      </header>
      <p class="qq-line">QQ {{ b.selfId || "连上后自动写入" }}</p>
      <label class="field">
        这个号的令牌
        <n-input
          :value="b.accessToken"
          type="password"
          show-password-on="click"
          placeholder="空着就用共用令牌"
          @update:value="(v) => patch(i, { accessToken: v })"
        />
      </label>
      <label class="field">
        反向端口
        <n-input :value="b.listenPort ? String(b.listenPort) : ''" placeholder="3000" @update:value="(v) => setPort(i, v)" />
      </label>
      <label class="field">
        反向地址
        <n-input :value="cardUrls(b)[0] || ''" readonly />
      </label>
      <p v-for="url in cardUrls(b).slice(1)" :key="url" class="extra-url">
        <code>{{ url }}</code>
      </p>
      <n-button size="tiny" @click="copyUrl(cardUrls(b)[0] || '')">复制这个号的反向地址</n-button>
      <n-button size="tiny" quaternary @click="remove(i)">去掉这个号</n-button>
    </article>
    <n-button @click="openAsk">添加一个号</n-button>

    <n-modal v-model:show="askOpen" preset="card" title="请给这个账号一个备注" :style="{ width: 'min(420px, 92vw)' }">
      <label class="field">
        备注
        <n-input v-model:value="askLabel" placeholder="小号" @keyup.enter="confirmAsk" />
      </label>
      <label class="field">
        反向端口
        <n-input v-model:value="askPort" placeholder="3000" />
      </label>
      <p class="hint">保存后把这张卡上的地址填进这个号的反向连接。QQ 不用手填。</p>
      <template #footer>
        <n-button @click="askOpen = false">取消</n-button>
        <n-button type="primary" :disabled="!askLabel.trim()" @click="confirmAsk">确定</n-button>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.hint {
  margin: 0 0 8px;
  color: #3d6b66;
  font-size: 13px;
}
.qq-line {
  margin: 0 0 8px;
  font-size: 13px;
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
.extra-url {
  margin: 0 0 6px;
  font-size: 12px;
  word-break: break-all;
}
</style>
