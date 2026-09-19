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
| `plugins/z-master` | `#主人菜单` 说明 · `#主人列表` 只读 | 增减主人只在网页控制台通道设置 |

## 组合

- 主人 + 群管：踢禁认通道主人
- 主人 + 点赞：主客不同回复
- 群管 + 进退群：权限与欢迎分开
- 框架菜单不收录业务指令；各插件自己出菜单图

## 更新

宿主主人指令：

- `#更新` / `#更新插件` — 拉框架仓与本插件专仓
- 有一方更新：说明改动后同窗口重启
- 都最新：只回执

专仓地址在宿主 `configs/registry.json` 的 `pluginsRepo`，控制台不可改。

## 截图

```ts
const shot = await ctx.shot.renderMenu({ title: "群管菜单", sections: […] });
if (shot.ok) await e.replyImage(pathToFileURL(shot.pngPath).href);
```

`e.replyImage` 只发图。浏览器在宿主「环境配置」安装。

## 发布

```bash
pnpm pack:system-plugins
cd packs/fengyun-system-plugins
git add . && git commit -m "系统插件包更新" && git push
```
