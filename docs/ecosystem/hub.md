# 生态专仓

中文 | [English](hub.en.md)

线上**插件包收录与社区更新**走生态专仓，不跟系统插件混在一个仓里。

| 专仓 | 用途 |
|------|------|
| [fengyun-system-plugins](https://gitcode.com/fengyunnb_admin/fengyun-system-plugins) | 系统插件包（菜单 / 状态 / 群管 / 主人…） |
| [fengyun-nexus-ecosystem](https://gitcode.com/fengyunnb_admin/fengyun-nexus-ecosystem) · [GitHub](https://github.com/fengyun0608/fengyun-nexus-ecosystem) | 生态收录（`catalog.json`）+ 官方示例 + 社区登记 |

宿主 `configs/registry.json`：

- `pluginsRepo` → 系统插件
- `ecosystemRepo` → 生态收录

两处地址由发行配置锁定，控制台不能改。

## 控制台「插件商店」

侧栏单独一页，最顶只有搜索框，旁边是「上传插件 / 投稿 / 刷新仓库」。

| 能力 | 说明 |
|------|------|
| 分类 | 全部 / 官方 / 社区 / 模板参考 / 已下载 |
| 排序 | 默认，或按热度从高到低 |
| 下载 | path 型与社区 git 型都可一键装进 `plugins/` 并热重载 |
| 已下载 | 可移除（不删系统 `z-*` 插件） |
| 上传到本机 | zip（含 `nexus.pack.json` 或 `nexus.plugin.json`），只装本机 |
| 投稿审核 | 登录自己的 GitCode / GitHub 私人令牌 → 选公开插件仓 → 宿主代提 PR → 维护者审核合并后才进商店 |

私人令牌只在本次请求里用，不写入仓库。待审核列表会显示生态仓未合并的 PR。

## 收录

生态仓根目录 `catalog.json` 是清单。条目可以：

- 指向本仓内 `packs/...`（官方示例）
- 指向别人的 git 仓（社区包）

可选字段 `heat`：基础热度；本机每下载一次会再加本地计数。

投稿说明见生态仓 [CONTRIBUTING.md](https://gitcode.com/fengyunnb_admin/fengyun-nexus-ecosystem/blob/main/CONTRIBUTING.md)（GitHub 镜像同步）。

## 和「插件包」文档的关系

写法与菜单约定见 [插件包](plugin-packs.md)；本页只说明**线上收录与商店流程**。
