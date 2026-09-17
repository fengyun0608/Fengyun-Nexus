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

function parseVersionFromPackageJson(raw: string): string | undefined {
  try {
    const pkg = JSON.parse(raw) as { version?: string };
    return pkg.version;
  } catch {
    return undefined;
  }
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
export function applyRemoteUpdate(root: string): {
  ok: boolean;
  message: string;
  version?: string;
  error?: string;
  shouldExit?: boolean;
  updated?: boolean;
} {
  try {
    const before = git(root, ["rev-parse", "HEAD"]);
    const branch = git(root, ["rev-parse", "--abbrev-ref", "HEAD"]) || "main";
    const pullBranch = branch === "HEAD" ? "main" : branch;
    git(root, ["fetch", "origin", "--prune"]);
    try {
      git(root, ["pull", "--ff-only", "origin", pullBranch]);
    } catch (e) {
      // 本地有未提交改动时 ff-only 易失败：对齐远程（管理端主动 #更新）
      const err = e instanceof Error ? e.message : String(e);
      if (/divergent|not possible to fast-forward|local changes|untracked|would be overwritten/i.test(err)) {
        git(root, ["reset", "--hard", `origin/${pullBranch}`]);
        git(root, ["clean", "-fd"]);
      } else {
        throw e;
      }
    }
    const after = git(root, ["rev-parse", "HEAD"]);
    const version = readLocalVersion(root);
    const updated = before !== after;
    return {
      ok: true,
      version,
      updated,
      shouldExit: true,
      message: updated
        ? `已更新到 ${version}，即将重启`
        : `已是最新 ${version}，即将重启`,
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
