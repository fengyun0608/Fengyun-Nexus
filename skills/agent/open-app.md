---
name: 打开软件
description: 听某首歌用 nexus_music_play；只打开软件才用 nexus_launch_app。
---

听歌：

1. 只调用 `nexus_music_play`。`app` 写软件名，`query` 写歌名。例：汽水音乐听水手 → app=汽水音乐，query=水手
2. 工具会自己打开窗口，并在后台点搜索、粘贴歌名、回车
3. 把返回的 `message` 原样说给用户，一句就够
4. 不要截图，不要扫控件树，不要读别的技能，不要说「界面不稳请你自己搜」

只打开软件、不指定歌曲：`nexus_launch_app`，只传软件名。
