/**
 * dataRoot = 仓库根；语音资源在 data/desktop-pet/voice/
 */
const { join } = require("node:path");

function voiceRoot(dataRoot) {
  return join(dataRoot, "data", "desktop-pet", "voice");
}

function sherpaDir(dataRoot) {
  return join(voiceRoot(dataRoot), "sherpa");
}

function sherpaReadyPath(dataRoot) {
  return join(sherpaDir(dataRoot), "ready.json");
}

function voiceTmpDir(dataRoot) {
  return join(voiceRoot(dataRoot), "tmp");
}

module.exports = { voiceRoot, sherpaDir, sherpaReadyPath, voiceTmpDir };
