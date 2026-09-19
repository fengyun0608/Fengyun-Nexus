# Start on each platform

[中文](start.md) | English

Console: http://127.0.0.1:8787/  
Default login: `console` / `console` (change after first login)

## Install

Pick the mirror for where the machine is. Prefer the one-liner; shallow clone also works.

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

**Shallow clone**

```bash
git clone --depth=1 https://github.com/fengyun0608/Fengyun-Nexus.git
cd Fengyun-Nexus && ./boot.sh   # Windows: start.bat
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

See also: [Environment](environment.en.md) · [Docs hub](../README.md)
