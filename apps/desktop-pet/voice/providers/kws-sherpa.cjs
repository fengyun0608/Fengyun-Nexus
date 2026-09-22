/**
 * sherpa-onnx 关键词点检（P1）。模型未装时 unavailable，由 pipeline 降级。
 */
const { existsSync } = require("node:fs");
const { join } = require("node:path");

const ID = "sherpa";

/**
 * @param {{ dataRoot: string }} opts
 */
function createSherpaKws(opts) {
  const marker = join(opts.dataRoot, "desktop-pet", "voice", "sherpa", "ready");

  function available() {
    return existsSync(marker);
  }

  return {
    id: ID,
    available,
    start() {
      return false;
    },
    stop() {},
    write() {
      return false;
    },
    setWords() {
      return false;
    },
    enterDictate() {
      return false;
    },
    enterWake() {
      return false;
    },
  };
}

module.exports = { createSherpaKws, ID };
