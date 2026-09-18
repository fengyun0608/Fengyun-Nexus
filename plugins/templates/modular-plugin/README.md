# 模块化插件模板

复制整夹到 `plugins/my-plugin/`，改 `nexus.plugin.json` 的 id/name。

```
my-plugin/
  nexus.plugin.json   # 不要写 main；不要根 index（有 index 就只加载它）
  plugin/             # 消息规则 *.ts（可多个）
  adapter/            # 可选：协议适配
  workflow/           # 可选：AI 工作流
  http/               # 可选：REST
  events/             # 可选：进群/撤回等
  commonconfig/       # 可选：面板配置
  www/                # 可选：插件自带前端
```

群里发 `#模块化` 测模板自带规则（复制后记得改指令）。

## 生图说明

系统插件「生图」（`#生图`）用框架浏览器把**菜单/网页**渲好再截图发群，不是 AI 文生图。  
需要截图时复用这套能力；浏览器运行时在控制台「环境配置」里装。
