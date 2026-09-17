# 各平台怎么启动（尽量只敲指令）

[English →](start.en.md)

你的密码、Token 等会写到本机 `.env` / `configs/*.local.json`，**不会上传**。

## 一句话对照

| 平台 | 怎么启动 |
|------|----------|
| **Windows 电脑** | 双击 `start.bat`（推荐，避免中文乱码），或 `启动.bat`，或 `pnpm boot` |
| **Linux / macOS 服务器** | `chmod +x boot.sh && ./boot.sh`，或 `pnpm boot` |
| **手机 Termux** | 见下方 Termux；`./boot.sh`（自动精简模式） |

浏览器打开提示里的地址（一般是 `http://127.0.0.1:8787/` 内置控制台）。  
电脑完整模式还会有 `http://127.0.0.1:5173`。

---

## 不想改文件？用指令配置

```bash
pnpm nexus setup                 # 交互设置管理用户名/密码
pnpm nexus env desktop           # 电脑
pnpm nexus env mobile            # 手机 Web 姿态
pnpm nexus env server            # 服务器
pnpm nexus env termux            # Termux
pnpm nexus set llm-key sk-xxx    # 模型密钥
pnpm nexus set registry-token xx # 远程插件通行证
pnpm nexus status                # 查看（密钥打码）
pnpm nexus boot                  # 启动
pnpm nexus boot lite             # 只开网关（省资源）
pnpm nexus boot full             # 网关 + 开发界面
```

---

## Termux（手机）

```bash
pkg update
pkg install nodejs git
npm install -g pnpm
cd ~/Fengyun-Nexus    # 或你的仓库路径
chmod +x boot.sh
./boot.sh
```

自动识别 Termux → 姿态 `termux`、精简启动（只开网关）。  
用手机浏览器打开：`http://127.0.0.1:8787/`

可选：

```bash
pnpm nexus env termux
pnpm nexus setup
pnpm nexus boot
```

---

## 电脑 / 服务器

**Windows：** `启动.bat` 或 `pnpm boot`  

**Linux/macOS：**

```bash
chmod +x boot.sh
./boot.sh
# 服务器建议：
pnpm nexus env server
pnpm nexus boot lite
```

---

## 初始账号

- 用户名 / 密码：`console` / `console`
- 首次登录后请 `pnpm nexus setup` 或在网页管理页改掉，再重新登录
