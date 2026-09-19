# 目录鱼骨

```text
        apps ── gateway · web · cli
          │
packages ─┼─ core · channel · plugin-sdk · workflow · mcp-host · llm · shared · db · browser-shot
          │
workers ──┼─ go-pump · python-tools（可选）
          │
     脊骨 ═ Fengyun Nexus
          │
plugins ──┼─ z-* 系统插件 · templates 脚手架 · 远程专仓
          │
 packs ───┼─ fengyun-system-plugins（系统插件专仓副本）
          │
 skills ──┼─ nexus-dev · nexus-plugin · nexus-uia
          │
   docs ──┴─ product · ecosystem · README（文档中心）
```

```text
Fengyun-Nexus/
├── apps/                 # gateway · web · cli
├── packages/             # 核心能力包（改完需 build dist）
├── workers/              # 辅助运行时（可选）
├── plugins/              # 业务插件；templates/ 不扫描
├── packs/                # 系统插件专仓导出副本
├── skills/               # Agent 技能
├── docs/                 # 产品介绍 · 生态 · 文档中心
├── configs/              # *.default.json；本机 *.local.json 不进仓
├── scripts/              # boot · get.sh · get.ps1 · pack
├── LICENSE
└── README.md
```

扩展习惯：放对目录即可加载（插件 / adapter / workflow），不必改网关手写注册。
