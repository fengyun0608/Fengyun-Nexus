# OneBot 11

中文 | [English](onebot11.en.md)

Fengyun Nexus 内置 **OneBot 11** 消息通道，兼容 [NapCat](https://napneko.github.io)。

## 对接方式

| 模式 | NapCat 侧 | Nexus 侧 |
|------|-----------|----------|
| 反向 WS（推荐） | WebSocket 客户端 | `ws://127.0.0.1:8787/onebot/v11/ws` |
| HTTP 上报 | HTTP 客户端 | `POST /onebot/v11/http` |

控制台 → **消息通道 → OneBot 11 开发区** 查看连接状态与配置。

## 插件写法

```ts
import { Plugin, type NexusEvent } from "@fengyun/nexus-plugin-sdk";

export class ZObHi extends Plugin {
  manifest = { id: "z.ob-hi", name: "Z OB Hi", version: "0.1.0" };
  rule = [{ reg: "^你好$", fnc: "hi" }];
  async hi(e: NexusEvent) {
    if (e.channel !== "onebot11") return;
    await e.reply("你好，我是 Fengyun Nexus");
  }
}
export default new ZObHi();
```

## 回复策略

- 插件命中 → 按插件回复
- 已配置 AI → LLM 回复
- **未配置 AI 且无插件命中 → 不回复**（无本地回声）
