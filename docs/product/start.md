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

### Termux（Android）

GitCode 的 `raw` 链接常返回网页，**不要**再用 `curl …/raw/… | bash`。

手机端**只保留一个脚本** `scripts/termux-setup.sh`（根目录 `termux-install.sh` 同入口）：

- 未安装 / 残缺目录：不问，自动修环境 + 拉齐框架 + 启动
- 完整已装：只问一次「1 重装环境 / 2 重装框架」

```bash
pkg install git -y
git clone --depth 1 https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git ~/Fengyun-Nexus
cd ~/Fengyun-Nexus
bash scripts/termux-setup.sh
```

旧目录已在但缺脚本：

```bash
cd ~/Fengyun-Nexus
git fetch --depth 1 origin main
git reset --hard origin/main
bash scripts/termux-setup.sh
```

**说明：** Termux 请用 `pnpm@9`；仓库 `.npmrc` 已关闭原生二进制切换。不要 `curl …/raw/… | bash`。

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
