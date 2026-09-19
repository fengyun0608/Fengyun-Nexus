# 插件生态

中文 | [English](plugins.en.md)

Fengyun Nexus **优先做插件包**：一组互相照应的插件一起发布与更新。单插件适合练手；产品交付用包。

| 类型 | 说明 |
|------|------|
| 消息通道插件包 | 服务于某一消息通道，包内可多插件组合 |
| 系统插件包 | 通用能力；官方专仓整包更新 |
| 单插件 | 一项能力；也可收进某个包 |

## 菜单

- 框架 `#菜单` / `#帮助`：只含电源、更新、状态
- 业务插件各自出菜单：如 `#群管`、`#主人菜单`、`#点赞菜单`

## 写法

包内可混用：

- 简单根 `index.ts`
- 模块化 `plugin/` · `adapter/` · `workflow/` …
- `onReady` 自定义加载文案

详解：[插件包](plugin-packs.md) · [通道插件写法](channel-plugins.md)

## 远程与专仓

- 远程仓：[GitCode · Fengyun-Nexus](https://gitcode.com/fengyunnb_admin/Fengyun-Nexus) · [GitHub](https://github.com/fengyun0608/Fengyun-Nexus)
- 系统插件专仓：[fengyun-system-plugins](https://gitcode.com/fengyunnb_admin/fengyun-system-plugins)
- 主人 `#更新` 拉框架与专仓；有一方更新则说明并同窗口重启

推荐开源许可：MIT。
