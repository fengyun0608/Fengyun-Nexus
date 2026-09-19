---
name: 打开软件
description: 主人要听歌或打开本机软件时，用 nexus_launch_app，不要先截图或扫窗口。
---

听歌、打开软件：

1. 只调用 `nexus_launch_app`，`name` 写软件名，例如「汽水音乐」「网易云音乐」「ToDesk」
2. 不要先 `nexus_screen`，不要先 `nexus_uia_tree`，不要先读无关技能
3. 应用没开就直接启动；启动后用人话说一句，例如「已打开汽水音乐」
4. 若还要点搜索框听某首歌，再 `nexus_uia_tree` / `nexus_uia_set_text` / `nexus_uia_keys`，先把窗口打开再说
5. 工具必须走正式 function call，禁止把 DSML / invoke 写进正文
