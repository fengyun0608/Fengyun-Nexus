# Ecosystem hub

Chinese | [中文](hub.md)

Online **plugin-pack catalog** lives in a dedicated repo. System plugins stay separate.

| Repo | Role |
|------|------|
| [fengyun-system-plugins](https://gitcode.com/fengyunnb_admin/fengyun-system-plugins) | Built-in system pack |
| [fengyun-nexus-ecosystem](https://gitcode.com/fengyunnb_admin/fengyun-nexus-ecosystem) · [GitHub](https://github.com/fengyun0608/fengyun-nexus-ecosystem) | Catalog (`catalog.json`) + samples + community listings |

Host `configs/registry.json`: `pluginsRepo` / `ecosystemRepo` (locked, not editable in console).

## Console Plugin Store

Top bar: one search field, then Upload / Submit / Refresh.

- Categories: all / official / community / template / installed
- Sort: default or by heat
- Download path or git packs into `plugins/` with hot reload
- Remove installed packs (never deletes system `z-*`)
- Zip upload installs locally only
- Submit: sign in with your own GitCode/GitHub token, pick a public plugin repo, host opens a PR; maintainers merge before it appears in the store

Tokens are request-scoped and never written to disk. Open PRs show under “pending review”.

Optional catalog field `heat` is the base score; each local download adds to a local counter.
