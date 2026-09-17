# Plugins

[中文](plugins.md) | English

Fengyun Nexus loads plugins from `plugins/` via directory scan. Prefer **`z.*`** plugin ids (example: `z.echo`).

Stack: `Plugin` base class, `NexusEvent` (`e`), rule matching, boot load tips, optional permissions.

**Channel + plugin baseline:** [channel-plugins.en.md](channel-plugins.en.md)  
**OneBot 11:** [onebot11.en.md](onebot11.en.md)

```bash
pnpm nexus create plugin my-bot
```

Recommended license: MIT.
