# 插件生态

中文 | [English](plugins.en.md)

Fengyun Nexus 从 `plugins/` 目录扫描加载插件。插件 id 优先 **`z.*`**（示例：`z.echo`）。

能力：`Plugin` 基类、`NexusEvent`（`e`）、rule 匹配、启动加载提示、权限声明。

**消息通道对应插件写法基准：** [channel-plugins.md](channel-plugins.md)  
**OneBot 11：** [onebot11.md](onebot11.md)

本地脚手架：

```bash
pnpm nexus create plugin my-bot
```

推荐 MIT。
