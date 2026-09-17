# 消息通道插件写法基准

中文 | [English](channel-plugins.en.md)

Fengyun Nexus 把 **消息通道** 与 **插件** 成对设计：适配器把入站流量规范成 `NexusMessage`，插件统一处理 `NexusEvent`（`e`）。

## 通用写法（所有通道）

1. 插件放在 `plugins/<name>/`，附带 `nexus.plugin.json`
2. 插件 id 优先 `z.*`（如 `z.echo`）
3. 继承 `@fengyun/nexus-plugin-sdk` 的 `Plugin`
4. 用 `rule` + 方法名，或实现 `accept(e, ctx)`
5. 回复：`await e.reply(text)`
6. 需要时按通道过滤：`e.channel === "web"` / `"webhook"`

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

## 通道：`web`

| 项 | 值 |
|----|----|
| 适配器 | `WebChannel` |
| 入口 | `POST /v1/chat`、`POST /v1/chat/stream` |
| Body | `{ content, chatId?, userId? }` |
| `e.channel` | `"web"` |

控制台对话走此通道，插件 API 与其它通道相同。

## 通道：`webhook`

| 项 | 值 |
|----|----|
| 适配器 | `WebhookChannel` |
| 入口 | `POST /v1/channels/webhook` |
| Body | `{ content\|text, chatId\|room, userId\|from }` |
| `e.channel` | `"webhook"` |

```ts
async accept(e: NexusEvent) {
  if (e.channel !== "webhook") return false;
  await e.reply(`ack: ${e.msg}`);
  return true;
}
```

## 新增通道

1. 实现 `ChannelAdapter`（`defineAdapter`）
2. 在网关 `channels.register(adapter)`
3. 文档写清入站字段，并约定 `e.channel === "<id>"`
4. 插件默认跨通道；仅在需要时按 `e.channel` 过滤

本文是 Fengyun Nexus 的 **通道 + 插件编写基准**。
