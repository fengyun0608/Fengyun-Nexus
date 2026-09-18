# adapter/

在此目录放 `*.ts` / `*.js`，导出通道适配器即可。

网关启动与插件热更时会：

1. 自动扫描并挂到 `ChannelRegistry`
2. `/v1/channels` 与控制台侧栏自动列出

**不用改 gateway，不用手写 `channels.register`。**

导出方式任选其一：

- `export default defineAdapter({ ... })`
- `export const adapter = defineAdapter({ ... })`

必须包含：`id`、`normalizeInbound`、`formatOutbound`；可选 `label`。

与内置 `web` / `webhook` / `onebot11` 同 id 会被跳过（内置优先）。

仅有 `adapter/`、没有 `plugin/` 入口也可以——宿主只挂通道，不报「找不到入口」。
