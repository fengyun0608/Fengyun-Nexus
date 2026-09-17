# Fengyun Nexus

中文 | [English](README.en.md)（若暂无英页，见仓库根 README）

**Fengyun Nexus** —— 本地可控的 AI 对话与自动化枢纽。

控制台、消息通道、插件、工作流、多模型配置放在同一套网关里跑。分层方式参考 Yunzai / XRK 一类框架（通道入站 → 指令/插件 → 模型 → 回通道），产品壳是自己的，不是崽的分叉。

## 能力一览

| 能力 | 说明 |
|------|------|
| 控制台 | 对话、通道、插件、看板、配置；默认中文，可切 English |
| 通道 | Web、Webhook、QQ（OneBot 11） |
| 插件 | 通道插件 / 框架插件；目录热重载 |
| AI | 多供应商，控制台切换；无密钥不强行回 |
| 指令 | `#帮助` `#状态` `#关机` `#开机` `#重启` `#更新` |
| 环境 | 电脑 / 服务器 / Termux（`NEXUS_ENV`） |

本机配置（`*.local.json`、密钥）不进公开仓库。

## 架构（简图）

```text
控制台 / QQ / Webhook  →  Gateway  →  通道 · 会话/LLM · 插件/工作流/MCP  →  本地库
```

细节见 [如何运作](../internal/how-it-works.md)。

## 下一步

- [环境要求](environment.md)
- [开始使用](start.md)
- [插件生态简介](../ecosystem/plugins.md)
