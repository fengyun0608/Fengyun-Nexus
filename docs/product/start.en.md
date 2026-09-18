# Start on each platform

中文 | [English](start.en.md)

Open http://127.0.0.1:8787/ after boot.  
Local `*.local.json` files stay on your machine.

## One-shot install

### Windows

```bat
git clone https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git
cd Fengyun-Nexus
start.bat
```

### Linux server

```bash
git clone --depth 1 https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git ~/Fengyun-Nexus
bash ~/Fengyun-Nexus/server-install.sh
```

Already cloned: `bash ~/Fengyun-Nexus/server-install.sh`  
Force reinstall: `NEXUS_REINSTALL=1 bash ~/Fengyun-Nexus/server-install.sh`  
Install only: `NEXUS_SKIP_BOOT=1 bash ~/Fengyun-Nexus/server-install.sh`

### Linux / macOS (Node already installed)

```bash
git clone https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git
cd Fengyun-Nexus
chmod +x boot.sh && ./boot.sh
```

### Termux

```bash
git clone --depth 1 https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git ~/Fengyun-Nexus
bash ~/Fengyun-Nexus/termux-install.sh
```

Already cloned: `bash ~/Fengyun-Nexus/termux-install.sh`  
Force reinstall: `NEXUS_REINSTALL=1 bash ~/Fengyun-Nexus/termux-install.sh`

## Commands

```bash
pnpm nexus setup
pnpm nexus env desktop|mobile|server|termux
pnpm nexus status
pnpm nexus boot
```

## Default login

- First run: `console` / `console`
