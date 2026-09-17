# Channel plugin baseline

[中文](channel-plugins.md) | English

Fengyun Nexus treats **message channels** and **plugins** as a pair. Adapters normalize inbound traffic into `NexusMessage`; plugins handle the unified `NexusEvent` (`e`).

## Canonical pattern (all channels)

1. Put the plugin under `plugins/<name>/` with `nexus.plugin.json`.
2. Prefer plugin id `z.*` (example: `z.echo`).
3. Extend `Plugin` from `@fengyun/nexus-plugin-sdk`.
4. Match with `rule` + method name, or implement `accept(e, ctx)`.
5. Reply with `await e.reply(text)`.
6. Scope by channel when needed: `e.channel === "web"` / `"webhook"`.

```ts
import { Plugin, type NexusEvent } from "@fengyun/nexus-plugin-sdk";

export class ZHelloPlugin extends Plugin {
  manifest = {
    id: "z.hello",
    name: "Z Hello",
    version: "0.1.0",
    priority: 1000,
    permissions: ["channel.send"],
  };

  rule = [{ reg: "^/hello$", fnc: "hello", describe: "Say hello" }];

  async hello(e: NexusEvent) {
    await e.reply(`hi from ${e.channel}`);
  }
}

export default new ZHelloPlugin();
```

## Channel: `web`

| Item | Value |
|------|--------|
| Adapter | `WebChannel` |
| Entry | `POST /v1/chat`, `POST /v1/chat/stream` |
| Body | `{ content, chatId?, userId? }` |
| `e.channel` | `"web"` |

Use for console chat. Same plugin API as other channels.

## Channel: `webhook`

| Item | Value |
|------|--------|
| Adapter | `WebhookChannel` |
| Entry | `POST /v1/channels/webhook` |
| Body | `{ content\|text, chatId\|room, userId\|from }` |
| `e.channel` | `"webhook"` |

```ts
async accept(e: NexusEvent) {
  if (e.channel !== "webhook") return false;
  await e.reply(`ack: ${e.msg}`);
  return true;
}
```

## Adding a new channel

1. Implement `ChannelAdapter` (`id`, `normalizeInbound`, `formatOutbound`) via `defineAdapter`.
2. `channels.register(adapter)` in the gateway.
3. Document the inbound body fields and set this channel’s plugin tip (`e.channel === "<id>"`).
4. Plugins stay channel-agnostic unless they intentionally filter on `e.channel`.

This document is the **Fengyun Nexus baseline** for channel + plugin authoring.
