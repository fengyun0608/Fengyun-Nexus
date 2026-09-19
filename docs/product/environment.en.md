# Environment & Installation

[中文](environment.md) | English

**Required:** Node.js ≥ 20, pnpm ≥ 9, Git, a modern browser.  
**Platforms:** Windows / Linux / macOS / Termux.

## Deploy

```bash
git clone --depth=1 https://github.com/fengyun0608/Fengyun-Nexus.git
cd Fengyun-Nexus
# Windows: start.bat
chmod +x boot.sh && ./boot.sh
```

Open **only** http://127.0.0.1:8787/

Local secrets (`.env`, `configs/*.local.json`, `data/`) stay on the machine.

Postures: `NEXUS_ENV=desktop|mobile|server|termux`.

Optional: browser runtime for menu/status shots; NapCat for QQ — install from the console Environment page.

See [Start](start.en.md) · [Docs hub](../README.md)
