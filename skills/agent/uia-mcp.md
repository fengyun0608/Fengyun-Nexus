---
name: UIA与网页控件
description: 操控本机已开窗口：控件树、认字点击、或挂上网页壳 DOM。
---

不会操控界面时先读本技能，再调工具。不要一上来就说做不到。

## 顺序

1. 普通桌面软件：`nexus_uia_windows` → `nexus_uia_tree` → `nexus_uia_click` / `set_text` / `keys`
2. 控件树是空的网页壳（汽水音乐等）：先 `nexus_web_attach`；挂不上就 `nexus_window_see` 认字，再 `nexus_click_text`
3. 浏览器里打开的网址：`nexus_web_open` → `nexus_web_snapshot` → `click` / `type` / `keys`
4. 听歌：只用 `nexus_music_play`，不要截图扫树
5. 仍缺环境：`nexus_shell` 装依赖

## 认字

- `nexus_window_see`：截窗口，用系统文字识别，列出每段字的坐标
- `nexus_click_text`：按看见的字点，例如点「搜索」

## 网页壳

- `nexus_web_attach`：挂调试口（默认找 9333 / 9222），snapshot 里有字和控件位置
- 听歌工具会自己带 `--remote-debugging-port=9333` 启动；已开着的软件若没开端口，就走认字

## 注意

- 不要说「只能文字假装」；该戳就 `nexus_qq_poke`，该点就认字或挂页面
- 电脑整屏截图仍用 `nexus_screen`
