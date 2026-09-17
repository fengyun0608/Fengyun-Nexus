# Start on each platform

[中文](start.md) | English

**One console only:** open http://127.0.0.1:8787/ after boot. Local configs are never uploaded.

## Deploy from remote

### Windows

```bat
git clone https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git
cd Fengyun-Nexus
start.bat
```

### Linux / macOS / server

```bash
git clone https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git
cd Fengyun-Nexus
chmod +x boot.sh && ./boot.sh
```

### Termux (Android)

One script: `scripts/termux-setup.sh` (alias `termux-install.sh`).

- Missing / broken tree: no prompts — repair env + sync + boot
- Healthy install: ask once — `1` reinstall env / `2` reinstall framework

```bash
pkg install git -y
git clone --depth 1 https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git ~/Fengyun-Nexus
cd ~/Fengyun-Nexus
bash scripts/termux-setup.sh
```

If the folder already exists but the script is missing:

```bash
cd ~/Fengyun-Nexus
git fetch --depth 1 origin main
git reset --hard origin/main
bash scripts/termux-setup.sh
```

Do **not** `curl` GitCode `/raw/` URLs. Use `pnpm@9` on Termux.

## Bootstrap login

- First login: `console` / `console`
- Then set a permanent username/password in the console
