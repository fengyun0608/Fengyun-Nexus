# 插件包模板

复制本目录到仓库外或 `packs/你的包名/`，再往 `plugins/` 里加多个插件。

## 插件包 ≠ 单插件

| | 单插件 | 插件包 |
|--|--------|--------|
| 目录 | `plugins/一个夹子` | 包根 + 多个 `plugins/*` |
| 菜单 | 自己画一张 | 每个功能插件各自菜单；包只说明组合 |
| 关系 | 独立能力 | 功能互相照应，可组合 |
| 更新 | 可单独更 | 专仓整包更新更合适 |

宿主扫描的是装进 `plugins/` 的各个插件目录；包是发布与组合的单位。

## 包根

```text
your-pack/
  nexus.pack.json     # 包说明：含哪些插件、菜单词、组合关系
  README.md
  package.json
  plugins/
    feature-a/        # 简单：根 index.ts
    feature-b/        # 模块化：plugin/ adapter/ workflow/ …
```

`nexus.pack.json` 给人看与给文档用；加载仍靠各插件自己的 `nexus.plugin.json`。

## 写法可以混用

同一个包里允许：

1. **简单插件**：根目录 `index.ts` + `nexus.plugin.json`
2. **模块化插件**：无根 index，规则在 `plugin/*.ts`，可选 `adapter/` `workflow/` `http/` `events/` `www/`
3. **混合**：有的简单、有的模块化

## 每个功能插件要有菜单

```ts
rule = [
  { reg: "^#某某菜单$", fnc: "menu", describe: "某某菜单" },
  // …业务指令
];

async menu(e, ctx) {
  const shot = await ctx.shot.renderMenu({
    title: "某某菜单",
    sections: [{ title: "用法", lines: ["#某某 …"] }],
  });
  if (shot.ok) await e.replyImage(pathToFileURL(shot.pngPath).href);
}
```

框架 `#菜单` 只收电源 / 更新 / 状态，不收录包内业务指令。

## 组合示例

- 主人 + 群管：踢禁认主人
- 主人 + 点赞：主客不同文案
- 群管 + 进退群：权限与欢迎分开

详见 [插件包说明](../../../docs/ecosystem/plugin-packs.md)。
