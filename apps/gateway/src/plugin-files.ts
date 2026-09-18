/**
 * 本机开发用：读写 plugins/ 下源码，供控制台在线编辑。
 * 路径限制在 plugins/ 内，禁止 .. 逃逸。
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { docLink } from "./docs-serve.js";

const TEXT_EXT = new Set([
  ".ts",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".txt",
  ".css",
  ".html",
  ".yaml",
  ".yml",
]);

function pluginsRoot(root: string): string {
  return resolve(join(root, "plugins"));
}

function safeResolve(root: string, rel: string): string | null {
  const base = pluginsRoot(root);
  const cleaned = rel.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!cleaned || cleaned.includes("\0") || cleaned.split("/").includes("..")) {
    return null;
  }
  const abs = resolve(join(base, cleaned));
  const relTo = relative(base, abs);
  if (relTo.startsWith("..") || resolve(abs) === resolve(base) && cleaned.includes("..")) {
    return null;
  }
  if (!abs.startsWith(base + sep) && abs !== base) return null;
  return abs;
}

export function listPluginDirs(root: string): Array<{
  id: string;
  dir: string;
  hasIndex: boolean;
  /** 是否走 plugin/*.ts 模块化加载 */
  modular: boolean;
  /** 已有的分目录 */
  layout: string[];
  name?: string;
  version?: string;
  author?: string;
  description?: string;
  category?: string;
}> {
  const base = pluginsRoot(root);
  if (!existsSync(base)) return [];
  const layoutNames = [
    "adapter",
    "plugin",
    "workflow",
    "http",
    "events",
    "commonconfig",
    "www",
  ];
  return readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith(".") && d.name !== "templates")
    .map((d) => {
      const dir = d.name;
      const abs = join(base, dir);
      const indexTs = join(abs, "index.ts");
      const indexJs = join(abs, "index.js");
      const hasIndex = existsSync(indexTs) || existsSync(indexJs);
      const pluginDir = join(abs, "plugin");
      const modular =
        !hasIndex && existsSync(pluginDir) && statSync(pluginDir).isDirectory();
      const layout = layoutNames.filter((n) => {
        const p = join(abs, n);
        return existsSync(p) && statSync(p).isDirectory();
      });
      let id = dir;
      let name: string | undefined;
      let version: string | undefined;
      let author: string | undefined;
      let description: string | undefined;
      let category: string | undefined;
      const manPath = join(abs, "nexus.plugin.json");
      if (existsSync(manPath)) {
        try {
          const j = JSON.parse(readFileSync(manPath, "utf8")) as Record<string, unknown>;
          if (j.id) id = String(j.id);
          if (typeof j.name === "string") name = j.name;
          if (typeof j.version === "string") version = j.version;
          if (typeof j.author === "string") author = j.author;
          if (typeof j.description === "string") description = j.description;
          if (typeof j.category === "string") category = j.category;
        } catch {
          /* ignore */
        }
      }
      return { id, dir, hasIndex, modular, layout, name, version, author, description, category };
    });
}

export function listPluginFiles(
  root: string,
  pluginDir: string,
): Array<{ path: string; size: number }> {
  const abs = safeResolve(root, pluginDir);
  if (!abs || !existsSync(abs) || !statSync(abs).isDirectory()) return [];
  const out: Array<{ path: string; size: number }> = [];
  const walk = (dir: string, prefix: string) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === "node_modules" || ent.name.startsWith(".")) continue;
      const p = join(dir, ent.name);
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(p, rel);
      else {
        const ext = ent.name.includes(".") ? ent.name.slice(ent.name.lastIndexOf(".")) : "";
        if (!TEXT_EXT.has(ext)) continue;
        out.push({ path: `${pluginDir}/${rel}`.replace(/\\/g, "/"), size: statSync(p).size });
      }
    }
  };
  walk(abs, "");
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export function readPluginFile(
  root: string,
  relPath: string,
): { ok: true; path: string; content: string } | { ok: false; error: string } {
  const abs = safeResolve(root, relPath);
  if (!abs || !existsSync(abs) || !statSync(abs).isFile()) {
    return { ok: false, error: "文件不存在或路径非法" };
  }
  const ext = abs.slice(abs.lastIndexOf("."));
  if (!TEXT_EXT.has(ext)) return { ok: false, error: "不支持的文件类型" };
  if (statSync(abs).size > 800_000) return { ok: false, error: "文件过大" };
  return {
    ok: true,
    path: relPath.replace(/\\/g, "/"),
    content: readFileSync(abs, "utf8"),
  };
}

export function writePluginFile(
  root: string,
  relPath: string,
  content: string,
): { ok: true; path: string } | { ok: false; error: string } {
  const abs = safeResolve(root, relPath);
  if (!abs) return { ok: false, error: "路径非法" };
  const ext = abs.slice(abs.lastIndexOf("."));
  if (!TEXT_EXT.has(ext)) return { ok: false, error: "不支持的文件类型" };
  if (content.length > 800_000) return { ok: false, error: "内容过大" };
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, "utf8");
  return { ok: true, path: relPath.replace(/\\/g, "/") };
}

