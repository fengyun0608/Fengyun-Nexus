---
name: nexus-dev
description: Develop or modify Fengyun Nexus framework itself — structure, gateway, web, configs, three envs.
---

# Nexus Dev

- Work only under `Fengyun-Nexus/`.
- Three envs: `NEXUS_ENV=mobile|desktop|server` via `configs/env.*.json`.
- Admin: `NEXUS_ADMIN_PASSWORD` or `configs/admin.default.json`.
- Public docs live in `docs/product/` and root README; keep stack chatter out of them.
- Prefer extending packages over forking sibling workspace projects.
