/**
 * Preload：把运行时配置与退出能力暴露给渲染进程。
 * 使用 CJS，便于 Electron preload 稳定加载。
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
  quit() {
    return ipcRenderer.invoke("pet-quit");
  },
  openExternal(url) {
    return ipcRenderer.invoke("pet-open-external", url);
  },
});
