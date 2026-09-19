# Fengyun Nexus · 产品规划总图

独立产品脊骨：用户体验、平台能力、开源生态、治理四翼。

```text
                         ┌─ 框架内对话
           用户体验 ─────┼─ 控制台 / 管理端
                         └─ 远程插件安装与更新
                                    │
                         ┌─ 消息通道
           平台能力 ─────┼─ 插件运行时
                         ├─ 工作流 / MCP
                         └─ 截图与状态面板
                                    │
  Fengyun Nexus ════════════════════╪════ product brand
                                    │
                         ┌─ 示例 / 基础 / 标准插件
           开源生态 ─────┼─ 系统插件专仓
                         └─ GitCode + GitHub 双远程
                                    │
                         ┌─ MIT 开源协议
             治理 ───────┼─ 产品文档与架构图
                         └─ 姿态：手机 / 电脑 / 服务器 / Termux
```

```mermaid
flowchart TB
  product[Fengyun_Nexus]

  subgraph experience [用户体验]
    chat[框架内对话]
    console[控制台管理端]
    remoteUX[远程插件安装更新]
  end

  subgraph platform [平台能力]
    channels[消息通道]
    plugins[插件运行时]
    flows[工作流与MCP]
    shot[截图与状态]
  end

  subgraph ecosystem [开源生态]
    demo[示例插件]
    basic[基础插件]
    standard[标准插件]
    syspack[系统插件专仓]
    registry[GitCode与GitHub]
  end

  subgraph governance [治理]
    mit[MIT协议]
    docs[产品文档]
    envs[多姿态]
  end

  product --> experience
  product --> platform
  product --> ecosystem
  product --> governance
  remoteUX --> registry
  demo --> registry
  basic --> registry
  standard --> registry
  syspack --> registry
```

介绍与扩展面组织感谢 [XRK-AGT](https://github.com/xrkseek/XRK-AGT) 带来的灵感；本仓实现与品牌独立。
