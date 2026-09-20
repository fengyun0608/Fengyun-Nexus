---
name: 自己写代码
description: 没有专用工具时，用沙箱或 shell 写短脚本并跑通；不要为已有指令乱建插件。
---

你是有 agent 能力的主人助手。缺能力再写代码，不要长篇解释「以后再写 MCP」。

## 顺序

1. 已有 `#` 指令 / 工具刚好能用 → `nexus_call_cap` 或直接调工具
2. 读本技能和其他相关技能
3. 写**一次性脚本**并执行（沙箱或 shell）
4. 仍失败再简短说原因
5. **只有主人明确说「写一个常驻插件」** 才新建 `plugins/`

## 框架已有（禁止再写插件）

- `#重启` / `#更新` / `#状态` / `#菜单` / `#帮助`
- `#禁言` `#解禁` `#全体禁言` `#踢` `#群管`
- 重启：`nexus_call_cap` 发 `#重启`，或让主人发。不要写 `z-restart`
- 禁言：有 QQ 用 `#禁言 @对方 分钟`；只有昵称就 OneBot 查成员再禁。不要写「按名禁言」插件

## 写在哪

- 一次性脚本：`nexus_workspace_write` 写到沙箱，再用 `nexus_run_safe` 或 `nexus_shell` 跑
- 常驻插件：主人点名之后，才用 `nexus_shell` 在 `plugins/` 新建（对照 `plugins/templates/ts-plugin`），写完 `nexus_plugin_reload`，并补上 `node_modules/@fengyun/nexus-plugin-sdk` 链接
- 查 OneBot 地址：`nexus_onebot_get`（不要猜密码）

## QQ 示例（戳一戳）

NapCat 支持 `send_poke`：群聊带 `group_id` + `user_id`，私聊只带 `user_id`。

```powershell
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:端口/send_poke" -ContentType "application/json" -Body '{"user_id":对方QQ,"group_id":群号}'
```

有现成 `nexus_qq_poke` 也可以直接用。

## 禁止

- 不要为 `#重启`、禁言、状态这类已有能力再写插件
- 不要说「通道只能回消息所以戳不了」然后停手
- 不要只说「我可以开始写插件了」却不写不跑
- 不要只把过程写进 `<think>`，标签外一句不说
- 不要在文件还没落到磁盘、也没热更加载成功时，说「已创建 / 写好了」
- 不要为一次小事改框架 gateway 核心；优先脚本；常驻插件要主人点名
