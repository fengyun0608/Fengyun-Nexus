# 插件生态

中文 | [English](plugins.en.md)

Fengyun Nexus 的插件生态面向两类能力：

| 类型 | 说明 |
|------|------|
| 消息通道插件 | 服务于某一消息通道（如 QQ），在对应通道场景下使用 |
| 框架插件 | 通用能力（菜单、状态、浏览器截菜单图发群等），不绑死单一通道 |

插件可从远程仓安装与更新（示例 / 基础 / 标准分类），也可在本地 `plugins/` 中开发。

系统通用插件（菜单 / 状态 / 生图 / 回声 / 点赞 / 群管 / 进退群 / 主人）走官方专仓更新，地址写在发行配置里并锁定，控制台不能改。群里主人发 `#更新` / `#更新插件` 会拉框架与该专仓；有一方更新则说明改动并同窗口重启。

- 远程仓：[GitCode · Fengyun-Nexus](https://gitcode.com/fengyunnb_admin/Fengyun-Nexus) · [GitHub](https://github.com/fengyun0608/Fengyun-Nexus)
- 系统插件专仓：[fengyun-system-plugins](https://gitcode.com/fengyunnb_admin/fengyun-system-plugins)
- 控制台：插件管理；插件更新页可检测 / 拉取，专仓地址只读

## 扩展习惯

- 目录放对即可加载：根 `index.ts`，或模块化 `plugin/` · `adapter/` · `workflow/` · `http/` · `events/` · `www/`
- `id` 英文，`name` 中文；指令以 `#` 开头（点赞等少数插件可用触发词）
- `onReady` 可 `ctx.log` 多行 / 图案，或 `return ["行1","行2"]`；框架「已加载：xxx」不变
- 通道 adapter：`defineAdapter` 导出后由宿主自动挂载，不必改网关手写注册

推荐开源许可：MIT。写法基准见 [通道插件](channel-plugins.md)。

> 本页为生态介绍。具体对接以源码与控制台可点文档为准。
