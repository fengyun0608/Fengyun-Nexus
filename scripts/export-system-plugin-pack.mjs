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
const PLUGINS = ["z-menu", "z-status", "z-draw", "z-echo"];
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
  // 发布仓不依赖 monorepo workspace；截图走宿主 ctx.shot
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
  // 去掉仅给 monorepo 用的 screenshot 再导出（发布包只保留 index）
  const shot = join(dest, "screenshot.ts");
  if (existsSync(shot) && name === "z-draw") {
    rmSync(shot, { force: true });
  }
}

// 清空输出目录但保留已有的 .git（方便反复 pack 后 push 专仓）
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

const readme = `# Fengyun Nexus · 系统插件包

菜单 / 状态 / 生图 / 回声。放到宿主 \`plugins/\` 下即可加载。

专仓：https://gitcode.com/fengyunnb_admin/fengyun-system-plugins

## 包含

| 目录 | 指令 | 说明 |
|------|------|------|
| \`plugins/z-menu\` | \`#菜单\` | 菜单图（系统截图） |
| \`plugins/z-status\` | \`#状态\` | 框架 / 网络 / OneBot / AI / 群 |
| \`plugins/z-draw\` | \`#生图\` | 菜单图截图发群 |
| \`plugins/z-echo\` | \`#echo 文本\` | 回声示例 |

## 更新

宿主管理指令（主人）：

- \`#更新\` / \`#更新插件\` — 拉**框架仓**与**本插件专仓**
- 框架或系统插件**有一方有更新**：多群合并转发说明改了啥，然后同窗口重启
- 两边都最新：只回执，不重启

专仓地址默认：\`configs/registry.json\` → \`pluginsRepo.url\`。

## 截图与状态

\`\`\`ts
const shot = await ctx.shot.renderMenu({ title: "功能菜单", lines: ["#帮助", "#状态"] });
if (shot.ok) await e.replyImage(pathToFileURL(shot.pngPath).href);

const lines = ctx.runtime.statusLines(); // 宿主注入的运行信息
\`\`\`

- \`e.replyImage\` **只发图**，不要旁文。
- 浏览器运行时在宿主控制台「环境配置」安装。

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
      version: "0.1.0",
      private: true,
      description: "Fengyun Nexus 系统插件包（菜单 / 生图 / 回声）",
      license: "MIT",
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`已导出系统插件包 → ${outRoot}`);
console.log(`包含：${PLUGINS.join(", ")}`);
