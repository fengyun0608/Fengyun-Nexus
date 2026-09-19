# Fengyun Nexus · 系统插件包

菜单 / 状态 / 生图 / 回声 / 点赞 / 群管 / 进退群 / 主人。放到宿主 `plugins/` 下即可加载。

专仓：https://gitcode.com/fengyunnb_admin/fengyun-system-plugins

## 包含

| 目录 | 指令 | 说明 |
|------|------|------|
| `plugins/z-menu` | `#菜单` `#帮助` | 分类菜单，两个词同一张图 |
| `plugins/z-status` | `#状态` | 账号卡、曲线、运行明细（不露群号与库路径） |
| `plugins/z-draw` | `#生图` | 菜单图截图发群 |
| `plugins/z-echo` | `#echo 文本` | 回声示例 |
| `plugins/z-like` | `#赞我` | 点赞；触发词不用 # |
| `plugins/z-group-admin` | `#踢` `#禁言` `#群公告` `#群文件` | 群管 |
| `plugins/z-group-notice` | 进群 / 退群自动说一声 | 进退群通知 |
| `plugins/z-master` | `#添加主人` | 核心 / 新 / 普通主人 |

## 更新

宿主管理指令（主人）：

- `#更新` / `#更新插件` — 拉**框架仓**与**本插件专仓**
- 框架或系统插件**有一方有更新**：说明改了啥，然后同窗口重启
- 两边都最新：只回执，不重启

专仓地址写在宿主发行配置 `configs/registry.json` 的 `pluginsRepo`，**控制台不可改**。

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

宿主产品介绍与致谢见 [Fengyun-Nexus README](https://gitcode.com/fengyunnb_admin/Fengyun-Nexus)。
