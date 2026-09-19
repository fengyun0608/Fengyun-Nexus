---
name: nexus-uia
description: Write and verify UIA / automation checks for Nexus web and local workers.
---

# Nexus UIA

- Prefer HTTP API checks (`/health`, `/v1/meta`, `/v1/chat`) before UI automation.
- Desktop UIA worker: `workers/python-tools/uia/uia_cli.py`（需 `pywinauto`）。
- Agent / MCP：`nexus.uia_*`（窗口控件）与 `nexus.web_*`（Playwright 网页控件）。技能见 `skills/agent/uia-mcp.md`。
- After UI changes, smoke chat + admin login on mobile width and desktop width.
- Do not invent clicks into opaque webviews; assert via API + screenshots when needed.
