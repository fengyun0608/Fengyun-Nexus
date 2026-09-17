# Start on each platform

[中文](start.md) | English

**One console only:** open http://127.0.0.1:8787/ after boot.

## Deploy from remote

```bash
git clone https://gitcode.com/fengyunnb_admin/Fengyun-Nexus.git
cd Fengyun-Nexus
# Windows: start.bat
### Termux (Android)

Preferred remote scripts (env and install are separate; answer Y/n):

```bash
curl -fsSL https://gitcode.com/fengyunnb_admin/Fengyun-Nexus/raw/main/scripts/termux-env.sh | bash
curl -fsSL https://gitcode.com/fengyunnb_admin/Fengyun-Nexus/raw/main/scripts/termux-setup.sh | bash
```

Use `NEXUS_INSTALL_YES=1` for non-interactive. Install `pnpm@9.15.0` on Termux (no `@pnpm/exe` for android-arm64).
chmod +x boot.sh && ./boot.sh
```

Or: `pnpm boot`

Bootstrap login: `console` / `console` on a dedicated login page.  
Username: 4–8 English letters. Password: ≥4 chars with upper/lower/digit/special.  
Console sidebar appears only after login. Top-left hamburger toggles the tree.
