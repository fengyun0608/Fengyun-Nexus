---
name: UIA与网页控件
description: 操控本机已开窗口的 UIA 控件，或打开网页后点选、填字、模拟按键。
---

不会操控界面时先读本技能，再调工具。不要一上来就说做不到。

## 顺序

1. 桌面软件（Windows）：`nexus_uia_windows` → `nexus_uia_tree` → `nexus_uia_click` / `nexus_uia_set_text` / `nexus_uia_keys`
2. 网页：`nexus_web_open` → `nexus_web_snapshot` → `nexus_web_click` / `nexus_web_type` / `nexus_web_keys`
3. 仍缺环境时：用 `nexus_shell` 装依赖，例如 `python -m pip install -r workers/python-tools/uia/requirements.txt`
4. MCP 同名：`nexus.uia_*` / `nexus.web_*`，也可用 `nexus_call_mcp`

## 桌面 UIA（Windows）

- 依赖：本机 Python + `pywinauto`
- 先列窗口，再扫控件树，用 `name` / `auto_id` / `control_type` 精准点
- 按键语法同 pywinauto：`^a` 全选，`{ENTER}` 回车，`{TAB}` 等
- 非 Windows：说明桌面 UIA 不可用，改走网页工具或系统命令

## 网页

- 依赖：控制台「环境配置」里的浏览器（Playwright）
- `nexus_web_open` 打开 URL（默认可 headless；`headless=false` 显示窗口）
- `nexus_web_snapshot` 拿可交互控件与 selector
- 同一 `session` 名复用会话；用完可 `nexus_web_close`
- `nexus_web_read` / `nexus_web_search` 只读摘要，不能代替控件操控

## 注意

- 不瞎点不透明 WebView 内部；桌面用 UIA 树，网页用 DOM selector
- 电脑整屏截图仍用 `nexus_screen`，网页画面用 `nexus_web_screenshot`
