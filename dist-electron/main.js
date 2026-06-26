import { ipcMain, BrowserWindow, app } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
const activeStreams = /* @__PURE__ */ new Map();
function getEndpoint(apiUrl, isLocal) {
  if (apiUrl) {
    const base = apiUrl.replace(/\/+$/, "");
    if (isLocal) {
      if (base.includes("/api/chat")) return `${base}`;
      if (base.includes("/v1")) return `${base}/chat/completions`;
      return `${base}/v1/chat/completions`;
    }
    return `${base}/v1/chat/completions`;
  }
  return "https://api.openai.com/v1/chat/completions";
}
function getHeaders(providerKey, apiUrl, isLocal) {
  const headers = { "content-type": "application/json" };
  if (isLocal) return headers;
  if (apiUrl == null ? void 0 : apiUrl.includes("anthropic")) {
    headers["x-api-key"] = providerKey;
    headers["anthropic-version"] = "2023-06-01";
  } else if (apiUrl == null ? void 0 : apiUrl.includes("google")) ;
  else {
    headers["Authorization"] = `Bearer ${providerKey}`;
  }
  return headers;
}
function registerChatIPC() {
  ipcMain.handle("chat:send", async (_event, req) => {
    var _a, _b, _c, _d, _e;
    const { providerKey, sessionId, messageId, apiUrl, isLocal } = req;
    if (!providerKey && !isLocal) return { ok: false, error: "No provider configured" };
    const abortController = new AbortController();
    activeStreams.set(sessionId, abortController);
    const win2 = BrowserWindow.getFocusedWindow();
    function sendChunk(chunk) {
      win2 == null ? void 0 : win2.webContents.send("sparta:event", { sessionId, messageId, ...chunk });
    }
    try {
      const endpoint = getEndpoint(apiUrl, isLocal);
      const headers = getHeaders(providerKey ?? "", apiUrl, isLocal);
      let body;
      if (apiUrl == null ? void 0 : apiUrl.includes("anthropic")) {
        body = JSON.stringify({
          model: req.model,
          messages: req.messages,
          max_tokens: 4096,
          stream: true
        });
      } else if (isLocal && (apiUrl == null ? void 0 : apiUrl.includes("/api/chat"))) {
        body = JSON.stringify({
          model: req.model,
          messages: req.messages,
          stream: true
        });
      } else {
        body = JSON.stringify({
          model: req.model,
          messages: req.messages,
          stream: true,
          max_tokens: 4096
        });
      }
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body,
        signal: abortController.signal
      });
      if (!response.ok) {
        sendChunk({ type: "error", error: `HTTP ${response.status}` });
        return { ok: false, error: `HTTP ${response.status}` };
      }
      const reader = (_a = response.body) == null ? void 0 : _a.getReader();
      if (!reader) {
        sendChunk({ type: "error", error: "No response body" });
        return { ok: false, error: "No response body" };
      }
      const decoder = new TextDecoder();
      let buffer = "";
      let streaming = true;
      while (streaming) {
        const { done, value } = await reader.read();
        if (done) streaming = false;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          const json = trimmed.slice(5).trim();
          if (json === "[DONE]") {
            sendChunk({ type: "done" });
            continue;
          }
          try {
            const parsed = JSON.parse(json);
            if (apiUrl == null ? void 0 : apiUrl.includes("anthropic")) {
              if (parsed.type === "content_block_delta" && ((_b = parsed.delta) == null ? void 0 : _b.text)) {
                sendChunk({ type: "content_token", delta: parsed.delta.text });
              }
            } else {
              const choice = (_c = parsed.choices) == null ? void 0 : _c[0];
              if ((_d = choice == null ? void 0 : choice.delta) == null ? void 0 : _d.content) {
                sendChunk({ type: "content_token", delta: choice.delta.content });
              }
              if ((_e = choice == null ? void 0 : choice.delta) == null ? void 0 : _e.reasoning_content) {
                sendChunk({ type: "thinking_token", delta: choice.delta.reasoning_content });
              }
              if ((choice == null ? void 0 : choice.finish_reason) === "stop") {
                sendChunk({ type: "done" });
              }
            }
          } catch {
          }
        }
      }
      sendChunk({ type: "done" });
      return { ok: true };
    } catch (err) {
      if (err.name === "AbortError") {
        sendChunk({ type: "done" });
        return { ok: true, aborted: true };
      }
      sendChunk({ type: "error", error: err.message });
      return { ok: false, error: err.message };
    } finally {
      activeStreams.delete(sessionId);
    }
  });
  ipcMain.handle("chat:abort", (_event, sessionId) => {
    const controller = activeStreams.get(sessionId);
    if (controller) {
      controller.abort();
      activeStreams.delete(sessionId);
    }
  });
}
const DB_PATH = path.join(process.env.APP_ROOT ?? ".", "sparta-memory.json");
function readDB() {
  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { entries: [], relations: [] };
  }
}
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}
function registerMemoryIPC() {
  ipcMain.handle("memory:list", () => {
    return readDB();
  });
  ipcMain.handle("memory:addEntry", (_event, entry) => {
    const db = readDB();
    db.entries.push(entry);
    writeDB(db);
    return entry.id;
  });
  ipcMain.handle("memory:updateEntry", (_event, id, partial) => {
    const db = readDB();
    db.entries = db.entries.map((e) => e.id === id ? { ...e, ...partial } : e);
    writeDB(db);
  });
  ipcMain.handle("memory:deleteEntry", (_event, id) => {
    const db = readDB();
    db.entries = db.entries.filter((e) => e.id !== id);
    db.relations = db.relations.filter((r) => r.fromId !== id && r.toId !== id);
    writeDB(db);
  });
  ipcMain.handle("memory:addRelation", (_event, rel) => {
    const db = readDB();
    db.relations.push(rel);
    writeDB(db);
  });
  ipcMain.handle("memory:updateRelation", (_event, fromId, toId, partial) => {
    const db = readDB();
    db.relations = db.relations.map(
      (r) => r.fromId === fromId && r.toId === toId ? { ...r, ...partial } : r
    );
    writeDB(db);
  });
  ipcMain.handle("memory:removeRelation", (_event, fromId, toId) => {
    const db = readDB();
    db.relations = db.relations.filter((r) => r.fromId !== fromId || r.toId !== toId);
    writeDB(db);
  });
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0C0C10",
      symbolColor: "#9CA3AF",
      height: 38
    },
    backgroundColor: "#0C0C10",
    show: false,
    icon: path.join(process.env.VITE_PUBLIC, "sparta-escritorio.png"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: "Sparta Agent"
  });
  win.once("ready-to-show", () => win == null ? void 0 : win.show());
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  ipcMain.on("win:minimize", () => win == null ? void 0 : win.minimize());
  ipcMain.on("win:maximize", () => {
    if (win == null ? void 0 : win.isMaximized()) {
      win.unmaximize();
    } else {
      win == null ? void 0 : win.maximize();
    }
  });
  ipcMain.on("win:close", () => win == null ? void 0 : win.close());
  ipcMain.handle("win:isMaximized", () => win == null ? void 0 : win.isMaximized());
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  createWindow();
  registerChatIPC();
  registerMemoryIPC();
  ipcMain.handle("app:getVersion", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.env.APP_ROOT, "package.json"), "utf-8"));
    return pkg.version || "0.0.0";
  });
  ipcMain.on("titlebar:set-overlay", (_event, colors) => {
    if (win) {
      win.setTitleBarOverlay({
        color: colors.color,
        symbolColor: colors.symbolColor,
        height: 38
      });
    }
  });
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
