---
name: nexus-plugin
description: Author Nexus plugins — manifest, hooks, permissions, templates, remote registry categories.
---

# Nexus Plugin

1. Use `plugins/templates/ts-plugin` or `nexus create plugin <name>`.
2. Manifest: `nexus.plugin.json` with id/name/version/hooks/permissions/category.
3. Implement `definePlugin` with `onMessage` / `onReady` as needed.
4. Categories for remote: demo / basic / standard.
5. Do not put secrets in plugin repos; registry token is host-side.
