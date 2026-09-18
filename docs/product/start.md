# 各平台启动

中文 | [English](start.en.md)

启动后打开 http://127.0.0.1:8787/  
对话、通道、插件、配置都在这个控制台里。本机 `*.local.json` 不会进仓库。

## 一键部署

### Windows

```bat
git clone https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git
cd Fengyun-Nexus
start.bat
```

### Linux 服务器

```bash
git clone --depth 1 https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git ~/Fengyun-Nexus
bash ~/Fengyun-Nexus/server-install.sh
```

仓已在：`bash ~/Fengyun-Nexus/server-install.sh`  
强制重装：`NEXUS_REINSTALL=1 bash ~/Fengyun-Nexus/server-install.sh`  
只装不启：`NEXUS_SKIP_BOOT=1 bash ~/Fengyun-Nexus/server-install.sh`

脚本会自动装 git / Node 20+ / pnpm，拉齐后以 `NEXUS_ENV=server` 启动。

### Linux / macOS（本机已有 Node）

```bash
git clone https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git
cd Fengyun-Nexus
chmod +x boot.sh && ./boot.sh
```

### Termux

```bash
git clone --depth 1 https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git ~/Fengyun-Nexus
bash ~/Fengyun-Nexus/termux-install.sh
```

仓已在：`bash ~/Fengyun-Nexus/termux-install.sh`  
强制重装：`NEXUS_REINSTALL=1 bash ~/Fengyun-Nexus/termux-install.sh`

脚本会自动对齐包、装 Node / pnpm，未装则克隆，已装则拉齐后启动。

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
