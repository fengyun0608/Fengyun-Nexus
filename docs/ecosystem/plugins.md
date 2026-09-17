# 插件生态

Fengyun Nexus 的示例插件、基础插件、标准插件挂载在开源平台远程仓，支持后续远程更新。

- 远程仓：[https://gitcode.com/fengyunnb_admin/Fengyun-Nexus](https://gitcode.com/fengyunnb_admin/Fengyun-Nexus)
- 配置文件：`configs/registry.json`
- 通行证：环境变量 `NEXUS_REGISTRY_TOKEN`（或本地 `configs/registry.local.json`，勿提交）

## 分类

| 分类 | 说明 |
|------|------|
| demo / 示例 | 演示能力与写法 |
| basic / 基础 | 常用基础能力 |
| standard / 标准 | 生产向标准插件 |

## 本地开发

```bash
pnpm nexus create plugin my-bot
```

模板见 `plugins/templates/ts-plugin`。

## 许可

远程插件建议使用与主仓兼容的开源许可（推荐 MIT），并在插件清单中声明。
