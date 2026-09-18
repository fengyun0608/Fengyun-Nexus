# Start on each platform

中文 | [English](start.en.md)

Open http://127.0.0.1:8787/ after boot.  
Local `*.local.json` files stay on your machine.

## Quick start (recommended)

One command: detect OS, install Git / Node 20+ / pnpm, sync the repo, then boot.  
The installer is always fetched from `main` — no stale local install script.

### Linux / macOS / Termux

```bash
curl -fsSL https://gitcode.com/fengyunnb_admin/Fengyun-Nexus/raw/main/scripts/get.sh | bash
```

### Windows (PowerShell)

```powershell
irm https://gitcode.com/fengyunnb_admin/Fengyun-Nexus/raw/main/scripts/get.ps1 | iex
```

### Flags

| Variable | Meaning |
|----------|---------|
| `NEXUS_REINSTALL=1` | Reinstall runtime and wipe/reclone the install dir |
| `NEXUS_REINSTALL_ENV=1` | Reinstall Node / pnpm only |
| `NEXUS_SKIP_BOOT=1` | Install only, do not start |
| `NEXUS_ENV=desktop\|server\|termux` | Force posture (auto-detect if unset) |
| `NEXUS_INSTALL_DIR=…` | Custom install path (default `~/Fengyun-Nexus`) |

## Already installed

```bash
cd ~/Fengyun-Nexus && ./boot.sh
```

Windows: double-click `start.bat` in the install folder.

## Commands

```bash
pnpm nexus setup
pnpm nexus env desktop|mobile|server|termux
pnpm nexus status
pnpm nexus boot
```

## Default login

- First run: `console` / `console`
