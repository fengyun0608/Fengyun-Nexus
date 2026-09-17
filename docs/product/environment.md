# 环境要求与安装说明

中文 | [English](environment.en.md)

本文说明跑 Fengyun Nexus **需要装什么**、**可选装什么**、以及怎么验证。

---

## 必备环境（跑起来对话 + 管理端）

| 软件 | 版本要求 | 用途 | 安装参考 |
|------|----------|------|----------|
| **Node.js** | **≥ 20**（建议 20 LTS 或 22 LTS） | 运行网关、Web、CLI、插件宿主 | [nodejs.org](https://nodejs.org/) |
| **pnpm** | **≥ 9**（仓库声明 9.15；10.x 一般可用） | 安装依赖与 monorepo 脚本 | 见下方 |
| **Git** | 任意较新版本 | 克隆 / 推送仓库 | [git-scm.com](https://git-scm.com/) |
| **现代浏览器** | Chrome / Edge / Firefox 等 | 打开 Web 控制台 | 系统自带即可 |

### 安装 pnpm（任选一种）

```bash
# 推荐：Corepack（随 Node 20+）
corepack enable
corepack prepare pnpm@9.15.0 --activate

# 或：npm 全局安装
npm install -g pnpm@9
```

### 验证必备环境

```bash
node -v          # 应 ≥ v20
pnpm -v          # 应 ≥ 9
git --version
```

---

## 首次把项目跑起来

远程拉取后一键启动（详见 [各平台启动](start.md)）：

```bash
git clone https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git
cd Fengyun-Nexus
# Windows: start.bat
# Linux / macOS / Termux:
chmod +x boot.sh && ./boot.sh
```

或：`pnpm boot`

浏览器只打开：**http://127.0.0.1:8787/**（唯一控制台）。

### 你的本地配置不会上传

- `.env` / `.env.*`
- `configs/*.local.json`
- `data/`

---

## 运行姿态（三环境，不是「再装三套系统」）

用环境变量切换产品姿态，**不需要**额外安装三套软件：

| `NEXUS_ENV` | 含义 | 典型场景 |
|-------------|------|----------|
| `desktop` | 电脑端（默认） | 本机开发、本机控制台 |
| `mobile` | 手机端姿态 | 窄屏 / 触控优先的 Web |
| `server` | 服务器 | 机房 / 云主机部署网关 |

**Windows（PowerShell / CMD）：**

```bash
set NEXUS_ENV=desktop
pnpm dev
```

**Linux / macOS：**

```bash
export NEXUS_ENV=server
pnpm dev
```

对应配置文件：`configs/env.desktop.json` / `env.mobile.json` / `env.server.json`。

---

## 环境变量一览（可选）

可参考根目录 `.env.example`（勿把真实密钥提交进仓库）。

| 变量 | 是否必须 | 说明 |
|------|----------|------|
| `NEXUS_ENV` | 否 | `mobile` / `desktop` / `server` / `termux` |
| `NEXUS_ADMIN_PASSWORD` | 否 | 调试用密码覆盖（正常请在控制台改） |
| `NEXUS_LLM_API_KEY` | 否 | 模型密钥；不配则本地回声 |
| `NEXUS_LLM_BASE_URL` | 否 | 兼容接口根地址 |
| `NEXUS_LLM_MODEL` | 否 | 模型名 |
| `HOST` / `PORT` | 否 | 网关监听 |

本地凭据文件已忽略，勿提交。

---

## 可选环境（增强能力，不是启动必需）

| 软件 | 何时需要 | 用途 |
|------|----------|------|
| **Go** | 要跑 / 编译辅助并发 worker | 高并发消息泵等 |
| **Python 3.10+** | 要跑本地自动化脚本 | UIA / 验收 |
| **模型服务账号** | 要真实大模型对话 | `pnpm nexus set llm-key …` |

未安装 Go / Python 时，主控制台仍可正常使用。

### 可选：检查 Go / Python

```bash
go version          # 可选
python --version    # 可选，建议 3.10+
```

---

## 系统与网络建议

| 项目 | 建议 |
|------|------|
| 操作系统 | Windows 10/11、macOS、常见 Linux、**Android Termux** |
| 磁盘 | 预留约 500MB+（依赖与构建产物） |
| 端口 | 本机 `8787`（唯一控制台）勿被占用 |
| 出网 | 首次 `pnpm install` 需访问 npm 源；接模型/远程插件时需对应网络 |

Termux 专用步骤见 [各平台启动](start.md)。

---

## 常见问题

**`ERR_PNPM_PNPM_ENGINE_NO_NATIVE_BINARY` / android-arm64**  
Termux 没有 pnpm 原生二进制。请：

```bash
npm install -g pnpm@9.15.0
# 仓库根目录应有 .npmrc：manage-package-manager-versions=false
./boot.sh
```

或在仓库内重跑：`bash scripts/termux-setup.sh` 选「重装环境」  
（不要 curl GitCode `/raw/`，会下到 HTML。）

**网关起不来 / 端口占用**  
换端口：`set PORT=8788` 后重启；或结束占用 8787 的进程。

**改了 `packages/*` 后报模块找不到**  
再执行一次：`pnpm run build:packages`。

**管理端登录后一刷新就掉线**  
这是设计行为：登录态只在内存，刷新即失效；有效期 12 小时。

**不想用初始 console 账号**  
首次登录后在控制台重配；或已生成 `configs/admin.local.json` 后用新账号登录。

---

## 相关文档

- [产品介绍](README.md)
- [各平台启动](start.md)
- [插件生态简介](../ecosystem/plugins.md)
