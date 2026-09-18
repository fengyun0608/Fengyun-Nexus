# Fengyun Nexus

本地可控的 AI 对话与自动化枢纽：控制台、消息通道、插件、工作流、多模型配置，一套跑通。

事件进网关、插件按规则处理、通道可插拔。

<p align="center">
  <img alt="license" src="https://img.shields.io/badge/License-MIT-c4842f?style=flat-square" />
  <img alt="node" src="https://img.shields.io/badge/Node.js-%E2%89%A520-339933?style=flat-square" />
  <img alt="platform" src="https://img.shields.io/badge/Windows%20%7C%20Linux%20%7C%20macOS%20%7C%20Termux-1a1f18?style=flat-square" />
</p>

<p align="center">
  <a href="https://gitcode.com/fengyunnb_admin/Fengyun-Nexus">GitCode</a>
  ·
  <a href="docs/product/start.md">上手</a>
  ·
  <a href="docs/ecosystem/plugins.md">插件</a>
  ·
  <a href="LICENSE">MIT</a>
</p>

---

## 能干什么

| 分类 | 说明 |
|------|------|
| 控制台 | 浏览器里对话、看状态、改配置；默认中文，可切 English |
| 消息通道 | Web / Webhook / QQ（OneBot 11 · NapCat） |
| 插件 | `plugins/` 扫描加载；通道插件与框架插件分开管，支持热重载 |
| AI | 多供应商（云端 / 本地 / 自定义），控制台实时切换；没配密钥就不乱回 |
| 工作流 / MCP | 网关上挂工作流与工具调用 |
| 管理指令 | 一律 `#` 开头：`#帮助` `#状态` `#关机` `#开机` `#重启` `#更新` |
| 部署姿态 | `desktop` / `server` / `termux`（`NEXUS_ENV`） |

密钥和 `*.local.json` 只留本机，仓库默认不收。

---

## 架构

```text
  浏览器控制台 / QQ·NapCat / Webhook
              │
              ▼
         Gateway 网关  (:8787)
    ┌─────────┼──────────┐
    ▼         ▼          ▼
  通道适配   会话 + LLM   插件宿主
  onebot11   providers    plugins/
  web/webhook             ├─ 工作流
                          └─ MCP / 工具
              │
              ▼
         本地库（SQLite 等）
```

消息路径大致是：通道归一成统一消息 → 管理 `#` 指令 → 插件按优先级 → 有密钥再走模型 → 写库并回通道。

`#重启` / `#更新` 写重启标记后退出码 `75`，由 `boot.mjs` **同窗口**再拉起，不新开终端。

---

## 目录

```text
Fengyun-Nexus/
├── apps/
│   ├── gateway/          # 网关：HTTP、OneBot、指令、插件热更
│   ├── web/              # Vite 控制台
│   └── cli/              # pnpm nexus …
├── packages/             # shared / channel / core / db / llm / plugin-* / workflow / mcp-host
├── plugins/              # 业务插件（菜单、回声、生图、QQ 打招呼…）
├── configs/              # *.default.json；本机覆盖用 *.local.json
├── scripts/boot.mjs      # 依赖检查 → 构建 → 拉网关（支持同窗重启）
├── start.bat / boot.sh   # 电脑 / Linux·macOS 入口
├── server-install.sh     # 服务器一键装+启
└── termux-install.sh     # 手机 Termux 一键装+启
```

---

## 环境

| 组件 | 要求 |
|------|------|
| Node.js | ≥ 20（推荐 LTS） |
| pnpm | 9.x（Termux 建议固定 `pnpm@9.15.0`） |
| Git | 克隆与 `#更新` 需要 |

更细的说明见 [环境要求](docs/product/environment.md)。

---

## 快速开始

### Windows

```bat
git clone https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git
cd Fengyun-Nexus
start.bat
```

### Linux 服务器

```bash
git clone --depth 1 https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git ~/Fengyun-Nexus
bash ~/Fengyun-Nexus/server-install.sh
```

仓已在：`bash ~/Fengyun-Nexus/server-install.sh`  
强制重装：`NEXUS_REINSTALL=1 bash ~/Fengyun-Nexus/server-install.sh`

### Linux / macOS（本机已有 Node）

```bash
git clone https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git
cd Fengyun-Nexus
chmod +x boot.sh && ./boot.sh
```

### Termux

```bash
git clone --depth 1 https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git ~/Fengyun-Nexus
bash ~/Fengyun-Nexus/termux-install.sh
```

仓已在：`bash ~/Fengyun-Nexus/termux-install.sh`  
强制重装：`NEXUS_REINSTALL=1 bash ~/Fengyun-Nexus/termux-install.sh`

控制台：<http://127.0.0.1:8787/>  
初始账号：`console` / `console`（登录后请改掉）

---

## 常用命令

```bash
pnpm boot                 # 启动（正式，无 watch）
pnpm nexus setup          # 交互配置
pnpm nexus env desktop    # 切换姿态
pnpm nexus status
```

群里 / 控制台（主人或已登录管理端）：

- `#帮助` `#状态` `#关机` `#开机`
- `#重启` — 同窗口重启
- `#更新` — 拉远程框架后同窗口重启

---

## 文档

- [产品介绍](docs/product/README.md)
- [开始使用](docs/product/start.md)
- [环境要求](docs/product/environment.md)
- [插件生态](docs/ecosystem/plugins.md)

---

## 协议

MIT License — [LICENSE](LICENSE)

Copyright (c) 2026 Fengyun
