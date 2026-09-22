/**
 * 听写近音纠错（地名/品牌常见误听）。
 * paraformer 无热词时，用轻量替换兜住「绥中」等。
 */
const REPLACERS = [
  [/石中县/g, "绥中县"],
  [/遂中县/g, "绥中县"],
  [/岁中县/g, "绥中县"],
  [/碎中县/g, "绥中县"],
  [/隋中县/g, "绥中县"],
  [/随中县/g, "绥中县"],
  [/穗中县/g, "绥中县"],
  [/水中县/g, "绥中县"],
  [/石中(?!县)/g, "绥中"],
  [/遂中(?!县)/g, "绥中"],
  [/喵里/g, "喵璃"],
  [/喵梨/g, "喵璃"],
  [/喵哩/g, "喵璃"],
  [/小里/g, "小璃"],
  [/小梨/g, "小璃"],
];

/**
 * @param {string} text
 */
function correctSttText(text) {
  let s = String(text || "").trim();
  if (!s) return s;
  for (const [re, to] of REPLACERS) {
    s = s.replace(re, to);
  }
  return s.trim();
}

module.exports = { correctSttText, REPLACERS };
