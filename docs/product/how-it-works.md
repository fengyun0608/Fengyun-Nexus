# Fengyun Nexus 如何运作

[English →](how-it-works.en.md)

## 仓库是否已连接？

是。本仓已连接 GitCode 远程：

- 地址：https://gitcode.com/fengyunnb_admin/Fengyun-Nexus
- 分支：`main` 已推送并可跟踪 `origin/main`

## 一句话

**Gateway（网关）** 是大脑与入口；**Web 控制台** 负责对话与管理；**通道 / 插件 / 工作流 / 工具** 都挂在网关上，按统一消息模型流转。

## 运行骨架

```text
手机 / 电脑浏览器 / 服务器部署
            │
            ▼
     Web 控制台（对话 · 管理）
            │  HTTP / SSE
            ▼
        Gateway 网关
     ┌──────┼──────────────┐
     ▼      ▼              ▼
  通道适配  会话+模型     插件宿主
  (web/webhook)           │
                          ├─ 工作流
                          └─ 工具 / MCP
            │
            ▼
     辅助运行时（可选 Go / Python）
```

## 消息怎么走

1. 用户在 Web 说话，或外部 Webhook 打进来  
2. 通道把原始数据归一成 `NexusMessage`  
3. 先问插件（例如 `/echo`），没有命中再走模型路由  
4. 结果写回会话，再经通道格式化返回  

管理端登录与对话是分开的：对话可匿名用；管理接口需要会话令牌。

## 管理端安全规则

| 规则 | 行为 |
|------|------|
| 初始账号 | 用户名 `console`，密码 `console` |
| 首次登录 | 必须立刻在控制台重配用户名与密码，然后**重新登录** |
| 刷新页面 | 登录态**立即失效**（令牌只在当前页内存，不写本地存储） |
| 有效期 | **12 小时**，到期自动失效 |
| 改用户名/密码 | **所有登录态立即失效**，需重新登录 |

凭据会落到本机 `configs/admin.local.json`（勿提交密钥到公开仓库）。

## 三环境

用环境变量 `NEXUS_ENV`：

- `mobile`：手机端姿态  
- `desktop`：电脑端（默认）  
- `server`：服务器部署  

对应配置：`configs/env.*.json`。

## 插件与远程更新

- 本地模板：`plugins/templates`  
- 远程源：`configs/registry.json` → GitCode 仓  
- 示例 / 基础 / 标准插件分类已预留；通行证：`NEXUS_REGISTRY_TOKEN`

## 相关文档

- [环境要求与安装](environment.md) · [English](environment.en.md)  
- [产品规划总图](planning.md)  
- [能力鱼骨](fishbone.md)  
- [目录鱼骨](directory.md)  
- [插件生态](../ecosystem/plugins.md)  
