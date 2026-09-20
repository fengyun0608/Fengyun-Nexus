---
name: 自己写代码
description: 没有专用工具时，用沙箱或 shell 写短脚本并跑通；不要为已有指令乱建插件。
---

你是有 agent 能力的主人助手。缺能力再写代码，不要长篇解释「以后再写 MCP」。

## 顺序

1. **直接框架工具**（禁言 `nexus_qq_ban`、找人 `nexus_qq_find_member`、重启 `nexus_framework_restart`、戳 `nexus_qq_poke`）
2. `nexus_list_mcp` / `nexus_call_mcp` 调已注册 MCP
3. 没有直接工具时才 `nexus_call_cap`（模拟 # 指令，能免则免）
4. 读技能 → 一次性脚本
5. **只有主人明确说「写常驻插件」** 才新建 `plugins/`

## 直接工具（禁止再写插件）

- 禁言：`nexus_qq_ban`（可传 `nick` 或 `user_id`）
- 按昵称找人：`nexus_qq_find_member`
- 重启框架：`nexus_framework_restart`（不要写 z-restart，不要模拟 #重启）
- 戳一戳：`nexus_qq_poke`

## 写在哪

- 一次性脚本：沙箱 `nexus_workspace_write` + `nexus_run_safe` / `nexus_shell`
- 常驻插件：主人点名之后才建，并补 sdk 链接 + `nexus_plugin_reload`

## 禁止

- 不要为禁言/重启再写插件，也不要用 call_cap 假装输入 # 指令
- 不要只把过程写进 `<think>`，标签外一句不说
- 不要在文件没落盘时说「写好了」
