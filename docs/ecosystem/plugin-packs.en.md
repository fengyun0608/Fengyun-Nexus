# Plugin packs

[中文](plugin-packs.md) | English

Fengyun Nexus ships **plugin packs** — groups of cooperating plugins — not only lone singles.

| | Single plugin | Plugin pack |
|--|---------------|-------------|
| What | One folder, one capability | Several plugins that work together |
| Menu | Its own menu shot | Each feature plugin has a menu; the pack describes combos |
| Styles | One style is enough | Mix simple `index.ts` and modular dirs in one pack |

Host still loads `plugins/<name>/`. Packs are for publish/update and product grouping (`nexus.pack.json`, console “system / channel packs”).

Every feature plugin should expose a menu (e.g. `#群管`). Framework `#菜单` only covers power / update / status.

Official system pack: [fengyun-system-plugins](https://gitcode.com/fengyunnb_admin/fengyun-system-plugins). See [plugins](plugins.en.md).
