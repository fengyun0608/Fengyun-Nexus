# Channel plugin writing baseline

[中文](channel-plugins.md) | English

Fengyun Nexus pairs **channels** with **plugins**: adapters normalize inbound traffic into `NexusMessage`; plugins handle `NexusEvent` (`e`).

## Shared rules

1. Put the plugin under `plugins/<name>/` with `nexus.plugin.json`
2. `id` must be English (prefer `z.*`); `name` is Chinese for the console
3. Extend `Plugin` from `@fengyun/nexus-plugin-sdk`
4. Use `rule` + method names, or `accept(e, ctx)`
5. Commands start with `#`; reply with `e.reply` / `e.replyImage`
6. Filter by channel when needed: `e.channel === "web"` / `"webhook"` / `"onebot11"`

## New channels

Export `defineAdapter` from `plugins/*/adapter/`. The host scans it on boot and plugin hot-reload. Do **not** hand-register in the gateway. Built-in ids (`web`, `webhook`, `onebot11`) win on conflict.

See also: [Plugins](plugins.en.md) · [OneBot 11](onebot11.en.md)
