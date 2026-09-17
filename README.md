<p align="center">
  <h1 align="center">Fengyun Nexus</h1>
  <p align="center">可扩展的 AI 对话与自动化枢纽</p>
</p>

<p align="center">
  <img alt="license" src="https://img.shields.io/badge/License-MIT-c4842f?style=flat-square" />
  <img alt="product" src="https://img.shields.io/badge/Product-Fengyun%20Nexus-8fad7a?style=flat-square" />
  <img alt="env" src="https://img.shields.io/badge/Desktop%20%7C%20Server%20%7C%20Mobile%20%7C%20Termux-1a1f18?style=flat-square" />
</p>

<p align="center">
  <a href="https://gitcode.com/fengyunnb_admin/Fengyun-Nexus">GitCode</a>
  ·
  <a href="docs/product/README.md">产品介绍</a>
  ·
  <a href="docs/product/start.md">开始使用</a>
  ·
  <a href="LICENSE">MIT</a>
</p>

---

## 这是什么

**Fengyun Nexus** 是一套独立的对话与自动化产品：把框架内对话、消息通道、插件能力、工作流和管理控制台收进同一体验。

- 产品名固定为英文 **Fengyun Nexus**
- 控制台默认中文，可切换 English
- 适合电脑、服务器、手机浏览器与 Termux

## 你能做什么

- 在统一控制台里对话、看状态、管配置
- 接入消息通道（含 QQ / OneBot 11）
- 装载与管理插件（通道插件 / 框架插件分层）
- 配置多种 AI 供应商，按需切换
- 查看数据看板与最新消息
- 用 `#` 指令做基础管理（如帮助、开关机）

本地配置留在你自己的机器上，不会被上传。

## 快速开始

**必备：** Node.js ≥ 20、pnpm、Git。详见 [环境要求](docs/product/environment.md)。

```bash
git clone https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git
cd Fengyun-Nexus
```

- Windows：`start.bat`
- Linux / macOS：`chmod +x boot.sh && ./boot.sh`
- Termux：

```bash
pkg install git -y
git clone --depth 1 https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git ~/Fengyun-Nexus
cd ~/Fengyun-Nexus
bash scripts/termux-setup.sh
```

目录已存在但报 `No such file` / 旧残缺仓，先拉齐再装（不问一堆题）：

```bash
cd ~/Fengyun-Nexus
git fetch --depth 1 origin main
git reset --hard origin/main
bash scripts/termux-setup.sh
```

也可：`bash termux-install.sh`  
完整已装时脚本只问一次：`1` 重装环境 / `2` 重装框架。不要用 GitCode `raw` 的 `curl | bash`。

若提示 `Unable to read current working directory`（在仓内删掉自己导致），先离开目录再装：

```bash
cd ~
rm -rf ~/Fengyun-Nexus
git clone --depth 1 https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git ~/Fengyun-Nexus
bash ~/Fengyun-Nexus/scripts/termux-setup.sh
```

浏览器打开：**http://127.0.0.1:8787/**  
初始账号：`console` / `console`（首次登录后请改成自己的账号密码）

## 文档

对外只放**介绍与上手**：

- [产品介绍](docs/product/README.md)
- [环境要求](docs/product/environment.md)
- [开始使用](docs/product/start.md)
- [插件生态简介](docs/ecosystem/plugins.md)

## 开源协议

MIT License — 见 [LICENSE](LICENSE)。  
Copyright (c) 2026 Fengyun
