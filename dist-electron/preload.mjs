"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => electron.ipcRenderer.send("win:minimize"),
  maximize: () => electron.ipcRenderer.send("win:maximize"),
  close: () => electron.ipcRenderer.send("win:close"),
  isMaximized: () => electron.ipcRenderer.invoke("win:isMaximized"),
  onMaximizedChange: (callback) => {
    const handler = () => electron.ipcRenderer.invoke("win:isMaximized").then(callback);
    electron.ipcRenderer.on("win:maximized-changed", handler);
    return () => electron.ipcRenderer.removeListener("win:maximized-changed", handler);
  },
  setTitleBarOverlay: (colors) => electron.ipcRenderer.send("titlebar:set-overlay", colors),
  getVersion: () => electron.ipcRenderer.invoke("app:getVersion")
});
electron.contextBridge.exposeInMainWorld("electron", {
  on: (channel, listener) => {
    const subscription = (_event, ...args) => listener(...args);
    electron.ipcRenderer.on(channel, subscription);
    return () => electron.ipcRenderer.removeListener(channel, subscription);
  },
  send: (channel, ...args) => electron.ipcRenderer.send(channel, ...args),
  invoke: (channel, ...args) => electron.ipcRenderer.invoke(channel, ...args)
});
electron.contextBridge.exposeInMainWorld("sparta", {
  onEvent: (listener) => {
    const subscription = (_event, data) => listener(data);
    electron.ipcRenderer.on("sparta:event", subscription);
    return () => electron.ipcRenderer.removeListener("sparta:event", subscription);
  },
  sendEvent: (event) => {
    electron.ipcRenderer.send("sparta:event", event);
  },
  sendMessage: (req) => electron.ipcRenderer.invoke("chat:send", req),
  abortMessage: (sessionId) => electron.ipcRenderer.invoke("chat:abort", sessionId)
});