export function scaffoldPluginGuide(root: string): {
  pluginsDir: string;
  templateDir: string;
  docs: Array<{ title: string; path: string; url: string }>;
  steps: string[];
} {
  const pluginsDir = pluginsRoot(root);
  const templateDir = join(pluginsDir, "templates", "ts-plugin");
  const docs = [
    docLink("插件编写教程", "docs/ecosystem/plugins.md"),
    docLink("通道插件教程", "docs/ecosystem/channel-plugins.md"),
    docLink("简单示例模板", "plugins/templates/ts-plugin"),
    docLink("模块化示例模板", "plugins/templates/modular-plugin"),
  ];
  return {
    pluginsDir,
    templateDir: existsSync(templateDir) ? templateDir : pluginsDir,
    docs,
    steps: [
      `本地插件目录：${pluginsDir}`,
      "控制台「创建本地插件」会生成目录与骨架",
      "manifest.id 用英文；name / author / version 给人看",
      "点文档链接在新窗口打开教程与示例，改完保存后热重载",
      "群里用 #帮助 或你的指令验证",
    ],
  };
}

function slugDir(id: string): string {
  const s = id
    .trim()
    .replace(/^@[^/]+\//, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^\.+/, "")
    .replace(/-+/g, "-");
  return s || "local-plugin";
}

export type CreateLocalPluginInput = {
  id: string;
  name: string;
  version?: string;
  author?: string;
  description?: string;
  kind?: "framework" | "channel";
};

export function createLocalPlugin(
  root: string,
  input: CreateLocalPluginInput,
):
  | {
      ok: true;
      id: string;
      dir: string;
      path: string;
      docs: Array<{ title: string; path: string; url: string }>;
      message: string;
    }
  | { ok: false; error: string } {
  const id = String(input.id || "").trim();
  const name = String(input.name || "").trim();
  if (!/^[a-z][a-z0-9._-]*$/i.test(id)) {
    return { ok: false, error: "插件 id 须为英文：字母开头，仅 a-z 0-9 . _ -" };
  }
  if (!name) return { ok: false, error: "请填写插件名称" };
  const dir = slugDir(id);
  const base = pluginsRoot(root);
  const abs = join(base, dir);
  if (existsSync(abs)) {
    return { ok: false, error: `目录已存在：plugins/${dir}` };
  }
  const version = String(input.version || "0.1.0").trim() || "0.1.0";
  const author = String(input.author || "").trim();
  const description = String(input.description || "").trim() || "本地插件";
  const kind = input.kind === "channel" ? "channel" : "framework";
  const adapterScope = kind === "framework" ? "all" : "specified";
  const cmd = id.includes(".") ? id.split(".").pop()! : id;

  mkdirSync(abs, { recursive: true });
  const man = {
    id,
    name,
    version,
    author: author || undefined,
    description,
    main: "index.ts",
    priority: 2000,
    hooks: ["onMessage", "onReady"],
    permissions: ["channel.send"],
    category: "local",
    kind,
    adapterScope,
  };
  writeFileSync(join(abs, "nexus.plugin.json"), `${JSON.stringify(man, null, 2)}\n`, "utf8");
  writeFileSync(
    join(abs, "package.json"),
    `${JSON.stringify(
      {
        name: `@local/${dir}`,
        version,
        private: true,
        type: "module",
        dependencies: { "@fengyun/nexus-plugin-sdk": "workspace:*" },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  writeFileSync(
    join(abs, "README.md"),
    `# ${name}

本地插件骨架。请先阅读：

- \`docs/ecosystem/plugins.md\`
- \`docs/ecosystem/channel-plugins.md\`
- 模板：\`plugins/templates/ts-plugin\` / \`plugins/templates/modular-plugin\`

目录：\`plugins/${dir}\`

改完保存后热重载即可；群里用 \`#${cmd} 你好\` 试一下。

控制台里的「编写文档」是可点击链接，会在新窗口打开教程与示例模板。
`,
    "utf8",
  );
  const className =
    "Z" +
    dir
      .split(/[._-]+/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join("") +
    "Plugin";
  writeFileSync(
    join(abs, "index.ts"),
    `import { Plugin, type NexusEvent, type PluginContext } from "@fengyun/nexus-plugin-sdk";

/** 本地插件：${name} */
export class ${className} extends Plugin {
  manifest = {
    id: ${JSON.stringify(id)},
    name: ${JSON.stringify(name)},
    version: ${JSON.stringify(version)},
    ${author ? `author: ${JSON.stringify(author)},` : ""}
    description: ${JSON.stringify(description)},
    priority: 2000,
    category: "local" as const,
    kind: ${JSON.stringify(kind)} as const,
    adapterScope: ${JSON.stringify(adapterScope)} as const,
    permissions: ["channel.send" as const],
  };

  rule = [
    {
      reg: ${JSON.stringify("^#" + cmd + "\\s*(.*)$")},
      fnc: "hello",
      describe: ${JSON.stringify(name)},
    },
  ];

  async onReady(ctx: PluginContext) {
    ctx.log(${JSON.stringify(`${name} 就绪`)});
  }

  async hello(e: NexusEvent) {
    const m = e.msg.match(/^#${cmd}\\s*(.*)$/);
    const tip = (m?.[1] || "").trim();
    await e.reply(
      tip
        ? \`收到：\${tip}\`
        : ${JSON.stringify(`${name} 已响应。请看 docs/ecosystem/plugins.md 继续编写。`)},
    );
  }
}

export default new ${className}();
`,
    "utf8",
  );

  const guide = scaffoldPluginGuide(root);
  return {
    ok: true,
    id,
    dir,
    path: join("plugins", dir),
    docs: guide.docs,
    message: `已创建本地插件 plugins/${dir}，请按文档继续编写`,
  };
}

