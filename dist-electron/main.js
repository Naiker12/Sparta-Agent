import { app as n, BrowserWindow as s, ipcMain as i } from "electron";
import { fileURLToPath as d } from "node:url";
import o from "node:path";
const a = o.dirname(d(import.meta.url));
process.env.APP_ROOT = o.join(a, "..");
const t = process.env.VITE_DEV_SERVER_URL, h = o.join(process.env.APP_ROOT, "dist-electron"), r = o.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = t ? o.join(process.env.APP_ROOT, "public") : r;
let e;
function l() {
  e = new s({
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
    show: !1,
    icon: o.join(process.env.VITE_PUBLIC, "sparta-icon.png"),
    webPreferences: {
      preload: o.join(a, "preload.mjs"),
      contextIsolation: !0,
      nodeIntegration: !1
    },
    title: "Sparta Agent"
  }), e.once("ready-to-show", () => e == null ? void 0 : e.show()), e.webContents.on("did-finish-load", () => {
    e == null || e.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), i.on("win:minimize", () => e == null ? void 0 : e.minimize()), i.on("win:maximize", () => {
    e != null && e.isMaximized() ? e.unmaximize() : e == null || e.maximize();
  }), i.on("win:close", () => e == null ? void 0 : e.close()), i.handle("win:isMaximized", () => e == null ? void 0 : e.isMaximized()), t ? e.loadURL(t) : e.loadFile(o.join(r, "index.html"));
}
n.on("window-all-closed", () => {
  process.platform !== "darwin" && (n.quit(), e = null);
});
n.on("activate", () => {
  s.getAllWindows().length === 0 && l();
});
n.whenReady().then(l);
export {
  h as MAIN_DIST,
  r as RENDERER_DIST,
  t as VITE_DEV_SERVER_URL
};
