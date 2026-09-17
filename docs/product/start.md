# 各平台启动

中文 | [English](start.en.md)

**只有一个控制台：** 启动后打开 http://127.0.0.1:8787/  
左侧可展开：对话 · 适配器 · 配置 · 管理。本地配置不会上传。

## 远程拉取 + 一键部署

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
chmod +x boot.sh && ./boot.sh
```

### Termux

```bash
pkg update && pkg install nodejs git
npm install -g pnpm
git clone https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git
cd Fengyun-Nexus
chmod +x boot.sh && ./boot.sh
```

已有仓库时：`pnpm boot` 或双击 `start.bat` / 执行 `./boot.sh`。

## 常用指令（不用改文件）

```bash
pnpm nexus setup
pnpm nexus env desktop|mobile|server|termux
pnpm nexus status
pnpm nexus boot
```

## 初始账号

`console` / `console` — 首次请在控制台「管理」或 `pnpm nexus setup` 改掉。  
刷新掉登录态；12 小时过期；改密踢全部会话。
