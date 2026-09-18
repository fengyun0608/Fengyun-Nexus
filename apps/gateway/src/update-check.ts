import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type UpdateCheckResult = {
  ok: boolean;
  currentVersion: string;
  remoteVersion?: string;
  /** 主框架仓库地址，给人看 */
  repoUrl?: string;
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
  /** 给人看的变更条目（提交说明 / 目录），供转发与重启回执复用 */
  changeItems?: string[];
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

/** 主框架远程地址（给人看，去掉末尾 .git） */
export function readOriginUrl(root: string): string {
  try {
    const raw = git(root, ["remote", "get-url", "origin"]).trim();
    return raw.replace(/\.git$/i, "") || "https://gitcode.com/fengyunnb_admin/Fengyun-Nexus";
  } catch {
    return "https://gitcode.com/fengyunnb_admin/Fengyun-Nexus";
  }
}

/** 拉取区间内的提交说明（倒序最新在前） */
export function collectCommitSubjects(
  root: string,
  before: string,
  after: string,
  limit = 15,
): string[] {
  try {
    const raw = git(root, [
      "log",
      "--pretty=format:%s",
      "--no-merges",
      `${before}..${after}`,
    ]);
    return raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, limit);
  } catch {
    return [];
  }
}

/** 按顶层目录汇总改了哪些块 */
export function summarizeChangedAreas(
  root: string,
  before: string,
  after: string,
  limit = 8,
): string {
  try {
    const names = git(root, ["diff", "--name-only", before, after])
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!names.length) return "";
    const counts = new Map<string, number>();
    for (const f of names) {
      const top = f.split(/[/\\]/)[0] || f;
      counts.set(top, (counts.get(top) || 0) + 1);
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const shown = ranked.slice(0, limit).map(([k, n]) => `${k}×${n}`);
    const more = ranked.length > limit ? ` 等 ${ranked.length} 块` : "";
    return `涉及 ${shown.join("、")}${more}`;
  } catch {
    return "";
  }
}

/** 更新回执：以版本号为主 + 提交说明 + 范围统计，再提示重启 */
export function buildUpdateReport(opts: {
  version: string;
  beforeVersion?: string;
  updated: boolean;
  before: string;
  after: string;
  shortStat: string;
  overwritten: boolean;
  subjects?: string[];
  areas?: string;
}): { reportText: string; forwardNodes: string[]; message: string; changeItems: string[] } {
  const {
    version,
    beforeVersion,
    updated,
    shortStat,
    overwritten,
    subjects = [],
    areas,
  } = opts;
  const changeItems = [...subjects];
  const fromVer = beforeVersion || version;

  if (!updated) {
    const nodes = [`框架已是最新`, `版本 ${version}`];
    return {
      reportText: nodes.join("\n\n"),
      forwardNodes: nodes,
      message: `已是最新 ${version}`,
      changeItems: [],
    };
  }

  const verLine =
    fromVer === version
      ? `版本 ${version}（版本号未变，含代码更新）`
      : `版本 ${fromVer} → ${version}`;

  const head = [`框架已更新`, verLine].join("\n");
  const forwardNodes: string[] = [head];

  if (subjects.length) {
    const body = subjects.map((s, i) => `${i + 1}. ${s}`).join("\n");
    forwardNodes.push(`本次更新说明\n${body}`);
  } else {
    forwardNodes.push("本次更新说明\n（拿不到说明标题，仍有代码变更）");
  }

  const statBits = [shortStat || "有改动，统计拿不到", areas].filter(Boolean);
  forwardNodes.push(`改动统计\n${statBits.join("\n")}`);

  if (overwritten) forwardNodes.push("说明\n本地与远程不一致，已按远程对齐");
  forwardNodes.push("下一步\n即将重启以加载新版本，请稍候");

  const reportText = forwardNodes.join("\n\n");
  const tip = subjects[0] || shortStat || "有代码变更";
  const message = `框架已更新到 ${version}\n${verLine}\n要点：${tip}\n即将重启`;

  return { reportText, forwardNodes, message, changeItems };
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

    const sameVer = currentVersion === remoteVersion;
    const repoUrl = readOriginUrl(root);
    let message: string;
    if (!updateAvailable) {
      message = `主框架已是最新，版本 ${currentVersion}`;
    } else if (sameVer) {
      message = `主框架发现更新，当前版本 ${currentVersion}，远端有新内容`;
    } else {
      message = `主框架发现新版本 ${currentVersion} → ${remoteVersion}`;
    }

    return {
      ok: true,
      currentVersion,
      remoteVersion,
      repoUrl,
      updateAvailable,
      branch,
      message,
    };
  } catch (e) {
    return {
      ok: false,
      currentVersion,
      repoUrl: readOriginUrl(root),
      updateAvailable: false,
      message: "检查失败，连不上远程仓库",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** 对齐远程；有本地脏文件（比如 pnpm-lock）就硬拉，别卡在 pull */
export function applyRemoteUpdate(root: string): UpdateApplyResult {
  try {
    const before = git(root, ["rev-parse", "HEAD"]);
    const beforeVersion = readLocalVersion(root);
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
    let subjects: string[] = [];
    let areas = "";
    if (updated) {
      try {
        shortStat = formatShortStat(git(root, ["diff", "--shortstat", before, after]));
      } catch {
        shortStat = "";
      }
      subjects = collectCommitSubjects(root, before, after);
      areas = summarizeChangedAreas(root, before, after);
    }

    const built = buildUpdateReport({
      version,
      beforeVersion,
      updated,
      before,
      after,
      shortStat,
      overwritten,
      subjects,
      areas,
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
      changeItems: built.changeItems,
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
