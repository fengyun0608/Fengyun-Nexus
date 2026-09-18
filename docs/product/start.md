# 各平台启动

中文 | [English](start.en.md)

启动后打开 http://127.0.0.1:8787/  
对话、通道、插件、配置都在这个控制台里。本机 `*.local.json` 不会进仓库。

## 快速开始（推荐）

一条命令：自动检测环境、装 Git / Node 20+ / pnpm、拉齐仓库并启动。  
每次从远程拉最新安装逻辑。

**只分国内 / 国外两套源。** 看「这台服务器 / 手机 / 电脑」在哪，就选哪边：

| 机器所在地 | 用哪个站 | 说明 |
|------------|----------|------|
| 国内 | [GitCode](https://gitcode.com/fengyunnb_admin/Fengyun-Nexus) | 国内网络更稳 |
| 国外 | [GitHub](https://github.com/fengyun0608/Fengyun-Nexus) | 海外开源站 |

安装脚本也会弹出选项；也可直接设 `NEXUS_MIRROR=cn` 或 `NEXUS_MIRROR=global`。选过的会记在安装目录 `.nexus-mirror`，以后 `#更新` 仍走当时的 origin。

> **地址规律**（和手机端旧引用同一套）：  
> `…/raw/main/`（或 api 的 `…/raw/…?ref=main`）后面跟的就是**仓库里的相对路径**。  
> 例：`…/scripts/get.sh` → 文件在 `scripts/get.sh`。  
> 国内网页 `gitcode.com/.../raw/...` 会下到 HTML；请用下面 api 地址。

### 国内 · Linux / macOS / Termux

```bash
curl -fsSL "https://api.gitcode.com/api/v5/repos/fengyunnb_admin/Fengyun-Nexus/raw/scripts/get.sh?ref=main" | bash
```

### 国内 · Windows（PowerShell）

```powershell
irm "https://api.gitcode.com/api/v5/repos/fengyunnb_admin/Fengyun-Nexus/raw/scripts/get.ps1?ref=main" | iex
```

### 国外 · Linux / macOS / Termux

```bash
curl -fsSL "https://raw.githubusercontent.com/fengyun0608/Fengyun-Nexus/main/scripts/get.sh" | bash
```

### 国外 · Windows（PowerShell）

```powershell
irm "https://raw.githubusercontent.com/fengyun0608/Fengyun-Nexus/main/scripts/get.ps1" | iex
```

### 常用开关

| 变量 | 作用 |
|------|------|
| `NEXUS_MIRROR=cn\|global` | 国内 GitCode / 国外 GitHub（也可写 china / github） |
| `NEXUS_REINSTALL=1` | 重装运行环境，并清空后重装框架目录 |
| `NEXUS_REINSTALL_ENV=1` | 只重装 Node / pnpm，不动项目目录 |
| `NEXUS_SKIP_BOOT=1` | 只装不启 |
| `NEXUS_ENV=desktop\|server\|termux` | 指定姿态（不设则自动检测） |
| `NEXUS_INSTALL_DIR=…` | 自定义安装目录（默认 `~/Fengyun-Nexus`） |

示例：

```bash
NEXUS_REINSTALL=1 curl -fsSL "https://api.gitcode.com/api/v5/repos/fengyunnb_admin/Fengyun-Nexus/raw/scripts/get.sh?ref=main" | bash
NEXUS_MIRROR=global curl -fsSL "https://raw.githubusercontent.com/fengyun0608/Fengyun-Nexus/main/scripts/get.sh" | bash
NEXUS_SKIP_BOOT=1 curl -fsSL "https://api.gitcode.com/api/v5/repos/fengyunnb_admin/Fengyun-Nexus/raw/scripts/get.sh?ref=main" | bash
```

```powershell
$env:NEXUS_REINSTALL="1"; irm "https://api.gitcode.com/api/v5/repos/fengyunnb_admin/Fengyun-Nexus/raw/scripts/get.ps1?ref=main" | iex
$env:NEXUS_MIRROR="global"; irm "https://raw.githubusercontent.com/fengyun0608/Fengyun-Nexus/main/scripts/get.ps1" | iex
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
