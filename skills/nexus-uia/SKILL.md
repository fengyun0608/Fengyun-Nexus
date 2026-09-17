---
name: nexus-uia
description: Write and verify UIA / automation checks for Nexus web and local workers.
---

# Nexus UIA

- Prefer HTTP API checks (`/health`, `/v1/meta`, `/v1/chat`) before UI automation.
- Desktop/window automation stubs live in `workers/python-tools/uia/`.
- After UI changes, smoke chat + admin login on mobile width and desktop width.
- Do not invent clicks into opaque webviews; assert via API + screenshots when needed.
