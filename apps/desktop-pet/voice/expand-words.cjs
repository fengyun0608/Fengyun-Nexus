/**
 * 呼唤词 + 近音别名展开（配置驱动，不写死在引擎脚本里）。
 */
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

function loadDefaultAliases(petDir) {
  const p = join(petDir, "voice", "aliases.default.json");
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

/**
 * @param {string[]} words
 * @param {Record<string, string[]> | undefined} aliases
 * @param {string} petDir
 */
function expandWakeWords(words, aliases, petDir) {
  const defaults = loadDefaultAliases(petDir);
  const map = { ...defaults, ...(aliases && typeof aliases === "object" ? aliases : {}) };
  const set = new Set();
  const list = Array.isArray(words) ? words : [];
  for (const w of list) {
    const t = String(w || "").trim();
    if (!t) continue;
    set.add(t);
    const extra = map[t];
    if (Array.isArray(extra)) {
      for (const a of extra) {
        const s = String(a || "").trim();
        if (s) set.add(s);
      }
    }
  }
  const out = [...set];
  return out.length ? out : ["喵璃", "小璃"];
}

module.exports = { expandWakeWords, loadDefaultAliases };
