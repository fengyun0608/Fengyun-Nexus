/**
 * Preload：运行时 + 本机呼唤引擎事件。
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nexusPet", {
  onRuntime(cb) {
    ipcRenderer.on("pet-runtime", (_e, data) => {
      try {
        cb(data);
      } catch {
        /* ignore */
      }
    });
  },
  onWake(cb) {
    ipcRenderer.on("pet-wake", (_e, data) => {
      try {
        cb(data);
      } catch {
        /* ignore */
      }
    });
  },
  onDictate(cb) {
    ipcRenderer.on("pet-dictate", (_e, data) => {
      try {
        cb(data);
      } catch {
        /* ignore */
      }
    });
  },
  onWakeStatus(cb) {
    ipcRenderer.on("pet-wake-status", (_e, data) => {
      try {
        cb(data);
      } catch {
        /* ignore */
      }
    });
  },
  onVoiceMeta(cb) {
    ipcRenderer.on("pet-voice-meta", (_e, data) => {
      try {
        cb(data);
      } catch {
        /* ignore */
      }
    });
  },
  setWakeWords(words) {
    return ipcRenderer.invoke("pet-set-wake-words", words);
  },
  listenAgain() {
    return ipcRenderer.invoke("pet-listen-again");
  },
  voiceStatus() {
    return ipcRenderer.invoke("pet-voice-status");
  },
  quit() {
    return ipcRenderer.invoke("pet-quit");
  },
  openExternal(url) {
    return ipcRenderer.invoke("pet-open-external", url);
  },
});
