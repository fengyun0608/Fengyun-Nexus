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

- 首次：`console` / `console`（独立登录页）
- 正式用户名：4–8 位英文字母
- 正式密码：至少 4 位，须含大小写、数字、特殊字符
- 未登录不显示控制台侧栏；左上角三条横杠展开/收起目录；可退出登录
