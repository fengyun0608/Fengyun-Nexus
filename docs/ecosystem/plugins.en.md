# Plugin Ecosystem

[← 中文](plugins.md)

Demo, basic, and standard plugins are hosted on the open-source remote registry and can be updated remotely later.

- Registry: https://gitcode.com/fengyunnb_admin/Fengyun-Nexus
- Config: `configs/registry.json`
- Token: `NEXUS_REGISTRY_TOKEN` (or local `configs/registry.local.json`, do not commit)

## Categories

| Category | Purpose |
|----------|---------|
| demo | Examples |
| basic | Common basics |
| standard | Production-oriented |

## Local scaffolding

```bash
pnpm nexus create plugin my-bot
```

See `plugins/templates/ts-plugin`.
