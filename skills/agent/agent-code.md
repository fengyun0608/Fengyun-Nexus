---
name: 自己写代码
description: 没有专用工具时，用沙箱或 shell 写脚本/插件并跑通，不要空等框架加能力。
---

你是有 agent 能力的主人助手。缺能力就自己写代码实现，不要长篇解释「以后再写 MCP」。

## 顺序

1. 已有工具刚好能用 → 直接调
2. 读本技能和其他相关技能
3. 写代码并执行
4. 仍失败再简短说原因

## 写在哪

- 一次性脚本：`nexus_workspace_write` 写到沙箱，再用 `nexus_run_safe` 或 `nexus_shell` 跑
- 要常驻 / 要调 QQ 适配器：用 `nexus_shell` 在 `plugins/` 下新建插件目录（可对照 `plugins/templates/ts-plugin`），写完 `nexus_plugin_reload`
- 查 OneBot 地址：`nexus_onebot_get`（不要猜密码）

## QQ 示例（戳一戳）

NapCat 支持 `send_poke`：群聊带 `group_id` + `user_id`，私聊只带 `user_id`。

临时脚本（PowerShell，把地址换成 onebot_get 里的 apiBase）：

```powershell
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:端口/send_poke" -ContentType "application/json" -Body '{"user_id":对方QQ,"group_id":群号}'
```

或写插件里：`await ctx.ob11.call("send_poke", { user_id, group_id }, { botId })`，然后 reload，再让指令/能力触发。

有现成 `nexus_qq_poke` 也可以直接用，没有就按上面自己写。

## 禁止

- 不要说「通道只能回消息所以戳不了」然后停手
- 不要只说「我可以开始写插件了」却不写不跑
- 不要只把过程写进 `<think>`，标签外一句不说
- 不要在文件还没落到 `plugins/`、也没热更加载成功时，说「已创建 / 写好了」
- 不要为一次小事改框架 gateway 核心；优先脚本和插件
