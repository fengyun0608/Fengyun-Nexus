# Fengyun Nexus · 风云枢纽

**风云网络**出品 · 本地可控的 AI 对话与自动化枢纽

<p align="center">
  <img alt="license" src="https://img.shields.io/badge/License-MIT-c4842f?style=flat-square" />
  <img alt="node" src="https://img.shields.io/badge/Node.js-%E2%89%A520-339933?style=flat-square" />
  <img alt="version" src="https://img.shields.io/badge/Version-0.2.84-2f9b78?style=flat-square" />
  <img alt="platform" src="https://img.shields.io/badge/Windows%20%7C%20Linux%20%7C%20macOS%20%7C%20Termux-1a1f18?style=flat-square" />
</p>

<p align="center">
  <a href="https://gitcode.com/fengyunnb_admin/Fengyun-Nexus">GitCode（国内）</a>
  ·
  <a href="https://github.com/fengyun0608/Fengyun-Nexus">GitHub（国外）</a>
  ·
  <a href="docs/product/start.md">上手</a>
  ·
  <a href="docs/README.md">文档中心</a>
  ·
  <a href="LICENSE">MIT</a>
</p>

## 目录

- [能干什么](#能干什么)
- [架构](#架构)
- [快速开始](#快速开始)
- [常用命令](#常用命令)
- [文档](#文档)
- [关于](#关于)
- [致谢](#致谢)
- [协议](#协议)

**风云枢纽**（Fengyun Nexus）把控制台、消息通道、插件、工作流、多模型收进同一套网关：通道入站 → `#` 管理指令与插件 → 有密钥再走模型 → 回通道并写本地库。

- **🌐 多通道**：Web 控制台 / Webhook / QQ（OneBot 11 · NapCat）
- **🔌 插件包**：一组互相照应的插件一起发布；包内可混用简单 / 模块化写法；每个功能插件自带菜单
- **🌐 Web 与 API**：Vue3 控制台 + REST；默认中文，可切 English
- **⭐ 系统插件包**：菜单 / 状态 / 生图 / 回声 / 点赞 / 群管 / 主人等，可走专仓更新
- **🎨 渲染**：浏览器截图发菜单与状态图（控制台「环境配置」装浏览器）

---

## 能干什么

| 分类 | 说明 |
|------|------|
| 控制台 | 浏览器里对话、看板、改配置；清新浅色主题 |
| 消息通道 | Web / Webhook / QQ（OneBot 11 · NapCat 一键装） |
| 插件 | **插件包优先**；包内可混用写法；功能插件自带菜单；热重载；`onReady` 可自定义加载文案 |
| AI | 多供应商（云端 / 本地 / 自定义），控制台实时切换；没配密钥就不乱回 |
| 工作流 / MCP | 网关上挂工作流与工具调用 |
| 管理指令 | 一律 `#` 开头：`#帮助` `#状态` `#关机` `#开机` `#重启` `#更新` |
| 部署姿态 | `desktop` / `server` / `termux`（`NEXUS_ENV`） |

密钥和 `*.local.json` 只留本机，仓库默认不收。

**如果你是第一次接触本项目：**

- 只想**先跑起来** → [开始使用](docs/product/start.md)
- 想**看环境要装什么** → [环境要求](docs/product/environment.md)
- 想**写插件 / 通道** → [插件生态](docs/ecosystem/plugins.md) · [通道插件](docs/ecosystem/channel-plugins.md) · [生态专仓](docs/ecosystem/hub.md)
- 想**接 QQ** → [OneBot 11](docs/ecosystem/onebot11.md)
- **文档中心** → [docs/README.md](docs/README.md)

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

消息路径：通道归一成统一消息 → 管理 `#` 指令 → 插件按优先级（先命中先停）→ 有密钥再走模型 → 写库并回通道。

`#重启` / `#更新` 写重启标记后退出码 `75`，由 `boot.mjs` **同窗口**再拉起，不新开终端。

零配置扩展（放对目录即可）：

- **插件**：`plugins/<名>/` 或模块化 `plugin/` · `adapter/` · `workflow/` …
- **插件包**：一组插件 + `nexus.pack.json` 说明组合与菜单；专仓整包更新
- **通道适配**：插件内 `adapter/` 导出 `defineAdapter`，启动与热更自动挂进侧栏
- **系统插件**：`pnpm pack:system-plugins` 抽到专仓

更细的目录与规划见 [目录鱼骨](docs/product/directory.md) · [能力鱼骨](docs/product/fishbone.md) · [产品规划](docs/product/planning.md)。

---

## 快速开始

机器在哪就选哪边。装完打开 http://127.0.0.1:8787/ ，账号 `console` / `console`（登录后请改掉）。

**国内**

```bash
curl -fsSL "https://api.gitcode.com/api/v5/repos/fengyunnb_admin/Fengyun-Nexus/raw/scripts/get.sh?ref=main" | bash
```

```powershell
irm "https://api.gitcode.com/api/v5/repos/fengyunnb_admin/Fengyun-Nexus/raw/scripts/get.ps1?ref=main" | iex
```

**国外**

```bash
curl -fsSL "https://raw.githubusercontent.com/fengyun0608/Fengyun-Nexus/main/scripts/get.sh" | bash
```

```powershell
irm "https://raw.githubusercontent.com/fengyun0608/Fengyun-Nexus/main/scripts/get.ps1" | iex
```

也可浅克隆后本地启动：

```bash
# GitCode
git clone --depth=1 https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git
# GitHub
git clone --depth=1 https://github.com/fengyun0608/Fengyun-Nexus.git

cd Fengyun-Nexus
# Windows: 双击 start.bat
# Linux / macOS / Termux:
chmod +x boot.sh && ./boot.sh
```

已装过：目录里 `./boot.sh` 或双击 `start.bat`。

本机已装 Docker 时：

```bash
docker compose up -d --build
```

同样打开 http://127.0.0.1:8787/ 。数据在 Docker 卷里，`docker compose down` 不会清掉；要清空再加 `-v`。细节见 [上手](docs/product/start.md)。

---

## 常用命令

```bash
pnpm boot                 # 启动（正式，无 watch）
pnpm smoke                # 另开端口，确认能听并且 #帮助 有回
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

| 主题 | 入口 |
|------|------|
| 文档中心 | [docs/README.md](docs/README.md) |
| 产品介绍 | [docs/product/README.md](docs/product/README.md) |
| 开始使用 | [docs/product/start.md](docs/product/start.md) |
| 环境要求 | [docs/product/environment.md](docs/product/environment.md) |
| 插件生态 | [docs/ecosystem/plugins.md](docs/ecosystem/plugins.md) |
| 插件包 | [docs/ecosystem/plugin-packs.md](docs/ecosystem/plugin-packs.md) |
| OneBot 11 | [docs/ecosystem/onebot11.md](docs/ecosystem/onebot11.md) |

---

## 关于

| | |
|--|--|
| 出品 | **风云网络**（全称：风云网络销售） |
| 产品 | **风云枢纽** · 英文 **Fengyun Nexus** |
| 仓库 | [GitCode](https://gitcode.com/fengyunnb_admin/Fengyun-Nexus) · [GitHub](https://github.com/fengyun0608/Fengyun-Nexus) |

风云网络做的是本地可控、可扩展的对话与自动化框架。风云枢纽是这套框架的正式产品名：网关、控制台、插件商店与生态专仓都归在它名下。对外介绍用「风云枢纽 / Fengyun Nexus」；组织简称写「风云网络」。

---

## 致谢

风云枢纽在产品形态与扩展思路上，受 **[XRK-AGT](https://github.com/xrkseek/XRK-AGT)**（向日葵）启发良多：分层运行时、插件 / 工作流自动挂载、Web 控制台与多平台消息接入等。感谢师父与向日葵团队带来的灵感，也感谢开源生态中的 Node.js、Vue、Naive UI、OneBot、NapCat、Playwright 等组件作者。

| 项目 | 说明 |
|------|------|
| [XRK-AGT](https://github.com/xrkseek/XRK-AGT) | 融合智能体业务逻辑的通用后端；本项目介绍与扩展面写法亦多参照其公开文档 |
| [AGT-Cores-Tools-Index](https://github.com/xrkseek/AGT-Cores-Tools-Index) | AGT 生态索引 |

本仓库是风云网络的独立产品（MIT），实现与品牌均为风云枢纽 / Fengyun Nexus；学习可以，欢迎 Issue / PR 共建。

---

## 协议

MIT License — [LICENSE](LICENSE)

Copyright (c) 2026 风云网络 / Fengyun Network
