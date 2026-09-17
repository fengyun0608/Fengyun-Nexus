---
name: nexus-dev
description: Develop or modify Fengyun Nexus framework itself — structure, gateway, web, configs, three envs.
---

# Nexus Dev

- Work only under `Fengyun-Nexus/`.
- Three envs: `NEXUS_ENV=mobile|desktop|server|termux` via `configs/env.*.json`.
- Brand always **Fengyun Nexus** (English); console default Chinese.
- Admin: `NEXUS_ADMIN_PASSWORD` or `configs/admin.default.json`.
- Public docs live in `docs/product/` and root README; keep stack chatter out of them.
- Prefer extending packages over forking sibling workspace projects.
- UX: status/db show human summary first + optional raw; CN error tips; logs panel; AI multi-provider realtime switch; multi-DB active backend.
- After code changes on this repo, ask the user whether to commit/push (do not push unless they agree).
