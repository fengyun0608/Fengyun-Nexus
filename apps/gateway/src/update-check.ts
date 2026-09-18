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
  commits?: string[];
  files?: string[];
  overwritten?: boolean;
  /** 纯文本整段（控制台 / 终端） */
  reportText?: string;
  /** 合并转发各节点正文（QQ 匿名用户风格） */
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
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
  }).trim();
}

function gitLines(root: string, args: string[]): string[] {
  try {
    const out = git(root, args);
    if (!out) return [];
    return out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
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

/** 组装「已更新什么 / 覆盖了什么 / 正在重启」报告（师父手感） */
export function buildUpdateReport(opts: {
  version: string;
  updated: boolean;
  before: string;
  after: string;
  commits: string[];
  files: string[];
  overwritten: boolean;
}): { reportText: string; forwardNodes: string[]; message: string } {
  const { version, updated, before, after, commits, files, overwritten } = opts;
  const head = updated
    ? `已更新到 ${version}\n提交 ${short(before)} → ${short(after)}`
    : `已是最新 ${version}\n提交 ${short(after)}`;

  const commitBlock = updated
    ? commits.length
      ? `更新内容\n${commits.map((c) => `· ${c}`).join("\n")}`
      : "更新内容\n· （无提交摘要）"
    : "更新内容\n· 无新提交";

  const fileBlock = updated
    ? files.length
      ? `覆盖文件 ${files.length} 个\n${files.map((f) => `· ${f}`).join("\n")}`
      : "覆盖文件\n· （无文件列表）"
    : "覆盖文件\n· 无";

  const overwriteNote = overwritten ? "本地改动已对齐远程" : "";
  const restartLine = updated ? "正在重启" : "";

  const forwardNodes = [head, commitBlock, fileBlock];
  if (overwriteNote) forwardNodes.push(overwriteNote);
  if (restartLine) forwardNodes.push(restartLine);

  const reportText = forwardNodes.join("\n\n");
  const message = updated
    ? `已更新到 ${version}，正在重启`
    : `已是最新 ${version}`;

  return { reportText, forwardNodes, message };
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

/** Fast-forward pull; caller should exit process after responding. */
export function applyRemoteUpdate(root: string): UpdateApplyResult {
  try {
    const before = git(root, ["rev-parse", "HEAD"]);
    const branch = git(root, ["rev-parse", "--abbrev-ref", "HEAD"]) || "main";
    const pullBranch = branch === "HEAD" ? "main" : branch;
    git(root, ["fetch", "origin", "--prune"]);
    let overwritten = false;
    try {
      git(root, ["pull", "--ff-only", "origin", pullBranch]);
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      if (
        /divergent|not possible to fast-forward|local changes|untracked|would be overwritten/i.test(
          err,
        )
      ) {
        git(root, ["reset", "--hard", `origin/${pullBranch}`]);
        git(root, ["clean", "-fd"]);
        overwritten = true;
      } else {
        throw e;
      }
    }
    const after = git(root, ["rev-parse", "HEAD"]);
    const version = readLocalVersion(root);
    const updated = before !== after;

    let commits: string[] = [];
    let files: string[] = [];
    if (updated) {
      commits = gitLines(root, [
        "log",
        "--oneline",
        "--no-decorate",
        `${before}..${after}`,
      ]).slice(0, 12);
      files = gitLines(root, [
        "diff",
        "--name-status",
        before,
        after,
      ]).slice(0, 24);
    }

    const built = buildUpdateReport({
      version,
      updated,
      before,
      after,
      commits,
      files,
      overwritten,
    });

    return {
      ok: true,
      version,
      updated,
      overwritten,
      beforeCommit: short(before),
      afterCommit: short(after),
      commits,
      files,
      shouldExit: updated,
      message: built.message,
      reportText: built.reportText,
      forwardNodes: built.forwardNodes,
    };
  } catch (e) {
    return {
      ok: false,
      message: "更新失败",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export { readLocalVersion };
