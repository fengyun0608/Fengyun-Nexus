# 各平台启动

中文 | [English](start.en.md)

控制台：http://127.0.0.1:8787/  
首次账号：`console` / `console`（登录后请改掉）

## 安装

机器在哪就选哪边。脚本里也会再问一次。推荐一键管道；也可浅克隆。

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

**浅克隆（任选镜像）**

```bash
git clone --depth=1 https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git
# 或
git clone --depth=1 https://github.com/fengyun0608/Fengyun-Nexus.git
cd Fengyun-Nexus && ./boot.sh   # Windows 双击 start.bat
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

## 装好后建议

1. 登录控制台改掉默认密码  
2. 需要 QQ：环境配置 → 安装 NapCat → 扫码；看 OneBot 页是否已连接  
3. 需要 AI：AI 页配置供应商密钥  
4. 群里主人发 `#帮助` / `#状态` 试指令  

更多：[环境要求](environment.md) · [文档中心](../README.md)
