# Plugin ecosystem

[中文](plugins.md) | English

Fengyun Nexus plugins fall into two families:

| Kind | About |
|------|--------|
| Channel plugins | Tied to a message channel (e.g. QQ) |
| Framework plugins | Shared capabilities (menu, status, screenshot, …) |

Install from the remote registry (demo / basic / standard) or develop under local `plugins/`.

System plugins (menu / status / draw / echo / like / group / master) update from a dedicated pack repo locked in release config.

- Remotes: [GitCode](https://gitcode.com/fengyunnb_admin/Fengyun-Nexus) · [GitHub](https://github.com/fengyun0608/Fengyun-Nexus)
- System pack: [fengyun-system-plugins](https://gitcode.com/fengyunnb_admin/fengyun-system-plugins)
- Console: Plugin Manager; pack URL is read-only

Drop-in layout: root `index.ts`, or modular `plugin/` · `adapter/` · `workflow/` · …. Channel adapters via `defineAdapter` are picked up automatically.

Recommended license: MIT. See [channel plugins](channel-plugins.en.md).
