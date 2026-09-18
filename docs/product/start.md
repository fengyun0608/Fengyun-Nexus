# 各平台启动

中文 | [English](start.en.md)

启动后打开 http://127.0.0.1:8787/  
对话、通道、插件、配置都在这个控制台里。本机 `*.local.json` 不会进仓库。

## 快速开始（推荐）

一条命令：自动检测环境、装 Git / Node 20+ / pnpm、拉齐仓库并启动。  
每次从远程拉最新安装逻辑。

> GitCode 网页上的 `/raw/...` 会返回 HTML，**必须**走 `api.gitcode.com` 的 raw 接口。

### Linux / macOS / Termux

```bash
curl -fsSL "https://api.gitcode.com/api/v5/repos/fengyunnb_admin/Fengyun-Nexus/raw/scripts/get.sh?ref=main" | bash
```

### Windows（PowerShell）

```powershell
irm "https://api.gitcode.com/api/v5/repos/fengyunnb_admin/Fengyun-Nexus/raw/scripts/get.ps1?ref=main" | iex
```

### 常用开关

| 变量 | 作用 |
|------|------|
| `NEXUS_REINSTALL=1` | 重装运行环境，并清空后重装框架目录 |
| `NEXUS_REINSTALL_ENV=1` | 只重装 Node / pnpm，不动项目目录 |
| `NEXUS_SKIP_BOOT=1` | 只装不启 |
| `NEXUS_ENV=desktop\|server\|termux` | 指定姿态（不设则自动检测） |
| `NEXUS_INSTALL_DIR=…` | 自定义安装目录（默认 `~/Fengyun-Nexus`） |

示例：

```bash
NEXUS_REINSTALL=1 curl -fsSL "https://api.gitcode.com/api/v5/repos/fengyunnb_admin/Fengyun-Nexus/raw/scripts/get.sh?ref=main" | bash
NEXUS_SKIP_BOOT=1 curl -fsSL "https://api.gitcode.com/api/v5/repos/fengyunnb_admin/Fengyun-Nexus/raw/scripts/get.sh?ref=main" | bash
```

```powershell
$env:NEXUS_REINSTALL="1"; irm "https://api.gitcode.com/api/v5/repos/fengyunnb_admin/Fengyun-Nexus/raw/scripts/get.ps1?ref=main" | iex
```

## 已安装后日常启动

```bash
cd ~/Fengyun-Nexus && ./boot.sh
```

Windows：打开目录双击 `start.bat`，或：

```bat
cd %USERPROFILE%\Fengyun-Nexus
start.bat
```

## 常用指令

```bash
pnpm nexus setup
pnpm nexus env desktop|mobile|server|termux
pnpm nexus status
pnpm nexus boot
```

## 初始账号

- 首次：`console` / `console`
- 正式用户名：4–8 位英文字母
- 正式密码：至少 4 位，须含大小写、数字、特殊字符
