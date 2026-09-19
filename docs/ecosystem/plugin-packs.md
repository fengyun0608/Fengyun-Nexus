# 插件包

中文 | [English](plugin-packs.en.md)

Fengyun Nexus 优先做的是 **插件包**，不是零散单插件硬凑。

## 插件包和单插件

| | 单插件 | 插件包 |
|--|--------|--------|
| 是什么 | 一个目录、一项能力 | 一组互相照应的插件，一起发布/更新 |
| 菜单 | 自己一张 | 每个功能插件各自菜单；包描述组合关系 |
| 例子 | 只回声 | 系统插件包：主人 + 群管 + 进退群 + 点赞 … |
| 写法 | 一种即可 | 包内可混用简单 / 模块化等多种写法 |

宿主加载单位仍是 `plugins/<名>/`。包是**发布与产品组合**的单位：专仓、`nexus.pack.json`、控制台「系统插件包 / 消息通道插件包」。

## 包内写法可以很灵活

同一个包里允许：

1. **简单**：根 `index.ts` + `nexus.plugin.json`
2. **模块化**：`plugin/` · `adapter/` · `workflow/` · `http/` · `events/` · `www/`
3. **混合**：有的简单、有的模块化

模板：

- 简单：[plugins/templates/ts-plugin](../../plugins/templates/ts-plugin)
- 模块化：[plugins/templates/modular-plugin](../../plugins/templates/modular-plugin)
- 插件包说明：[plugins/templates/plugin-pack](../../plugins/templates/plugin-pack)

## 每个功能插件要有菜单

框架 `#菜单` / `#帮助` 只含电源、更新、状态、框架菜单本身。

业务能力由各插件自己出图，例如：

| 插件 | 菜单词 |
|------|--------|
| 群管 | `#群管` `#群管菜单` |
| 主人管理 | `#主人菜单` |
| 点赞 | `#点赞菜单` |
| 进退群 | `#进退群菜单` |
| 生图 | `#生图菜单` |
| 回声 | `#回声菜单` |

用 `ctx.shot.renderMenu({ title, sections })`，再用 `e.replyImage` 只发图。

## 组合关系

系统插件包内常见组合：

- **主人 + 群管**：踢 / 禁言等认通道主人级别
- **主人 + 点赞**：主人与普通人不同回复
- **群管 + 进退群**：权限指令与欢迎语分开，可同装
- **菜单 + 生图**：同一套截图视觉壳

包根 `nexus.pack.json` 列出插件、菜单词与 `combos`，方便人和文档阅读。

## 官方系统插件包

- 专仓：[fengyun-system-plugins](https://gitcode.com/fengyunnb_admin/fengyun-system-plugins)
- 本地副本：`packs/fengyun-system-plugins`
- 导出：`pnpm pack:system-plugins`

## 生态收录

线上插件包目录与社区登记走 [生态专仓](hub.md)（`fengyun-nexus-ecosystem`），与系统插件仓分开。

另见 [插件生态](plugins.md) · [通道插件写法](channel-plugins.md)。
