# 风云枢纽 · Fengyun Nexus

中文 | [English](README.en.md)（若暂无英页，见仓库根 README）

**风云网络**出品。**风云枢纽**（Fengyun Nexus）是本地可控的 AI 对话与自动化枢纽。

控制台、消息通道、插件、工作流、多模型配置放在同一套网关里跑：通道入站 → `#` 指令与插件 → 模型 → 回通道。

| | |
|--|--|
| 出品 | 风云网络（全称：风云网络销售） |
| 产品 | 风云枢纽 · Fengyun Nexus |

| 能力 | 说明 |
|------|------|
| 控制台 | 对话、通道、插件、看板、配置；默认中文，可切 English |
| 通道 | Web、Webhook、QQ（OneBot 11 · NapCat） |
| 插件 | **插件包优先**；功能插件自带菜单；通道 / 框架插件；热重载；可自定义加载文案 |
| AI | 多供应商，控制台切换；无密钥不强行回；回复尽量少分段 |
| 指令 | `#帮助` `#状态` `#关机` `#开机` `#重启` `#更新` |
| 环境 | 电脑 / 服务器 / Termux（`NEXUS_ENV`） |

本机配置（`*.local.json`、密钥）不进公开仓库。

## 架构（简图）

```text
控制台 / QQ / Webhook  →  Gateway  →  通道 · 会话/LLM · 插件/工作流/MCP  →  本地库
```

## 致谢

产品形态与扩展思路受 [XRK-AGT](https://github.com/xrkseek/XRK-AGT)（向日葵）启发。感谢师父与开源社区。完整致谢见仓库根 [README](../../README.md#致谢)。

## 下一步

- [环境要求](environment.md)
- [开始使用](start.md)
- [插件生态简介](../ecosystem/plugins.md)
- [插件包](../ecosystem/plugin-packs.md)
- [文档中心](../README.md)
