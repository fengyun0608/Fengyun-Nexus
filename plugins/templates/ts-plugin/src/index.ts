import { definePlugin } from "@fengyun/nexus-plugin-sdk";
import { newId, nowIso } from "@fengyun/nexus-shared";

export default definePlugin({
  manifest: {
    id: "template.ts-plugin",
    name: "TS Plugin Template",
    version: "0.1.0",
    hooks: ["onMessage"],
    permissions: ["channel.send"],
    category: "demo",
  },
  onMessage(msg) {
    if (!msg.content.startsWith("/ping")) return null;
    return {
      id: newId("msg"),
      channel: msg.channel,
      chatId: msg.chatId,
      userId: "plugin:template",
      type: "text",
      content: "pong",
      meta: { replyTo: msg.id },
      createdAt: nowIso(),
    };
  },
});
