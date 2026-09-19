# OneBot 11

中文 | [English](onebot11.en.md)

Fengyun Nexus 内置 **OneBot 11** 消息通道，兼容 [NapCat](https://napneko.github.io)。

## 对接方式

| 模式 | NapCat 侧 | Nexus 侧 |
|------|-----------|----------|
| 反向 WS（推荐） | WebSocket 客户端 | `ws://<主机>:8787/onebot/v11/ws`（小号可另开 `listenPort`） |
| HTTP 上报 | HTTP 客户端 | `POST /onebot/v11/http` |

控制台 → **环境配置 → NapCat** 可一键安装（Windows Shell / Linux Launcher / Termux）；装完扫码后自动写反向 WS。也可到 **OneBot 11** 页看连接状态与各号令牌（空着就不校验）。

## 通道侧配置（摘要）

- **主人**：在通道设置里配，不在插件列表
- **AI 回复群**：只限制闲聊；`#` 指令不受限；状态图只展示个数，不列群号
- **人设**：通道 `systemPrompt`
- **多号**：各号独立令牌 / 端口；插件可按账号分配生效与独立配置

## 插件写法

```ts
import { Plugin, type NexusEvent } from "@fengyun/nexus-plugin-sdk";

export class ZObHi extends Plugin {
  manifest = { id: "z.ob-hi", name: "QQ 打招呼", version: "0.1.0" };
  rule = [{ reg: "^#你好$", fnc: "hi" }];
  async hi(e: NexusEvent) {
    if (e.channel !== "onebot11") return;
    await e.reply("你好，我是 Fengyun Nexus");
  }
}
export default new ZObHi();
```

QQ API：`ctx.ob11.call(action, params, { botId })`。

## 回复策略

- 插件命中 → 按插件回复
- 已配置 AI → LLM 回复（尽量一条发出，特别长才少切几段）
- **未配置 AI 且无插件命中 → 不回复**
- 群聊 AI：须 @ 机器人或带呼唤前缀；`#` 指令不受影响
