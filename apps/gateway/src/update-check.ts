import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type UpdateCheckResult = {
  ok: boolean;
  currentVersion: string;
  remoteVersion?: string;
  currentCommit?: string;
  remoteCommit?: string;
  updateAvailable: boolean;
  branch?: string;
  message: string;
  error?: string;
};

export type UpdateApplyResult = {
  ok: boolean;
  message: string;
  version?: string;
  error?: string;
  shouldExit?: boolean;
  updated?: boolean;
  beforeCommit?: string;
  afterCommit?: string;
  overwritten?: boolean;
  reportText?: string;
  forwardNodes?: string[];
};

function readLocalVersion(root: string): string {
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      version?: string;
    };
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function git(root: string, args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000,
    }).trim();
  } catch (e) {
    throw new Error(gitErr(e));
  }
}

function gitErr(e: unknown): string {
  if (!e || typeof e !== "object") return String(e);
  const x = e as { message?: string; stderr?: string | Buffer; stdout?: string | Buffer };
  const bits = [x.message, buf(x.stderr), buf(x.stdout)].filter(Boolean);
  return bits.join("\n").trim() || String(e);
}

function buf(v: string | Buffer | undefined): string {
  if (v == null) return "";
  return Buffer.isBuffer(v) ? v.toString("utf8") : String(v);
}

function parseVersionFromPackageJson(raw: string): string | undefined {
  try {
    const pkg = JSON.parse(raw) as { version?: string };
    return pkg.version;
  } catch {
    return undefined;
  }
}

function short(sha: string): string {
  return sha.slice(0, 7);
}

/** 更新回执：只报加减，不列提交/文件名 */
export function buildUpdateReport(opts: {
  version: string;
  updated: boolean;
  before: string;
  after: string;
  shortStat: string;
  overwritten: boolean;
}): { reportText: string; forwardNodes: string[]; message: string } {
  const { version, updated, before, after, shortStat, overwritten } = opts;
  const head = updated
    ? `已更新到 ${version}\n${short(before)} → ${short(after)}`
    : `已是最新 ${version}\n${short(after)}`;

  const statLine = updated
    ? shortStat || "有改动，统计拿不到"
    : "没有新东西";

  const forwardNodes = [head, statLine];
  if (overwritten) forwardNodes.push("本地被远程盖掉了");
  if (updated) forwardNodes.push("正在重启");

  const reportText = forwardNodes.join("\n\n");
  const message = updated
    ? `已更新到 ${version}，正在重启`
    : `已是最新 ${version}`;

  return { reportText, forwardNodes, message };
}

/** git shortstat →「3 个文件  +12  −4」 */
export function formatShortStat(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const files = s.match(/(\d+)\s+files?\s+changed/i);
  const ins = s.match(/(\d+)\s+insertions?\(\+\)/i);
  const del = s.match(/(\d+)\s+deletions?\(-\)/i);
  const nFiles = files ? Number(files[1]) : 0;
  const nIns = ins ? Number(ins[1]) : 0;
  const nDel = del ? Number(del[1]) : 0;
  if (!nFiles && !nIns && !nDel) return s;
  const bits = [`${nFiles || 0} 个文件`];
  if (nIns) bits.push(`+${nIns}`);
  if (nDel) bits.push(`-${nDel}`);
  if (!nIns && !nDel) bits.push("没改行数？");
  return bits.join("  ");
}

/** Compare local checkout with origin. */
export function checkRemoteUpdate(root: string): UpdateCheckResult {
  const currentVersion = readLocalVersion(root);
  try {
    const branch = git(root, ["rev-parse", "--abbrev-ref", "HEAD"]) || "main";
    const tracking = branch === "HEAD" ? "origin/main" : `origin/${branch}`;

    try {
      git(root, ["fetch", "origin", "--prune"]);
    } catch (e) {
      return {
        ok: false,
        currentVersion,
        updateAvailable: false,
        message: "无法连接远程仓库",
        error: e instanceof Error ? e.message : String(e),
      };
    }

    let currentCommit = "";
    let remoteCommit = "";
    try {
      currentCommit = git(root, ["rev-parse", "HEAD"]);
      remoteCommit = git(root, ["rev-parse", tracking]);
    } catch {
      remoteCommit = git(root, ["rev-parse", "origin/main"]);
      currentCommit = git(root, ["rev-parse", "HEAD"]);
    }

    let remoteVersion = currentVersion;
    try {
      const remotePkg = git(root, ["show", `${tracking}:package.json`]);
      remoteVersion = parseVersionFromPackageJson(remotePkg) || currentVersion;
    } catch {
      try {
        const remotePkg = git(root, ["show", "origin/main:package.json"]);
        remoteVersion = parseVersionFromPackageJson(remotePkg) || currentVersion;
      } catch {
        /* keep */
      }
    }

    const updateAvailable = Boolean(
      remoteCommit && currentCommit && remoteCommit !== currentCommit,
    );

    return {
      ok: true,
      currentVersion,
      remoteVersion,
      currentCommit: currentCommit.slice(0, 7),
      remoteCommit: remoteCommit.slice(0, 7),
      updateAvailable,
      branch,
      message: updateAvailable ? `发现新版本 ${remoteVersion}` : "已是最新",
    };
  } catch (e) {
    return {
      ok: false,
      currentVersion,
      updateAvailable: false,
      message: "校验失败",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** 对齐远程；有本地脏文件（比如 pnpm-lock）就硬拉，别卡在 pull */
export function applyRemoteUpdate(root: string): UpdateApplyResult {
  try {
    const before = git(root, ["rev-parse", "HEAD"]);
    const branch = git(root, ["rev-parse", "--abbrev-ref", "HEAD"]) || "main";
    const pullBranch = branch === "HEAD" ? "main" : branch;
    const remoteRef = `origin/${pullBranch}`;

    git(root, ["fetch", "origin", "--prune"]);

    let overwritten = false;
    try {
      git(root, ["pull", "--ff-only", "origin", pullBranch]);
    } catch (e) {
      const err = gitErr(e);
      // 脏工作区 / 分叉 / 锁文件挡路 → 直接跟远程对齐（更新本意就是用远程）
      if (
        /divergent|not possible to fast-forward|local changes|untracked|would be overwritten|conflict|merge|Aborting|cannot|拒绝|覆盖/i.test(
          err,
        ) ||
        /pnpm-lock|package-lock|yarn\.lock/i.test(err)
      ) {
        git(root, ["reset", "--hard", remoteRef]);
        overwritten = true;
      } else {
        // 其它失败也再试一次硬对齐，避免控制台卡死在 pull
        try {
          git(root, ["reset", "--hard", remoteRef]);
          overwritten = true;
        } catch {
          throw new Error(err);
        }
      }
    }

    const after = git(root, ["rev-parse", "HEAD"]);
    const version = readLocalVersion(root);
    const updated = before !== after;

    let shortStat = "";
    if (updated) {
      try {
        shortStat = formatShortStat(git(root, ["diff", "--shortstat", before, after]));
      } catch {
        shortStat = "";
      }
    }

    const built = buildUpdateReport({
      version,
      updated,
      before,
      after,
      shortStat,
      overwritten,
    });

    return {
      ok: true,
      version,
      updated,
      overwritten,
      beforeCommit: short(before),
      afterCommit: short(after),
      shouldExit: updated,
      message: built.message,
      reportText: built.reportText,
      forwardNodes: built.forwardNodes,
    };
  } catch (e) {
    return {
      ok: false,
      message: "更新失败",
      error: gitErr(e),
    };
  }
}

export { readLocalVersion };
