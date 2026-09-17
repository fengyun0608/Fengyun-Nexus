---
name: nexus-dev
description: Develop or modify Fengyun Nexus framework itself — structure, gateway, web, configs, three envs.
---

# Nexus Dev

- Work only under `Fengyun-Nexus/`.
- Three envs: `NEXUS_ENV=mobile|desktop|server|termux` via `configs/env.*.json`.
- Brand always **Fengyun Nexus** (English); console default Chinese.
- Admin: `NEXUS_ADMIN_PASSWORD` or `configs/admin.default.json`.
- **Public intro** (`README`, `docs/product/`, ecosystem intros): product pitch + getting started only. **Do not put 运作方式 / architecture / stack pipelines in intro docs** — keep those in `docs/internal/`.
- Prefer extending packages over forking sibling workspace projects.
- UX: multi-layer console; human summary + optional raw (top-right); CN tips; ask before push.
- After code changes on this repo, ask the user whether to commit/push (do not push unless they agree).
