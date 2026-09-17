# 环境要求与安装说明

[English →](environment.en.md)

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

```bash
# 1. 进入仓库
cd Fengyun-Nexus

# 2. 安装依赖
pnpm install

# 3. 编译内部包（首次或改 packages 后需要）
pnpm run build:packages

# 4. 开两个终端
pnpm dev          # 网关，默认 http://127.0.0.1:8787
pnpm dev:web      # 控制台，默认 http://127.0.0.1:5173
```

浏览器打开 `http://127.0.0.1:5173`：

- **对话**：可直接用  
- **管理**：初始 `console` / `console`，首次登录后必须改用户名密码并重新登录  

更完整启动与安全规则见：[如何运作](how-it-works.md)。

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
| `NEXUS_ENV` | 否 | `mobile` / `desktop` / `server`，默认 `desktop` |
| `NEXUS_ADMIN_PASSWORD` | 否 | 覆盖管理密码（调试用；正常请在控制台改） |
| `NEXUS_REGISTRY_TOKEN` | 否 | 远程插件仓通行证 |
| `NEXUS_LLM_API_KEY` | 否 | 模型密钥；不配则本地回声回复 |
| `NEXUS_LLM_BASE_URL` | 否 | 兼容 OpenAI 的接口根地址 |
| `NEXUS_LLM_MODEL` | 否 | 模型名 |
| `HOST` / `PORT` | 否 | 覆盖网关监听地址与端口 |

凭据落盘文件（本地，勿提交）：`configs/admin.local.json`、`configs/registry.local.json`。

---

## 可选环境（增强能力，不是启动必需）

| 软件 | 何时需要 | 用途 |
|------|----------|------|
| **Go** | 要跑 / 编译 `workers/go-pump` | 高并发消息泵等辅助运行时 |
| **Python 3.10+** | 要跑 `workers/python-tools`（UIA 等） | 本地自动化、验收脚本 |
| **模型服务账号** | 要真实大模型对话 | 配置 `NEXUS_LLM_*` |
| **GitCode 通行证** | 要远程装示例/基础/标准插件 | `NEXUS_REGISTRY_TOKEN` |

未安装 Go / Python 时：**主框架（网关 + Web + 管理 + 对话）仍可正常使用**。

### 可选：检查 Go / Python

```bash
go version          # 可选
python --version    # 可选，建议 3.10+
```

---

## 系统与网络建议

| 项目 | 建议 |
|------|------|
| 操作系统 | Windows 10/11、macOS、常见 Linux 均可 |
| 磁盘 | 预留约 500MB+（依赖与构建产物） |
| 端口 | 本机 `8787`（网关）、`5173`（Web 开发服）勿被占用 |
| 出网 | 首次 `pnpm install` 需访问 npm 源；接模型/远程插件时需对应网络 |

---

## 常见问题

**`pnpm` 找不到**  
先装 Node 20+，再用 Corepack 或 `npm i -g pnpm`。

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

- [如何运作](how-it-works.md) · [English](how-it-works.en.md)  
- [产品文档首页](README.md)  
- [插件生态](../ecosystem/plugins.md)  
