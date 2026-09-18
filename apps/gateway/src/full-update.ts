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
    };
  }

  const nodes: string[] = [];
  const pluginDirs: string[] = [];
  let pluginsUpdated = false;
  let pluginError = "";

  // —— 框架 ——
  if (fw.updated) {
    pushNodes(
      nodes,
      `框架已更新到 ${fw.version || "?"}`,
      `${fw.beforeCommit || "?"} → ${fw.afterCommit || "?"}`,
    );
    const statLine = (fw.forwardNodes || []).find(
      (n) => n.includes("个文件") || n.includes("有改动") || n.includes("没改"),
    );
    pushNodes(nodes, statLine || "有改动，统计拿不到");
    if (fw.overwritten) pushNodes(nodes, "本地被远程盖掉了");
  } else {
    pushNodes(
      nodes,
      `框架已是最新 ${fw.version || "?"}`,
      fw.afterCommit ? `当前 ${fw.afterCommit}` : undefined,
    );
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
      if (need.length) {
        const applied = applyPluginUpdates(root, {
          pluginsRepoUrl: repoUrl,
          pluginsRepoBranch: opts?.pluginsRepoBranch || "main",
          dirs: need.map((i) => i.dir),
        });
        if (applied.applied.length) {
          pluginsUpdated = true;
          pluginDirs.push(...applied.applied);
          const labels = need
            .filter((i) => applied.applied.includes(i.dir))
            .map((i) => {
              const ver =
                i.remoteVersion && i.remoteVersion !== i.localVersion
                  ? ` ${i.localVersion || "?"}→${i.remoteVersion}`
                  : i.remoteVersion
                    ? ` ${i.remoteVersion}`
                    : "";
              return `${i.name || i.id || i.dir}${ver}`;
            });
          pushNodes(nodes, "系统插件已更新", labels.join("\n"));
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
          names.length ? names.join("、") : undefined,
        );
      }
    } catch (e) {
      pluginError = e instanceof Error ? e.message : String(e);
      pushNodes(nodes, "系统插件更新失败", pluginError);
    }
  } else if (fw.updated) {
    pushNodes(nodes, "系统插件随框架目录对齐");
  }

  const anyUpdated = Boolean(fw.updated) || pluginsUpdated;
  if (anyUpdated) pushNodes(nodes, "正在重启");

  const reportText = nodes.join("\n\n");
  const bits: string[] = [];
  if (fw.updated) bits.push("框架");
  if (pluginsUpdated) bits.push(`插件（${pluginDirs.join("、") || "已拉"}）`);
  const message = anyUpdated
    ? `已更新：${bits.join(" + ")}，正在重启`
    : pluginError
      ? `框架已是最新；插件异常：${pluginError}`
      : `已是最新 ${fw.version || ""}`;

  return {
    ok: Boolean(fw.ok) && !(pluginError && !anyUpdated),
    message,
    reportText,
    forwardNodes: nodes,
    version: fw.version,
    updated: anyUpdated,
    shouldExit: anyUpdated,
    overwritten: fw.overwritten,
    beforeCommit: fw.beforeCommit,
    afterCommit: fw.afterCommit,
    frameworkUpdated: Boolean(fw.updated),
    pluginsUpdated,
    pluginDirs,
    error: pluginError || fw.error,
  };
}
