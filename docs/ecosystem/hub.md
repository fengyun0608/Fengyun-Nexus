# 生态专仓

中文 | [English](hub.en.md)

线上**插件包收录与社区更新**走生态专仓，不跟系统插件混在一个仓里。

| 专仓 | 用途 |
|------|------|
| [fengyun-system-plugins](https://gitcode.com/fengyunnb_admin/fengyun-system-plugins) | 系统插件包（菜单 / 状态 / 群管 / 主人…） |
| [fengyun-nexus-ecosystem](https://gitcode.com/fengyunnb_admin/fengyun-nexus-ecosystem) | 生态收录（`catalog.json`）+ 官方示例 + 社区登记 |

宿主 `configs/registry.json`：

- `pluginsRepo` → 系统插件
- `ecosystemRepo` → 生态收录

两处地址由发行配置锁定，控制台不能改。

## 收录

生态仓根目录 `catalog.json` 是清单。条目可以：

- 指向本仓内 `packs/...`（官方示例）
- 指向别人的 git 仓（社区包）

投稿说明见生态仓 [CONTRIBUTING.md](https://gitcode.com/fengyunnb_admin/fengyun-nexus-ecosystem/blob/main/CONTRIBUTING.md)。

## 和「插件包」文档的关系

写法与菜单约定见 [插件包](plugin-packs.md)；本页只说明**线上收录落在哪个仓**。
