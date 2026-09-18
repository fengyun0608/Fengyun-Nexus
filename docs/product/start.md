# 各平台启动

中文 | [English](start.en.md)

控制台：http://127.0.0.1:8787/  
首次账号：`console` / `console`（登录后请改掉）

## 安装

机器在哪就选哪边。脚本里也会再问一次。

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

| 变量 | 作用 |
|------|------|
| `NEXUS_MIRROR=cn\|global` | 指定源 |
| `NEXUS_REINSTALL=1` | 重装环境与目录 |
| `NEXUS_SKIP_BOOT=1` | 只装不启 |
| `NEXUS_ENV=…` | desktop / server / termux |
| `NEXUS_INSTALL_DIR=…` | 安装目录 |

## 日常启动

```bash
cd ~/Fengyun-Nexus && ./boot.sh
```

Windows：目录里双击 `start.bat`。

```bash
pnpm nexus setup
pnpm nexus env desktop|mobile|server|termux
pnpm nexus status
pnpm nexus boot
```
