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

**One script only:** `termux-install.sh` — auto-detects missing / broken / installed, repairs, syncs, then boots. No menu prompts.

```bash
yes | apt update && yes | apt full-upgrade -y
pkg reinstall -y openssl libcurl libssh2 ca-certificates git
git clone --depth 1 https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git ~/Fengyun-Nexus
bash ~/Fengyun-Nexus/termux-install.sh
```

Already cloned:

```bash
bash ~/Fengyun-Nexus/termux-install.sh
```

Force wipe + reinstall: `cd ~ && NEXUS_REINSTALL=1 bash ~/Fengyun-Nexus/termux-install.sh`

Do **not** `curl` GitCode `/raw/` URLs. Use `pnpm@9` on Termux.

## Bootstrap login

- First login: `console` / `console`
- Then set a permanent username (4–8 letters) and password
