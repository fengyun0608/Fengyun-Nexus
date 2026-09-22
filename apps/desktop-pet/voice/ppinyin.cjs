/**
 * 中文呼唤词 → sherpa wenetspeech ppinyin 行（不依赖外部 cli）。
 * 未收录汉字的词会跳过（仍可由 System.Speech 兜底场景覆盖）。
 */
const CHAR_PY = {
  喵: "m iāo",
  璃: "l í",
  哩: "l ī",
  里: "l ǐ",
  梨: "l í",
  妙: "m iào",
  苗: "m iáo",
  小: "x iǎo",
  丽: "l ì",
  风: "f ēng",
  云: "y ún",
  丰: "f ēng",
  枢: "sh ū",
  纽: "n iǔ",
  你: "n ǐ",
  好: "h ǎo",
  同: "t óng",
  学: "x ué",
  爱: "ài",
  军: "j ūn",
  哥: "g ē",
  问: "w èn",
  女: "n ǚ",
  儿: "ér",
  法: "f ǎ",
  国: "g uó",
  奈: "n ài",
  克: "k è",
  瑟: "s è",
  斯: "s ī",
  纳: "n à",
};

/**
 * @param {string} word
 * @returns {string | null} 一行：`p y @词`
 */
function wordToKeywordsLine(word) {
  const w = String(word || "").trim();
  if (!w) return null;
  // 纯英文：wenetspeech 中文 KWS 效果差，跳过
  if (/^[a-zA-Z0-9_\-]+$/.test(w)) return null;
  const parts = [];
  for (const ch of w) {
    if (/\s/.test(ch)) continue;
    const py = CHAR_PY[ch];
    if (!py) return null;
    parts.push(py);
  }
  if (!parts.length) return null;
  const tag = w.replace(/\s+/g, "_");
  return `${parts.join(" ")} @${tag}`;
}

/**
 * @param {string[]} words
 * @returns {string}
 */
function buildKeywordsFile(words) {
  const lines = [];
  const seen = new Set();
  for (const w of words || []) {
    const line = wordToKeywordsLine(w);
    if (!line) continue;
    if (seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
  }
  // 至少留一个默认，避免空文件
  if (!lines.length) {
    lines.push("m iāo l í @喵璃");
    lines.push("x iǎo l í @小璃");
  }
  return `${lines.join("\n")}\n`;
}

module.exports = { wordToKeywordsLine, buildKeywordsFile, CHAR_PY };
