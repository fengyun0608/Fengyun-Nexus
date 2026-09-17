<p align="center">
  <h1 align="center">Fengyun Nexus</h1>
  <p align="center"><strong>风云枢纽</strong> — 可扩展的 AI 对话与自动化枢纽</p>
</p>

<p align="center">
  <img alt="license" src="https://img.shields.io/badge/License-MIT-c4842f?style=flat-square" />
  <img alt="product" src="https://img.shields.io/badge/Product-Fengyun%20Nexus-8fad7a?style=flat-square" />
  <img alt="env" src="https://img.shields.io/badge/Desktop%20%7C%20Server%20%7C%20Mobile%20%7C%20Termux-1a1f18?style=flat-square" />
</p>

<p align="center">
  <a href="https://gitcode.com/fengyunnb_admin/Fengyun-Nexus">GitCode</a>
  ·
  <a href="docs/product/how-it-works.md">如何运作</a>
  ·
  <a href="docs/product/environment.md">环境要求</a>
  ·
  <a href="LICENSE">MIT</a>
</p>

---

## 产品简介

Fengyun Nexus（风云枢纽）提供**唯一控制台**：对话、适配器状态、配置与管理都在同一网页里完成。  
支持电脑、服务器、手机浏览器与 Termux，本地配置不会上传。

## 一键部署（远程拉取）

**必备：** Node.js ≥ 20、pnpm、Git。

### Windows

```bat
git clone https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git
cd Fengyun-Nexus
start.bat
```

### Linux / macOS / 服务器

```bash
git clone https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git
cd Fengyun-Nexus
chmod +x boot.sh
./boot.sh
```

### 手机 Termux

```bash
pkg update && pkg install nodejs git
npm install -g pnpm
git clone https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git
cd Fengyun-Nexus
chmod +x boot.sh
./boot.sh
```

启动成功后，浏览器只打开这一个地址：

**http://127.0.0.1:8787/**

这就是唯一控制台（左侧可展开目录：对话 / 适配器 / 配置 / 管理）。

## 初次使用

| 项 | 说明 |
|----|------|
| 初始账号 | `console` / `console` |
| 正式用户名 | 4–8 位英文字母 |
| 正式密码 | 至少 4 位，须含大小写、数字、特殊字符 |
| 改密 | 登录后「账号」或 `pnpm nexus setup` |
| 会话 | 刷新即失效；12 小时过期；改密后全部失效 |

可选指令（不用手改文件）：

```bash
pnpm nexus setup
pnpm nexus env desktop|mobile|server|termux
pnpm nexus status
pnpm nexus boot
```

## 能力一览

- 框架内对话  
- 消息通道适配与状态  
- 管理与配置（同一控制台）  
- 工作流与工具扩展  
- 插件生态（远程安装与更新，细节不对公开展示）

## 文档

- [如何运作](docs/product/how-it-works.md)
- [环境要求](docs/product/environment.md)
- [各平台启动](docs/product/start.md)
- [规划 / 鱼骨 / 目录](docs/product/README.md)

进入文档页后，用页顶 **中文 | English** 切换语言。

## 开源协议

MIT License — 见 [LICENSE](LICENSE)。  
Copyright (c) 2026 风云科技 / Fengyun
