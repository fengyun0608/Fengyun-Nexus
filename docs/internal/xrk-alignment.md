# 对内：对照师父框架 XRK-Yunzai

参考仓：[XRK-Yunzai](https://gitcode.com/xrkseek/XRK-Yunzai)（只学习架构，不整仓复制业务）。

## 结论

**可以做到「同等级能力形态」**，路径是：把 XRK 的成熟分层 / 事件 / 插件 / 工作流 / HTTP / 日志习惯迁到 Nexus 自己的产品壳里。  
**不要**把 Nexus 改成第二个 Yunzai 分叉；保留「唯一控制台 + 三端/Termux + 本地配置不上传」。

## 师父框架（XRK）强项

| 能力 | 要点 |
|------|------|
| 入口 | `app.js` 引导 → `start.js` 菜单/选端口 → `Bot.run` |
| 核心对象 | `Bot` / 事件 `e` / `cfg` / `logger` / `redis` / `segment` |
| 分层 | `lib/` 基建；业务进 `plugins/*`（adapter、http、workflow、events） |
| 加载器 | PluginsLoader / ApiLoader / AiWorkflowLoader / ListenerLoader |
| 消息链 | 适配器 → `Bot.em` → deal → 插件 rule → `e.reply` |
| 工作流 | chat / memory / tools / MCP，可 merge |
| HTTP | Express + WS + 代理 + 限流 + 静态站 |
| 运维 | Redis、Docker/PM2、多端口配置隔离、彩色分级日志 |

## Nexus 现状（已有）

| 能力 | 要点 |
|------|------|
| 入口 | `start.bat` / `boot.sh` / `pnpm boot` → 唯一控制台 `:8787` |
| 核心 | Gateway + Session + Channel + PluginHost + Workflow + LLM |
| 控制台 | 独立登录页、侧栏、适配器/插件卡片 |
| 日志 | INFO/OK/WARN/ERROR/PLUGIN 彩色级别 |
| 边界 | 不碰工作区其它项目；远程插件细节不对公开展示 |

## 建议对齐顺序（做到「那种」）

1. **事件对象 `e` 化**  
   统一 `NexusEvent`：`reply` / `channel` / `user` / `raw`，对齐 XRK 的 `e` 手感。

2. **插件基类 + Loader 扫描**  
   `plugins/<name>/` 目录热加载；rule / 优先级 / 权限；业务不进 `packages/core`。

3. **适配器目录化**  
   `plugins/*/adapter` 或 `packages/channel` + 插件扩展，对齐 OneBot/设备/Webhook 插拔。

4. **工作流模块**  
   在现有 `@fengyun/nexus-workflow` 上扩 chat/memory/tools（可后接 Redis）。

5. **HTTP ApiLoader**  
   插件可贡献路由；控制台仍唯一入口。

6. **可选 Redis**  
   会话/限流/记忆；开发默认可无 Redis（文件/内存），生产再开。

7. **运维入口**  
   菜单选环境/端口（学 `start.js`），Docker/PM2 脚本可选。

## 刻意不照搬

- 不强绑 Node 24 / 必装 Redis 才能启动  
- 不把 QQ/OneBot 做成唯一主场景（Nexus 主场景是控制台 + 通道）  
- 不对外文档堆栈细节与远程插件源路径  

## 一句话

学师父的 **骨架与手感**，做成 Nexus 自己的 **产品化枢纽**；目标是「用起来像成熟 Yunzai 系框架」，而不是「再 fork 一份 XRK」。
