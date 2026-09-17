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

GitCode `/raw/` URLs often return HTML — **do not** `curl …/raw/… | bash`.

One script only: `scripts/termux-setup.sh`

- Not installed: no prompts — env + framework + boot
- Already installed: only ask reinstall env or reinstall framework

```bash
pkg install git -y
git clone --depth 1 https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git ~/Fengyun-Nexus
cd ~/Fengyun-Nexus
bash scripts/termux-setup.sh
```

Use `pnpm@9` on Termux (no `@pnpm/exe` for android-arm64).

## Bootstrap login

- First login: `console` / `console`
- Then set a permanent username/password in the console
