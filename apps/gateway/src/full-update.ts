/**
 * #更新：框架仓 + 系统插件专仓（若已配置）一并拉齐。
 * 任一方有更新 → 合并转发说明改了啥 → 同窗口重启。
 */
import { applyRemoteUpdate, type UpdateApplyResult } from "./update-check.js";
import { applyPluginUpdates, checkPluginUpdates } from "./registry-check.js";

export type FullUpdateOpts = {
  pluginsRepoUrl?: string;
  pluginsRepoBranch?: string;
};

export type FullUpdateResult = UpdateApplyResult & {
  frameworkUpdated?: boolean;
  pluginsUpdated?: boolean;
  pluginDirs?: string[];
  /** 给人看的更新摘要（重启成功回执复用） */
  updateSummary?: string[];
};

/** 拆成多条转发节点，群里展开能看到一段段说明 */
function pushNodes(out: string[], ...parts: Array<string | undefined | false>) {
  for (const p of parts) {
    if (!p) continue;
    const t = String(p).trim();
    if (t) out.push(t);
  }
}

export function applyFullUpdate(
  root: string,
  opts?: FullUpdateOpts,
): FullUpdateResult {
  const fw = applyRemoteUpdate(root);
  if (!fw.ok) {
    return {
      ...fw,
      frameworkUpdated: false,
      pluginsUpdated: false,
      updateSummary: [],
    };
  }

  const nodes: string[] = [];
  const pluginDirs: string[] = [];
  const updateSummary: string[] = [];
  let pluginsUpdated = false;
  let pluginError = "";

  // —— 框架 ——
  if (fw.updated) {
    pushNodes(nodes, ...(fw.forwardNodes || []).filter((n) => !/^下一步/.test(n)));
    for (const item of fw.changeItems || []) {
      updateSummary.push(`框架：${item}`);
    }
    if (!(fw.changeItems || []).length) {
      updateSummary.push(`框架 ${fw.version || "?"}`);
    }
  } else {
    pushNodes(nodes, `框架已是最新`, `版本 ${fw.version || "?"}`);
  }

  // —— 系统插件专仓 ——
  const repoUrl = String(opts?.pluginsRepoUrl || "").trim();
  if (repoUrl) {
    try {
      const before = checkPluginUpdates(root, {
        pluginsRepoUrl: repoUrl,
        pluginsRepoBranch: opts?.pluginsRepoBranch || "main",
      });
      const need = before.items.filter(
        (i) => i.status === "update" || i.status === "remote-only",
      );
      const older = before.items.filter((i) => i.status === "local-newer");
      if (older.length) {
        pushNodes(
          nodes,
          "远端更旧，已跳过",
          older
            .map((i) => `${i.name || i.id || i.dir} 本地 ${i.localVersion} / 远端 ${i.remoteVersion}`)
            .join("\n"),
        );
      }
      if (need.length) {
        const beforeFp = new Map(
          need.map((i) => [i.dir, i.localFingerprint || ""]),
        );
        const applied = applyPluginUpdates(root, {
          pluginsRepoUrl: repoUrl,
          pluginsRepoBranch: opts?.pluginsRepoBranch || "main",
          dirs: need.map((i) => i.dir),
        });
        if (applied.applied.length) {
          // 再比对一次：源码指纹没变就不算更新、不重启
          const after = checkPluginUpdates(root, {
            pluginsRepoUrl: repoUrl,
            pluginsRepoBranch: opts?.pluginsRepoBranch || "main",
          });
          const changed = applied.applied.filter((dir) => {
            const item = after.items.find((i) => i.dir === dir);
            return (item?.localFingerprint || "") !== (beforeFp.get(dir) || "");
          });
          if (changed.length) {
            pluginsUpdated = true;
            pluginDirs.push(...changed);
            const labels = need
              .filter((i) => changed.includes(i.dir))
              .map((i) => {
                const name = i.name || i.id || i.dir;
                if (i.remoteVersion && i.localVersion && i.remoteVersion !== i.localVersion) {
                  return `${name} ${i.localVersion}→${i.remoteVersion}`;
                }
                if (i.status === "remote-only") {
                  return `${name}（新装 ${i.remoteVersion || "?"}）`;
                }
                return `${name} ${i.remoteVersion || i.localVersion || ""} 内容有变`.trim();
              });
            pushNodes(
              nodes,
              `系统插件已更新（${labels.length} 个）`,
              labels.map((l, i) => `${i + 1}. ${l}`).join("\n"),
            );
            for (const l of labels) updateSummary.push(`插件：${l}`);
          } else {
            pushNodes(nodes, "系统插件已是最新（远端有提示但指纹未变，跳过）");
          }
        }
        if (applied.failed.length) {
          pluginError = applied.failed.map((f) => `${f.dir}：${f.error}`).join("\n");
          pushNodes(nodes, "插件拉取失败", pluginError);
        }
      } else {
        const names = before.items.map((i) => i.name || i.id || i.dir);
        pushNodes(
          nodes,
          "系统插件已是最新",
          names.length ? `已核对：${names.join("、")}` : undefined,
        );
      }
    } catch (e) {
      pluginError = e instanceof Error ? e.message : String(e);
      pushNodes(nodes, "系统插件更新失败", pluginError);
    }
  } else if (fw.updated) {
    pushNodes(nodes, "系统插件\n未配置专仓地址，本次只更新了框架");
  }

  const anyUpdated = Boolean(fw.updated) || pluginsUpdated;
  const nextStep = fw.updated
    ? pluginsUpdated
      ? "即将重启以加载新版本和新插件"
      : "即将重启以加载新版本"
    : "即将重启以加载新插件";
  if (anyUpdated) {
    pushNodes(nodes, ["下一步", nextStep].join("\n"));
  } else {
    pushNodes(nodes, "结果\n全部已是最新，无需重启");
  }

  const reportText = nodes.join("\n\n");
  const bits: string[] = [];
  if (fw.updated) bits.push(`框架 ${fw.version || ""}`);
  if (pluginsUpdated) bits.push(`插件 ${pluginDirs.length} 个`);
  let message: string;
  if (anyUpdated) {
    const highlights = updateSummary.slice(0, 5);
    const more =
      updateSummary.length > 5 ? `\n…另有 ${updateSummary.length - 5} 条` : "";
    message = [
      `更新完成：${bits.join(" + ")}`,
      highlights.length ? `变更要点：\n${highlights.map((h) => `· ${h}`).join("\n")}${more}` : "",
      nextStep,
    ]
      .filter(Boolean)
      .join("\n");
  } else if (pluginError) {
    message = `框架已是最新；插件异常：\n${pluginError}`;
  } else {
    message = `已是最新 ${fw.version || ""}，无需重启`;
  }

  return {
    ok: Boolean(fw.ok) && !(pluginError && !anyUpdated),
    message,
    reportText,
    forwardNodes: nodes,
    version: fw.version,
    updated: anyUpdated,
    /** 只有框架或插件源码真有变化才重启 */
    shouldExit: anyUpdated,
    overwritten: fw.overwritten,
    beforeCommit: fw.beforeCommit,
    afterCommit: fw.afterCommit,
    changeItems: updateSummary,
    frameworkUpdated: Boolean(fw.updated),
    pluginsUpdated,
    pluginDirs,
    updateSummary,
    error: pluginError || fw.error,
  };
}
