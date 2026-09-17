#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const [cmd, sub, ...rest] = process.argv.slice(2);

function help() {
  console.log(`Fengyun Nexus CLI

Usage:
  nexus create plugin <name>
  nexus env <mobile|desktop|server>
  nexus registry show
`);
}

function createPlugin(name: string) {
  const id = name.trim() || "my-plugin";
  const dir = resolve(process.cwd(), "plugins", "local", id);
  if (existsSync(dir)) {
    console.error("exists:", dir);
    process.exit(1);
  }
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(
    join(dir, "nexus.plugin.json"),
    JSON.stringify(
      {
        id: `local.${id}`,
        name: id,
        version: "0.1.0",
        main: "src/index.ts",
        hooks: ["onMessage", "onReady"],
        permissions: ["channel.send"],
        category: "local",
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(dir, "src/index.ts"),
    `import { definePlugin } from "@fengyun/nexus-plugin-sdk";
import { newId, nowIso } from "@fengyun/nexus-shared";

export default definePlugin({
  manifest: {
    id: "local.${id}",
    name: "${id}",
    version: "0.1.0",
    hooks: ["onMessage"],
    permissions: ["channel.send"],
    category: "local",
  },
  onMessage(msg) {
    if (!msg.content.startsWith("/${id} ")) return null;
    return {
      id: newId("msg"),
      channel: msg.channel,
      chatId: msg.chatId,
      userId: "plugin:${id}",
      type: "text",
      content: msg.content.slice(${id.length + 2}),
      meta: { replyTo: msg.id },
      createdAt: nowIso(),
    };
  },
});
`,
  );
  console.log("created", dir);
}

function showRegistry() {
  const root = resolve(process.cwd());
  const local = join(root, "configs/registry.local.json");
  const def = join(root, "configs/registry.json");
  const file = existsSync(local) ? local : def;
  console.log(readFileSync(file, "utf8"));
}

if (!cmd || cmd === "help" || cmd === "-h") {
  help();
} else if (cmd === "create" && sub === "plugin") {
  createPlugin(rest[0] ?? "my-plugin");
} else if (cmd === "env") {
  const id = rest[0] ?? "desktop";
  console.log(`Set NEXUS_ENV=${id} then restart gateway.`);
} else if (cmd === "registry" && sub === "show") {
  showRegistry();
} else {
  help();
  process.exit(1);
}
