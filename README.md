<p align="center">
  <h1 align="center">Fengyun Nexus</h1>
  <p align="center"><strong>风云枢纽</strong> — 可扩展的 AI 对话与自动化枢纽</p>
</p>

<p align="center">
  <img alt="license" src="https://img.shields.io/badge/License-MIT-c4842f?style=flat-square" />
  <img alt="product" src="https://img.shields.io/badge/Product-Fengyun%20Nexus-8fad7a?style=flat-square" />
  <img alt="env" src="https://img.shields.io/badge/Env-Mobile%20%7C%20Desktop%20%7C%20Server-1a1f18?style=flat-square" />
</p>

<p align="center">
  <a href="https://gitcode.com/fengyunnb_admin/Fengyun-Nexus">GitCode 仓库</a>
  ·
  <a href="docs/product/README.md">产品文档</a>
  ·
  <a href="docs/ecosystem/plugins.md">插件生态</a>
  ·
  <a href="LICENSE">开源协议</a>
</p>

---

## 一句话

**Fengyun Nexus（风云枢纽）** 把「框架内对话、消息通道、工作流、插件生态」收进同一套独立产品：手机端、电脑端、服务器三环境可用，管理端有独立密码，示例 / 基础 / 标准插件走开源平台远程仓安装与更新。

> 运作说明（主中文）：[docs/product/how-it-works.md](docs/product/how-it-works.md) · [English](docs/product/how-it-works.en.md)  
> 环境安装（主中文）：[docs/product/environment.md](docs/product/environment.md) · [English](docs/product/environment.en.md)

## 环境要求（摘要）

**必备：** Node.js ≥ 20、pnpm ≥ 9、Git、现代浏览器。  
**可选：** Go（并发 worker）、Python 3.10+（UIA）、模型密钥、远程插件 Token。  

完整清单、安装命令与验证步骤见 [环境要求与安装说明](docs/product/environment.md)。

## 你能做什么

- **框架内对话**：浏览器里直接聊，会话与插件共用同一大脑
- **消息通道**：统一接入模型，Web / Webhook 起步，后续通道可插拔
- **管理端**：管理员登录、概览、修改管理密码
- **三环境**：`mobile` / `desktop` / `server`，一套产品三种部署姿态
- **插件生态**：远程源挂载示例、基础、标准插件（地址见仓库配置）
- **工作流与工具桥**：把对话、插件、通道串起来，并对外暴露工具能力

## 启动方法（越简单越好）

**方式 A（推荐，Windows）**  
双击仓库根目录的 `启动.bat`。

**方式 B（一条命令）**

```bash
cd Fengyun-Nexus
pnpm boot
```

首次会自动 `install` + 编译内部包，然后同时拉起网关和控制台。  
浏览器打开：**http://127.0.0.1:5173**

管理端初始：`console` / `console`（首次登录后必须改用户名密码并重新登录）。  
刷新页面登录态会失效；会话 12 小时；改密后全部会话失效。

> 你的本地配置（密码、Token、`.env`、`*.local.json`）**不会上传到 GitCode**，已写入 `.gitignore`。

切换姿态（可选）：

```bash
set NEXUS_ENV=mobile
pnpm boot
```

## 远程插件源

当前远程仓指向：[Fengyun-Nexus on GitCode](https://gitcode.com/fengyunnb_admin/Fengyun-Nexus)

- 配置：`configs/registry.json`
- 本地覆盖（勿提交密钥）：`configs/registry.local.json`
- 通行证环境变量：`NEXUS_REGISTRY_TOKEN`

示例 / 基础 / 标准插件分类已预留，凭证就绪后即可远程安装与更新。

## 产品架构（规划）

详见：

- [产品规划总图](docs/product/planning.md)
- [能力鱼骨图](docs/product/fishbone.md)
- [目录鱼骨](docs/product/directory.md)

## 开源协议

本项目以 **MIT License** 开源。详见 [LICENSE](LICENSE)。

Copyright (c) 2026 风云科技 / Fengyun

在遵守 MIT 的前提下，你可以自由使用、修改、分发本软件。

## 仓库边界

本目录为独立产品仓库。工作区内其它项目与本仓库无关，请勿混改。
