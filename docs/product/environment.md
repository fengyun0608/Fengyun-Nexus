# 环境要求与安装说明

中文 | [English](environment.en.md)

跑 Fengyun Nexus **需要装什么**、**可选装什么**、以及怎么验证。

---

## 必备环境

| 软件 | 版本要求 | 用途 |
|------|----------|------|
| **Node.js** | **≥ 20**（建议 20 / 22 LTS） | 网关、Web、CLI、插件宿主 |
| **pnpm** | **≥ 9**（仓库声明 9.15） | monorepo 依赖 |
| **Git** | 较新即可 | 克隆 / `#更新` |
| **现代浏览器** | Chrome / Edge / Firefox 等 | 控制台；菜单/状态截图需另装浏览器运行时 |

### 安装 pnpm

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
# 或
npm install -g pnpm@9
```

### 验证

```bash
node -v          # ≥ v20
pnpm -v          # ≥ 9
git --version
```

---

## 首次跑起来

见 [各平台启动](start.md)。推荐远程一键装；或：

```bash
git clone --depth=1 https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git
cd Fengyun-Nexus
# Windows: start.bat
chmod +x boot.sh && ./boot.sh
```

浏览器只打开：**http://127.0.0.1:8787/**

本机不上传：`.env` / `configs/*.local.json` / `data/`

---

## 运行姿态

| `NEXUS_ENV` | 含义 |
|-------------|------|
| `desktop` | 电脑端（默认） |
| `mobile` | 窄屏 / 触控 |
| `server` | 服务器（不展示本机 IP；可自动放行网关端口） |
| `termux` | Android Termux |

配置：`configs/env.*.json`。

---

## 环境变量（可选）

可参考 `.env.example`（勿提交真实密钥）。

| 变量 | 说明 |
|------|------|
| `NEXUS_ENV` | 姿态 |
| `HOST` / `PORT` | 网关监听，默认 `0.0.0.0:8787` |
| `NEXUS_OPEN_PORT=0` | 关掉 server 姿态自动放行端口 |
| `NEXUS_BOOT_FAST=1` | 启动日志不等待节奏 |

模型密钥请在控制台 AI 页配置，不要写进公开文档。

---

## 可选增强

| 软件 | 何时需要 |
|------|----------|
| 浏览器运行时 | `#菜单` `#状态` 出图（控制台「环境配置」安装） |
| NapCat | QQ 通道（环境配置单独点装，不进批量排队） |
| Go / Python | 辅助 worker / 本地自动化（非启动必需） |

---

## 常见问题

**Termux pnpm 原生二进制缺失**  
`npm install -g pnpm@9.15.0`，确认 `.npmrc` 有 `manage-package-manager-versions=false`，再 `./boot.sh`。

**端口占用**  
`set PORT=8788` 后重启，或结束占用 8787 的进程。

**改了 `packages/*` 模块找不到**  
`pnpm run build:packages`。

**登录刷新掉线**  
会话在内存；刷新需重新登录。

---

## 相关

- [产品介绍](README.md)
- [各平台启动](start.md)
- [文档中心](../README.md)
