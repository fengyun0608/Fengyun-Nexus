# How to start on each platform

[← 中文](start.md)

Local secrets stay in `.env` / `configs/*.local.json` and are **never uploaded**.

| Platform | Start |
|----------|-------|
| **Windows** | Double-click `启动.bat` or `pnpm boot` |
| **Linux / macOS** | `./boot.sh` or `pnpm boot` |
| **Termux** | `./boot.sh` (auto lite mode) |

Open the URL printed (usually `http://127.0.0.1:8787/`).

## Configure by commands (no file editing)

```bash
pnpm nexus setup
pnpm nexus env desktop|mobile|server|termux
pnpm nexus set llm-key sk-xxx
pnpm nexus status
pnpm nexus boot
```

## Termux

```bash
pkg update && pkg install nodejs git
npm install -g pnpm
chmod +x boot.sh && ./boot.sh
```

Bootstrap login: `console` / `console` — then `pnpm nexus setup`.
