# Fengyun Nexus · 系统插件包

这是**插件包**，不是单个插件：里面多份能力互相照应，可组合使用。装进宿主 `plugins/` 后分别加载。

专仓：https://gitcode.com/fengyunnb_admin/fengyun-system-plugins

包说明见 `nexus.pack.json`。写法可混用简单 `index.ts` 与模块化目录。

## 包含

| 目录 | 本插件菜单 | 说明 |
|------|------------|------|
| `plugins/z-menu` | `#菜单` `#帮助` | 框架菜单：电源 / 更新 / 状态 |
| `plugins/z-status` | `#状态` | 运行状态图 |
| `plugins/z-draw` | `#生图菜单` `#生图` | 系统截图发群 |
| `plugins/z-echo` | `#回声菜单` `#echo` | 回声示例 |
| `plugins/z-like` | `#点赞菜单` `#赞我` | 点赞；触发词可不用 # |
| `plugins/z-group-admin` | `#群管` `#群管菜单` | 踢 / 禁言 / 公告 / 文件 |
| `plugins/z-group-notice` | `#进退群菜单` | 进退群通知 |
| `plugins/z-master` | `#主人菜单` | 核心 / 新 / 普通主人 |
| `plugins/z-media-parse` | `#抖音登录` | 抖音/快手短链自动解析；过大改群文件 |
| `plugins/z-exec` | `#执行菜单` `#py` `#sh` | 主人执行多语言命令；危险二次确认 |
| `plugins/z-all-speak` | `#全部发言` `#全部发言菜单` | 按日汇总某人发言并合并转发 |
| `plugins/z-recall` | `#撤回` `#撤回菜单` | 主人引用消息撤回；按机器人群职权 |
| （网关） | `#完整返回` `#完整返回菜单` | 主人：AI 思考+回话原文直发，只打码机密 |

## 组合

- 主人 + 群管：踢禁认通道主人
- 主人 + 点赞：主客不同回复
- 群管 + 进退群：权限与欢迎分开
- 命令执行：环境配置登记语言后，主人可用 #py / #sh 等
- 框架菜单收录影链说明；影链业务指令仅 `#抖音登录`
- 影链：群内短链自动解析，图文 BGM 发语音条

## 更新

宿主主人指令：

- `#更新` / `#更新插件` — 拉框架仓与本插件专仓
- 有一方更新：说明改动后同窗口重启
- 都最新：只回执

专仓地址在宿主 `configs/registry.json` 的 `pluginsRepo`，控制台不可改。

## 截图

```ts
const shot = await ctx.shot.renderMenu({ title: "群管菜单", sections: […] });
if (shot.ok) await e.replyImage(shot.pngPath);
```

`e.replyImage` 只发图。浏览器在宿主「环境配置」安装。

## 发布

```bash
pnpm pack:system-plugins
cd packs/fengyun-system-plugins
git add . && git commit -m "系统插件包更新" && git push
```
