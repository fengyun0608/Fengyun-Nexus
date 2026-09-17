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
  <a href="docs/product/how-it-works.md">如何运作</a>
  ·
  <a href="docs/product/environment.md">环境要求</a>
  ·
  <a href="LICENSE">MIT</a>
</p>

---

## 产品简介

**Fengyun Nexus** 提供唯一控制台：对话、适配器状态、配置与管理都在同一网页里完成。  
支持电脑、服务器、手机浏览器与 Termux，本地配置不会上传。

框架名称固定为英文 **Fengyun Nexus**；控制台默认中文，可在「系统设置 → 配置」切换 English。

插件放在 `plugins/`（推荐 `z.*` id），支持目录扫描、`NexusEvent`（`e`）、数据库与可插拔适配器。

## 一键部署

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

### 手机 Termux（推荐远程脚本）

**只装环境（可反复跑，逐步 Y/n）：**

```bash
curl -fsSL https://gitcode.com/fengyunnb_admin/Fengyun-Nexus/raw/main/scripts/termux-env.sh | bash
```

**环境 + 克隆 + 启动（逐步 Y/n）：**

```bash
curl -fsSL https://gitcode.com/fengyunnb_admin/Fengyun-Nexus/raw/main/scripts/termux-setup.sh | bash
```

少提问（默认全选 Y）：

```bash
curl -fsSL https://gitcode.com/fengyunnb_admin/Fengyun-Nexus/raw/main/scripts/termux-setup.sh | NEXUS_INSTALL_YES=1 bash
```

> Android 没有 `@pnpm/exe` 原生包。请用 `pnpm@9`，仓库已带 `.npmrc` 关闭版本切换。  
> 若仍报 `ERR_PNPM_PNPM_ENGINE_NO_NATIVE_BINARY`：`npm i -g pnpm@9.15.0` 后重跑 `./boot.sh`。

启动时会自动检测依赖、编译包与 Vite 控制台，然后拉起网关。

浏览器只打开：

**http://127.0.0.1:8787/**

## 初次使用

| 项 | 说明 |
|----|------|
| 初始账号 | `console` / `console` |
| 正式用户名 | 4–8 位英文字母 |
| 正式密码 | 至少 4 位，须含大小写、数字、特殊字符 |
| 改密 | 控制台「管理」或 `pnpm nexus setup` |
| 会话 | 刷新保持登录；12 小时过期；改密后全部失效 |
| 语言 | 默认中文；「配置」里可切 English（产品名始终 Fengyun Nexus） |

```bash
pnpm nexus setup
pnpm nexus env desktop|mobile|server|termux
pnpm nexus status
pnpm nexus boot
```

## 能力一览

- 框架内对话（Vite React 控制台）
- 可插拔消息通道（内置 OneBot 11 / NapCat）
- 插件目录扫描与加载提示（`z.*`）
- 嵌入式数据库（`data/nexus.db.json`）
- 工作流（memory / tool / branch / delay）
- 管理与配置（同一控制台）
- AI 供应商配置；未配置时不自动回复（无本地回声）

## 文档

- [如何运作](docs/product/how-it-works.md)
- [环境要求](docs/product/environment.md)
- [各平台启动](docs/product/start.md)
- [规划](docs/product/README.md)
- [通道插件写法基准](docs/ecosystem/channel-plugins.md)

文档页可用 **中文 | English** 切换。

## 开源协议

MIT License — 见 [LICENSE](LICENSE)。  
Copyright (c) 2026 Fengyun
