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

手机端**只保留一个脚本** `termux-install.sh`（自动检测，不问选择题）：

- 未安装 → 装环境 + 克隆 + 启动  
- 残缺 / cwd 失效 → 自动修复或重装  
- 已安装 → 拉齐最新后启动  
- 强制重装：`NEXUS_REINSTALL=1 bash ~/Fengyun-Nexus/termux-install.sh`

```bash
yes | apt update && yes | apt full-upgrade -y
pkg reinstall -y openssl libcurl libssh2 ca-certificates git
git clone --depth 1 https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git ~/Fengyun-Nexus
bash ~/Fengyun-Nexus/termux-install.sh
```

仓已在时直接：

```bash
bash ~/Fengyun-Nexus/termux-install.sh
```

**说明：** Termux 请用 `pnpm@9`；仓库 `.npmrc` 已关闭原生二进制切换。

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
