/**
 * 抽出系统插件包到 packs/fengyun-system-plugins，方便推到另一个仓库发布。
 * 用法：pnpm pack:system-plugins
 * 可选：node scripts/export-system-plugin-pack.mjs D:\path\to\other-repo
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLUGINS = [
  "z-menu",
  "z-status",
  "z-draw",
  "z-echo",
  "z-like",
  "z-group-admin",
  "z-group-notice",
  "z-master",
];
const SKIP = new Set(["node_modules", "dist", ".git"]);

const outArg = process.argv[2];
const outRoot = outArg
  ? resolve(outArg)
  : join(ROOT, "packs", "fengyun-system-plugins");

function copyPlugin(name, destBase) {
  const src = join(ROOT, "plugins", name);
  const dest = join(destBase, "plugins", name);
  if (!existsSync(src)) {
    console.warn(`跳过：找不到 ${src}`);
    return;
  }
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, {
    recursive: true,
    filter: (p) => {
      const base = p.split(/[/\\]/).pop() ?? "";
      return !SKIP.has(base);
    },
  });
  const pkgPath = join(dest, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    pkg.private = false;
    pkg.dependencies = {
      "@fengyun/nexus-plugin-sdk": pkg.dependencies?.["@fengyun/nexus-plugin-sdk"] ?? "*",
    };
    delete pkg.devDependencies;
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  }
  const shot = join(dest, "screenshot.ts");
  if (existsSync(shot) && name === "z-draw") {
    rmSync(shot, { force: true });
  }
}

if (existsSync(outRoot)) {
  for (const name of readdirSync(outRoot)) {
    if (name === ".git") continue;
    rmSync(join(outRoot, name), { recursive: true, force: true });
  }
} else {
  mkdirSync(outRoot, { recursive: true });
}
mkdirSync(join(outRoot, "plugins"), { recursive: true });

for (const name of PLUGINS) {
  copyPlugin(name, outRoot);
}

const packMeta = {
  id: "fengyun.system",
  name: "系统插件包",
  version: "0.2.0",
  description:
    "Fengyun Nexus 官方系统插件包。包内插件互相配合：主人管权限，群管认主人，进退群管欢迎，点赞分主客文案。框架菜单只管电源/更新/状态；各功能插件自带菜单。",
  kind: "pack",
  writingStyles: ["simple-index", "modular-dirs", "mixed"],
  plugins: [
    { dir: "plugins/z-menu", id: "z.menu", menu: ["#菜单", "#帮助"] },
    { dir: "plugins/z-status", id: "z.status", menu: ["#状态"] },
    { dir: "plugins/z-draw", id: "z.draw", menu: ["#生图菜单", "#生图"] },
    { dir: "plugins/z-echo", id: "z.echo", menu: ["#回声菜单", "#echo"] },
    { dir: "plugins/z-like", id: "z.like", menu: ["#点赞菜单", "#赞我"] },
    { dir: "plugins/z-group-admin", id: "z.group.admin", menu: ["#群管", "#群管菜单"] },
    { dir: "plugins/z-group-notice", id: "z.group.notice", menu: ["#进退群菜单"] },
    { dir: "plugins/z-master", id: "z.master", menu: ["#主人菜单"] },
  ],
  combos: [
    "主人管理 + 群管：踢禁等指令认通道主人级别",
    "主人管理 + 点赞：主人与普通人不同回复",
    "群管 + 进退群：权限与欢迎语分开，可同装",
    "菜单 + 生图：截图同一套视觉壳",
  ],
};

writeFileSync(join(outRoot, "nexus.pack.json"), `${JSON.stringify(packMeta, null, 2)}\n`, "utf8");

const readme = `# Fengyun Nexus · 系统插件包

这是**插件包**，不是单个插件：里面多份能力互相照应，可组合使用。装进宿主 \`plugins/\` 后分别加载。

专仓：https://gitcode.com/fengyunnb_admin/fengyun-system-plugins

包说明见 \`nexus.pack.json\`。写法可混用简单 \`index.ts\` 与模块化目录。

## 包含

| 目录 | 本插件菜单 | 说明 |
|------|------------|------|
| \`plugins/z-menu\` | \`#菜单\` \`#帮助\` | 框架菜单：电源 / 更新 / 状态 |
| \`plugins/z-status\` | \`#状态\` | 运行状态图 |
| \`plugins/z-draw\` | \`#生图菜单\` \`#生图\` | 系统截图发群 |
| \`plugins/z-echo\` | \`#回声菜单\` \`#echo\` | 回声示例 |
| \`plugins/z-like\` | \`#点赞菜单\` \`#赞我\` | 点赞；触发词可不用 # |
| \`plugins/z-group-admin\` | \`#群管\` \`#群管菜单\` | 踢 / 禁言 / 公告 / 文件 |
| \`plugins/z-group-notice\` | \`#进退群菜单\` | 进退群通知 |
| \`plugins/z-master\` | \`#主人菜单\` | 核心 / 新 / 普通主人 |

## 组合

- 主人 + 群管：踢禁认通道主人
- 主人 + 点赞：主客不同回复
- 群管 + 进退群：权限与欢迎分开
- 框架菜单不收录业务指令；各插件自己出菜单图

## 更新

宿主主人指令：

- \`#更新\` / \`#更新插件\` — 拉框架仓与本插件专仓
- 有一方更新：说明改动后同窗口重启
- 都最新：只回执

专仓地址在宿主 \`configs/registry.json\` 的 \`pluginsRepo\`，控制台不可改。

## 截图

\`\`\`ts
const shot = await ctx.shot.renderMenu({ title: "群管菜单", sections: […] });
if (shot.ok) await e.replyImage(pathToFileURL(shot.pngPath).href);
\`\`\`

\`e.replyImage\` 只发图。浏览器在宿主「环境配置」安装。

## 发布

\`\`\`bash
pnpm pack:system-plugins
cd packs/fengyun-system-plugins
git add . && git commit -m "系统插件包更新" && git push
\`\`\`
`;

writeFileSync(join(outRoot, "README.md"), readme, "utf8");
writeFileSync(
  join(outRoot, "package.json"),
  `${JSON.stringify(
    {
      name: "fengyun-system-plugins",
      version: "0.2.0",
      private: true,
      description: "Fengyun Nexus 系统插件包（菜单 / 状态 / 生图 / 点赞 / 群管 / 进退群 / 主人）",
      license: "MIT",
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`已导出系统插件包 → ${outRoot}`);
console.log(`包含：${PLUGINS.join(", ")}`);
