# Fengyun Nexus · 系统插件包

菜单 / 状态 / 生图 / 回声。放到宿主 `plugins/` 下即可加载。

专仓：https://gitcode.com/fengyunnb_admin/fengyun-system-plugins

## 包含

| 目录 | 指令 | 说明 |
|------|------|------|
| `plugins/z-menu` | `#菜单` | 菜单图（系统截图） |
| `plugins/z-status` | `#状态` | 框架 / 网络 / OneBot / AI / 群 |
| `plugins/z-draw` | `#生图` | 菜单图截图发群 |
| `plugins/z-echo` | `#echo 文本` | 回声示例 |

## 更新

宿主管理指令（主人）：

- `#更新` / `#更新插件` — 拉**框架仓**与**本插件专仓**
- 框架或系统插件**有一方有更新**：多群合并转发说明改了啥，然后同窗口重启
- 两边都最新：只回执，不重启

专仓地址默认：`configs/registry.json` → `pluginsRepo.url`。

## 截图与状态

```ts
const shot = await ctx.shot.renderMenu({ title: "功能菜单", lines: ["#帮助", "#状态"] });
if (shot.ok) await e.replyImage(pathToFileURL(shot.pngPath).href);

const lines = ctx.runtime.statusLines(); // 宿主注入的运行信息
```

- `e.replyImage` **只发图**，不要旁文。
- 浏览器运行时在宿主控制台「环境配置」安装。

## 发布

```bash
pnpm pack:system-plugins
cd packs/fengyun-system-plugins
git add . && git commit -m "系统插件包更新" && git push
```
