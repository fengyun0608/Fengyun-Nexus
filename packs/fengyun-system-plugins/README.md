# Fengyun Nexus · 系统插件包

菜单 / 生图 / 回声。放到宿主 `plugins/` 下即可加载。

## 包含

| 目录 | 指令 | 说明 |
|------|------|------|
| `plugins/z-menu` | `#菜单` | 菜单图（系统截图） |
| `plugins/z-draw` | `#生图` | 同上，显式生图指令 |
| `plugins/z-echo` | `#echo 文本` | 回声示例 |

## 截图规范

截图由**宿主系统**提供，插件只调：

```ts
const shot = await ctx.shot.renderMenu({ title: "功能菜单", lines: ["#帮助", "#状态"] });
if (shot.ok) await e.replyImage(pathToFileURL(shot.pngPath).href);
// 任意 HTML：ctx.shot.renderHtml({ html, selector: "#shot" })
```

- `e.replyImage` **只发图**，不要旁文。
- 浏览器运行时在宿主控制台「环境配置」安装，插件不要再装 Playwright。

## 发布到另一个仓库

本目录即是完整包。在空仓库根目录：

```bash
# 在 Fengyun-Nexus 里生成
pnpm pack:system-plugins
# 或指定输出路径
node scripts/export-system-plugin-pack.mjs /path/to/your-plugins-repo

cd packs/fengyun-system-plugins   # 或你的目标路径
git init
git add .
git commit -m "系统插件包：菜单 / 生图 / 回声"
git remote add origin <你的仓库 URL>
git push -u origin main
```

宿主 `configs/registry.json` 的 `pluginsRepo.url` 填该仓地址即可做远程一致性检测。
