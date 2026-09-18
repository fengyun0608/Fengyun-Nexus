# Start on each platform

中文 | [English](start.en.md)

Console: http://127.0.0.1:8787/  
Default login: `console` / `console`

## Install

Pick the mirror for where the machine is. The script also asks once.

**China**

```bash
curl -fsSL "https://api.gitcode.com/api/v5/repos/fengyunnb_admin/Fengyun-Nexus/raw/scripts/get.sh?ref=main" | bash
```

```powershell
irm "https://api.gitcode.com/api/v5/repos/fengyunnb_admin/Fengyun-Nexus/raw/scripts/get.ps1?ref=main" | iex
```

**International**

```bash
curl -fsSL "https://raw.githubusercontent.com/fengyun0608/Fengyun-Nexus/main/scripts/get.sh" | bash
```

```powershell
irm "https://raw.githubusercontent.com/fengyun0608/Fengyun-Nexus/main/scripts/get.ps1" | iex
```

| Variable | Meaning |
|----------|---------|
| `NEXUS_MIRROR=cn\|global` | Mirror |
| `NEXUS_REINSTALL=1` | Reinstall runtime + dir |
| `NEXUS_SKIP_BOOT=1` | Install only |
| `NEXUS_ENV=…` | desktop / server / termux |
| `NEXUS_INSTALL_DIR=…` | Install path |

## Already installed

```bash
cd ~/Fengyun-Nexus && ./boot.sh
```

Windows: double-click `start.bat`.
