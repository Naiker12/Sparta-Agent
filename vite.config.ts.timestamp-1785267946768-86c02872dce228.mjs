// vite.config.ts
import { defineConfig, createLogger } from "file:///D:/sparta-agent/.pnpm-virtual/vite@5.4.21_@types+node@26.1.1_lightningcss@1.32.0/node_modules/vite/dist/node/index.js";
import path from "node:path";
import electron from "file:///D:/sparta-agent/.pnpm-virtual/vite-plugin-electron@0.28.8_4f71060a0595e75db0694e3f5d80bdba/node_modules/vite-plugin-electron/dist/simple.mjs";
import react from "file:///D:/sparta-agent/.pnpm-virtual/@vitejs+plugin-react@4.7.0__6eada90791e036b2d7ab2136fef93299/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "file:///D:/sparta-agent/.pnpm-virtual/@tailwindcss+vite@4.3.2_vit_78c120d8acbd12dc4ed57cc43bef6000/node_modules/@tailwindcss/vite/dist/index.mjs";
var __vite_injected_original_dirname = "D:\\sparta-agent";
var vite_config_default = defineConfig(({ mode }) => {
  const isElectron = mode !== "web";
  return {
    resolve: {
      alias: {
        "@": path.join(__vite_injected_original_dirname, "."),
        "@/components": path.join(__vite_injected_original_dirname, "components"),
        "ia-sparta-app-shell": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-app-shell/src/index.ts"),
        "ia-sparta-ipc-bridge": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-ipc-bridge/src/index.ts"),
        "ia-sparta-chat-ipc": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-chat-ipc/src/index.ts"),
        "ia-sparta-vault": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-vault/src/index.ts"),
        "ia-sparta-stream-events": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-stream-events/src/index.ts"),
        "ia-sparta-chat": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-chat/src/index.ts"),
        "ia-sparta-agents": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-agents/src/index.ts"),
        "ia-sparta-terminal": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-terminal/src/index.ts"),
        "ia-sparta-mcp": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-mcp/src/index.ts"),
        "ia-sparta-memory": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-memory/src/index.ts"),
        "ia-sparta-permission": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-permission/src/index.ts"),
        "ia-sparta-providers": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-providers/src/index.ts"),
        "ia-sparta-settings": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-settings/src/index.ts"),
        "ia-sparta-skills": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-skills/src/index.ts"),
        "ia-sparta-channels": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-channels/src/index.ts"),
        "ia-sparta-projects": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-projects/src/index.ts"),
        "ia-sparta-shell-layout": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-shell-layout/src/index.ts"),
        "ia-sparta-design-system": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-design-system/src/index.ts"),
        "ia-sparta-i18n": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-i18n/src/index.ts"),
        "ia-sparta-core": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-core/src/index.ts"),
        "ia-sparta-platform": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-platform/src/index.ts"),
        "ia-sparta-tabs": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-tabs/src/index.ts")
      }
    },
    define: {
      __IS_ELECTRON__: JSON.stringify(isElectron)
    },
    plugins: [
      tailwindcss(),
      react(),
      ...isElectron ? [electron({
        main: {
          entry: path.join(__vite_injected_original_dirname, "desktop/ia-sparta-app-shell/src/electron-main.ts"),
          vite: {
            resolve: {
              alias: {
                "ia-sparta-ipc-bridge": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-ipc-bridge/src/index.ts"),
                "ia-sparta-chat-ipc": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-chat-ipc/src/index.ts"),
                "ia-sparta-vault": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-vault/src/index.ts"),
                "ia-sparta-stream-events": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-stream-events/src/index.ts"),
                "ia-sparta-chat": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-chat/src/index.ts"),
                "ia-sparta-agents": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-agents/src/index.ts"),
                "ia-sparta-terminal": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-terminal/src/index.ts"),
                "ia-sparta-mcp": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-mcp/src/index.ts"),
                "ia-sparta-memory": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-memory/src/index.ts"),
                "ia-sparta-permission": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-permission/src/index.ts"),
                "ia-sparta-providers": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-providers/src/index.ts"),
                "ia-sparta-settings": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-settings/src/index.ts"),
                "ia-sparta-skills": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-skills/src/index.ts"),
                "ia-sparta-channels": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-channels/src/index.ts"),
                "ia-sparta-projects": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-projects/src/index.ts"),
                "ia-sparta-shell-layout": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-shell-layout/src/index.ts"),
                "ia-sparta-design-system": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-design-system/src/index.ts"),
                "ia-sparta-i18n": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-i18n/src/index.ts"),
                "ia-sparta-core": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-core/src/index.ts"),
                "ia-sparta-platform": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-platform/src/index.ts"),
                "ia-sparta-app-shell": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-app-shell/src/index.ts"),
                "ia-sparta-tabs": path.join(__vite_injected_original_dirname, "desktop/ia-sparta-tabs/src/index.ts")
              }
            },
            build: {
              sourcemap: false,
              minify: "esbuild",
              rollupOptions: {
                external: ["electron", "node-pty"],
                onwarn(warning, warn) {
                  if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
                  if (warning.code === "UNUSED_EXTERNAL_IMPORT") return;
                  if (warning.message?.includes("Can't resolve original location of error")) return;
                  warn(warning);
                }
              }
            }
          }
        },
        preload: {
          input: path.join(__vite_injected_original_dirname, "desktop/ia-sparta-ipc-bridge/src/preload.ts"),
          vite: {
            build: {
              sourcemap: false,
              minify: "esbuild",
              rollupOptions: {
                external: ["electron", "node-pty"],
                onwarn(warning, warn) {
                  if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
                  if (warning.code === "UNUSED_EXTERNAL_IMPORT") return;
                  if (warning.message?.includes("Can't resolve original location of error")) return;
                  warn(warning);
                }
              }
            }
          }
        },
        renderer: process.env.NODE_ENV === "test" ? void 0 : {}
      })] : []
    ],
    build: {
      outDir: isElectron ? "dist" : "dist-web",
      sourcemap: false,
      minify: "esbuild",
      chunkSizeWarningLimit: 2e3,
      rollupOptions: {
        onwarn(warning, warn) {
          if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
          if (warning.code === "UNUSED_EXTERNAL_IMPORT") return;
          if (warning.message?.includes("Can't resolve original location of error")) return;
          warn(warning);
        }
      }
    },
    server: {
      port: 5173,
      proxy: isElectron ? void 0 : {
        "/api": {
          target: "http://localhost:8765",
          changeOrigin: true
        }
      }
    },
    css: {
      devSourcemap: false
    },
    customLogger: (() => {
      const logger = createLogger();
      const originalWarn = logger.warn.bind(logger);
      const originalError = logger.error.bind(logger);
      logger.warn = (msg, options) => {
        if (msg.includes("Can't resolve original location of error")) return;
        if (msg.includes("sourcemap")) return;
        originalWarn(msg, options);
      };
      logger.error = (msg, options) => {
        if (msg.includes("Can't resolve original location of error")) return;
        if (msg.includes("sourcemap")) return;
        originalError(msg, options);
      };
      return logger;
    })()
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxzcGFydGEtYWdlbnRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXHNwYXJ0YS1hZ2VudFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovc3BhcnRhLWFnZW50L3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBjcmVhdGVMb2dnZXIgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJ1xuaW1wb3J0IGVsZWN0cm9uIGZyb20gJ3ZpdGUtcGx1Z2luLWVsZWN0cm9uL3NpbXBsZSdcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcbmltcG9ydCB0YWlsd2luZGNzcyBmcm9tICdAdGFpbHdpbmRjc3Mvdml0ZSdcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xuICAvLyBEZWZhdWx0OiBFbGVjdHJvbi4gV2ViIG1vZGUgdmlhIC0tbW9kZSB3ZWIgKHBucG0gZGV2OndlYilcbiAgY29uc3QgaXNFbGVjdHJvbiA9IG1vZGUgIT09ICd3ZWInXG5cbiAgcmV0dXJuIHtcbiAgICByZXNvbHZlOiB7XG4gICAgICBhbGlhczoge1xuICAgICAgICAnQCc6IHBhdGguam9pbihfX2Rpcm5hbWUsICcuJyksXG4gICAgICAgICdAL2NvbXBvbmVudHMnOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnY29tcG9uZW50cycpLFxuICAgICAgICAnaWEtc3BhcnRhLWFwcC1zaGVsbCc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1hcHAtc2hlbGwvc3JjL2luZGV4LnRzJyksXG4gICAgICAgICdpYS1zcGFydGEtaXBjLWJyaWRnZSc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1pcGMtYnJpZGdlL3NyYy9pbmRleC50cycpLFxuICAgICAgICAnaWEtc3BhcnRhLWNoYXQtaXBjJzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLWNoYXQtaXBjL3NyYy9pbmRleC50cycpLFxuICAgICAgICAnaWEtc3BhcnRhLXZhdWx0JzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLXZhdWx0L3NyYy9pbmRleC50cycpLFxuICAgICAgICAnaWEtc3BhcnRhLXN0cmVhbS1ldmVudHMnOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnZGVza3RvcC9pYS1zcGFydGEtc3RyZWFtLWV2ZW50cy9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgJ2lhLXNwYXJ0YS1jaGF0JzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLWNoYXQvc3JjL2luZGV4LnRzJyksXG4gICAgICAgICdpYS1zcGFydGEtYWdlbnRzJzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLWFnZW50cy9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgJ2lhLXNwYXJ0YS10ZXJtaW5hbCc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS10ZXJtaW5hbC9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgJ2lhLXNwYXJ0YS1tY3AnOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnZGVza3RvcC9pYS1zcGFydGEtbWNwL3NyYy9pbmRleC50cycpLFxuICAgICAgICAnaWEtc3BhcnRhLW1lbW9yeSc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1tZW1vcnkvc3JjL2luZGV4LnRzJyksXG4gICAgICAgICdpYS1zcGFydGEtcGVybWlzc2lvbic6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1wZXJtaXNzaW9uL3NyYy9pbmRleC50cycpLFxuICAgICAgICAnaWEtc3BhcnRhLXByb3ZpZGVycyc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1wcm92aWRlcnMvc3JjL2luZGV4LnRzJyksXG4gICAgICAgICdpYS1zcGFydGEtc2V0dGluZ3MnOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnZGVza3RvcC9pYS1zcGFydGEtc2V0dGluZ3Mvc3JjL2luZGV4LnRzJyksXG4gICAgICAgICdpYS1zcGFydGEtc2tpbGxzJzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLXNraWxscy9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgJ2lhLXNwYXJ0YS1jaGFubmVscyc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1jaGFubmVscy9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgJ2lhLXNwYXJ0YS1wcm9qZWN0cyc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1wcm9qZWN0cy9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgJ2lhLXNwYXJ0YS1zaGVsbC1sYXlvdXQnOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnZGVza3RvcC9pYS1zcGFydGEtc2hlbGwtbGF5b3V0L3NyYy9pbmRleC50cycpLFxuICAgICAgICAnaWEtc3BhcnRhLWRlc2lnbi1zeXN0ZW0nOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnZGVza3RvcC9pYS1zcGFydGEtZGVzaWduLXN5c3RlbS9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgJ2lhLXNwYXJ0YS1pMThuJzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLWkxOG4vc3JjL2luZGV4LnRzJyksXG4gICAgICAgICdpYS1zcGFydGEtY29yZSc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1jb3JlL3NyYy9pbmRleC50cycpLFxuICAgICAgICAnaWEtc3BhcnRhLXBsYXRmb3JtJzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLXBsYXRmb3JtL3NyYy9pbmRleC50cycpLFxuICAgICAgICAnaWEtc3BhcnRhLXRhYnMnOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnZGVza3RvcC9pYS1zcGFydGEtdGFicy9zcmMvaW5kZXgudHMnKSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBkZWZpbmU6IHtcbiAgICAgIF9fSVNfRUxFQ1RST05fXzogSlNPTi5zdHJpbmdpZnkoaXNFbGVjdHJvbiksXG4gICAgfSxcbiAgICBwbHVnaW5zOiBbXG4gICAgICB0YWlsd2luZGNzcygpLFxuICAgICAgcmVhY3QoKSxcbiAgICAgIC4uLihpc0VsZWN0cm9uXG4gICAgICAgID8gW2VsZWN0cm9uKHtcbiAgICAgICAgICAgIG1haW46IHtcbiAgICAgICAgICAgICAgZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1hcHAtc2hlbGwvc3JjL2VsZWN0cm9uLW1haW4udHMnKSxcbiAgICAgICAgICAgICAgdml0ZToge1xuICAgICAgICAgICAgICAgIHJlc29sdmU6IHtcbiAgICAgICAgICAgICAgICAgIGFsaWFzOiB7XG4gICAgICAgICAgICAgICAgICAgICdpYS1zcGFydGEtaXBjLWJyaWRnZSc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1pcGMtYnJpZGdlL3NyYy9pbmRleC50cycpLFxuICAgICAgICAgICAgICAgICAgICAnaWEtc3BhcnRhLWNoYXQtaXBjJzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLWNoYXQtaXBjL3NyYy9pbmRleC50cycpLFxuICAgICAgICAgICAgICAgICAgICAnaWEtc3BhcnRhLXZhdWx0JzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLXZhdWx0L3NyYy9pbmRleC50cycpLFxuICAgICAgICAgICAgICAgICAgICAnaWEtc3BhcnRhLXN0cmVhbS1ldmVudHMnOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnZGVza3RvcC9pYS1zcGFydGEtc3RyZWFtLWV2ZW50cy9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgICAgICAgICAgICAgJ2lhLXNwYXJ0YS1jaGF0JzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLWNoYXQvc3JjL2luZGV4LnRzJyksXG4gICAgICAgICAgICAgICAgICAgICdpYS1zcGFydGEtYWdlbnRzJzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLWFnZW50cy9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgICAgICAgICAgICAgJ2lhLXNwYXJ0YS10ZXJtaW5hbCc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS10ZXJtaW5hbC9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgICAgICAgICAgICAgJ2lhLXNwYXJ0YS1tY3AnOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnZGVza3RvcC9pYS1zcGFydGEtbWNwL3NyYy9pbmRleC50cycpLFxuICAgICAgICAgICAgICAgICAgICAnaWEtc3BhcnRhLW1lbW9yeSc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1tZW1vcnkvc3JjL2luZGV4LnRzJyksXG4gICAgICAgICAgICAgICAgICAgICdpYS1zcGFydGEtcGVybWlzc2lvbic6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1wZXJtaXNzaW9uL3NyYy9pbmRleC50cycpLFxuICAgICAgICAgICAgICAgICAgICAnaWEtc3BhcnRhLXByb3ZpZGVycyc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1wcm92aWRlcnMvc3JjL2luZGV4LnRzJyksXG4gICAgICAgICAgICAgICAgICAgICdpYS1zcGFydGEtc2V0dGluZ3MnOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnZGVza3RvcC9pYS1zcGFydGEtc2V0dGluZ3Mvc3JjL2luZGV4LnRzJyksXG4gICAgICAgICAgICAgICAgICAgICdpYS1zcGFydGEtc2tpbGxzJzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLXNraWxscy9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgICAgICAgICAgICAgJ2lhLXNwYXJ0YS1jaGFubmVscyc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1jaGFubmVscy9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgICAgICAgICAgICAgJ2lhLXNwYXJ0YS1wcm9qZWN0cyc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1wcm9qZWN0cy9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgICAgICAgICAgICAgJ2lhLXNwYXJ0YS1zaGVsbC1sYXlvdXQnOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnZGVza3RvcC9pYS1zcGFydGEtc2hlbGwtbGF5b3V0L3NyYy9pbmRleC50cycpLFxuICAgICAgICAgICAgICAgICAgICAnaWEtc3BhcnRhLWRlc2lnbi1zeXN0ZW0nOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnZGVza3RvcC9pYS1zcGFydGEtZGVzaWduLXN5c3RlbS9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgICAgICAgICAgICAgJ2lhLXNwYXJ0YS1pMThuJzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLWkxOG4vc3JjL2luZGV4LnRzJyksXG4gICAgICAgICAgICAgICAgICAgICdpYS1zcGFydGEtY29yZSc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1jb3JlL3NyYy9pbmRleC50cycpLFxuICAgICAgICAgICAgICAgICAgICAnaWEtc3BhcnRhLXBsYXRmb3JtJzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLXBsYXRmb3JtL3NyYy9pbmRleC50cycpLFxuICAgICAgICAgICAgICAgICAgICAnaWEtc3BhcnRhLWFwcC1zaGVsbCc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1hcHAtc2hlbGwvc3JjL2luZGV4LnRzJyksXG4gICAgICAgICAgICAgICAgICAgICdpYS1zcGFydGEtdGFicyc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS10YWJzL3NyYy9pbmRleC50cycpLFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGJ1aWxkOiB7XG4gICAgICAgICAgICAgICAgICBzb3VyY2VtYXA6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgbWluaWZ5OiAnZXNidWlsZCcsXG4gICAgICAgICAgICAgICAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAgICAgICAgICAgICAgIGV4dGVybmFsOiBbJ2VsZWN0cm9uJywgJ25vZGUtcHR5J10sXG4gICAgICAgICAgICAgICAgICAgIG9ud2Fybih3YXJuaW5nLCB3YXJuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHdhcm5pbmcuY29kZSA9PT0gJ01PRFVMRV9MRVZFTF9ESVJFQ1RJVkUnKSByZXR1cm5cbiAgICAgICAgICAgICAgICAgICAgICBpZiAod2FybmluZy5jb2RlID09PSAnVU5VU0VEX0VYVEVSTkFMX0lNUE9SVCcpIHJldHVyblxuICAgICAgICAgICAgICAgICAgICAgIGlmICh3YXJuaW5nLm1lc3NhZ2U/LmluY2x1ZGVzKFwiQ2FuJ3QgcmVzb2x2ZSBvcmlnaW5hbCBsb2NhdGlvbiBvZiBlcnJvclwiKSkgcmV0dXJuXG4gICAgICAgICAgICAgICAgICAgICAgd2Fybih3YXJuaW5nKVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHByZWxvYWQ6IHtcbiAgICAgICAgICAgICAgaW5wdXQ6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1pcGMtYnJpZGdlL3NyYy9wcmVsb2FkLnRzJyksXG4gICAgICAgICAgICAgIHZpdGU6IHtcbiAgICAgICAgICAgICAgICBidWlsZDoge1xuICAgICAgICAgICAgICAgICAgc291cmNlbWFwOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgIG1pbmlmeTogJ2VzYnVpbGQnLFxuICAgICAgICAgICAgICAgICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgICAgICAgICAgICAgICBleHRlcm5hbDogWydlbGVjdHJvbicsICdub2RlLXB0eSddLFxuICAgICAgICAgICAgICAgICAgICBvbndhcm4od2FybmluZywgd2Fybikge1xuICAgICAgICAgICAgICAgICAgICAgIGlmICh3YXJuaW5nLmNvZGUgPT09ICdNT0RVTEVfTEVWRUxfRElSRUNUSVZFJykgcmV0dXJuXG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHdhcm5pbmcuY29kZSA9PT0gJ1VOVVNFRF9FWFRFUk5BTF9JTVBPUlQnKSByZXR1cm5cbiAgICAgICAgICAgICAgICAgICAgICBpZiAod2FybmluZy5tZXNzYWdlPy5pbmNsdWRlcyhcIkNhbid0IHJlc29sdmUgb3JpZ2luYWwgbG9jYXRpb24gb2YgZXJyb3JcIikpIHJldHVyblxuICAgICAgICAgICAgICAgICAgICAgIHdhcm4od2FybmluZylcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZW5kZXJlcjogcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICd0ZXN0J1xuICAgICAgICAgICAgICA/IHVuZGVmaW5lZFxuICAgICAgICAgICAgICA6IHt9LFxuICAgICAgICAgIH0pXVxuICAgICAgICA6IFtdKSxcbiAgICBdLFxuICAgIGJ1aWxkOiB7XG4gICAgICBvdXREaXI6IGlzRWxlY3Ryb24gPyAnZGlzdCcgOiAnZGlzdC13ZWInLFxuICAgICAgc291cmNlbWFwOiBmYWxzZSxcbiAgICAgIG1pbmlmeTogJ2VzYnVpbGQnLFxuICAgICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAyMDAwLFxuICAgICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgICBvbndhcm4od2FybmluZywgd2Fybikge1xuICAgICAgICAgIC8vIFNpbGVuY2lhIHdhcm5pbmdzIGRlIFwidXNlIGNsaWVudFwiIGVuIGxpYnJlclx1MDBFRGFzIFJlYWN0IChzb25uZXIsIGZyYW1lci1tb3Rpb24pXG4gICAgICAgICAgaWYgKHdhcm5pbmcuY29kZSA9PT0gJ01PRFVMRV9MRVZFTF9ESVJFQ1RJVkUnKSByZXR1cm5cbiAgICAgICAgICAvLyBTaWxlbmNpYSB3YXJuaW5ncyBkZSBpbXBvcnRzIG5vIHVzYWRvcyBlbiBkZXBlbmRlbmNpYXMgKGNob2tpZGFyLCBldGMuKVxuICAgICAgICAgIGlmICh3YXJuaW5nLmNvZGUgPT09ICdVTlVTRURfRVhURVJOQUxfSU1QT1JUJykgcmV0dXJuXG4gICAgICAgICAgaWYgKHdhcm5pbmcubWVzc2FnZT8uaW5jbHVkZXMoXCJDYW4ndCByZXNvbHZlIG9yaWdpbmFsIGxvY2F0aW9uIG9mIGVycm9yXCIpKSByZXR1cm5cbiAgICAgICAgICB3YXJuKHdhcm5pbmcpXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gICAgc2VydmVyOiB7XG4gICAgICBwb3J0OiA1MTczLFxuICAgICAgcHJveHk6IGlzRWxlY3Ryb24gPyB1bmRlZmluZWQgOiB7XG4gICAgICAgICcvYXBpJzoge1xuICAgICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6ODc2NScsXG4gICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICAgIGNzczoge1xuICAgICAgZGV2U291cmNlbWFwOiBmYWxzZSxcbiAgICB9LFxuICAgIGN1c3RvbUxvZ2dlcjogKCgpID0+IHtcbiAgICAgIGNvbnN0IGxvZ2dlciA9IGNyZWF0ZUxvZ2dlcigpXG4gICAgICBjb25zdCBvcmlnaW5hbFdhcm4gPSBsb2dnZXIud2Fybi5iaW5kKGxvZ2dlcilcbiAgICAgIGNvbnN0IG9yaWdpbmFsRXJyb3IgPSBsb2dnZXIuZXJyb3IuYmluZChsb2dnZXIpXG4gICAgICBsb2dnZXIud2FybiA9IChtc2csIG9wdGlvbnMpID0+IHtcbiAgICAgICAgaWYgKG1zZy5pbmNsdWRlcyhcIkNhbid0IHJlc29sdmUgb3JpZ2luYWwgbG9jYXRpb24gb2YgZXJyb3JcIikpIHJldHVyblxuICAgICAgICBpZiAobXNnLmluY2x1ZGVzKFwic291cmNlbWFwXCIpKSByZXR1cm5cbiAgICAgICAgb3JpZ2luYWxXYXJuKG1zZywgb3B0aW9ucylcbiAgICAgIH1cbiAgICAgIGxvZ2dlci5lcnJvciA9IChtc2csIG9wdGlvbnMpID0+IHtcbiAgICAgICAgaWYgKG1zZy5pbmNsdWRlcyhcIkNhbid0IHJlc29sdmUgb3JpZ2luYWwgbG9jYXRpb24gb2YgZXJyb3JcIikpIHJldHVyblxuICAgICAgICBpZiAobXNnLmluY2x1ZGVzKFwic291cmNlbWFwXCIpKSByZXR1cm5cbiAgICAgICAgb3JpZ2luYWxFcnJvcihtc2csIG9wdGlvbnMpXG4gICAgICB9XG4gICAgICByZXR1cm4gbG9nZ2VyXG4gICAgfSkoKSxcbiAgfVxufSlcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBbU8sU0FBUyxjQUFjLG9CQUFvQjtBQUM5USxPQUFPLFVBQVU7QUFDakIsT0FBTyxjQUFjO0FBQ3JCLE9BQU8sV0FBVztBQUNsQixPQUFPLGlCQUFpQjtBQUp4QixJQUFNLG1DQUFtQztBQU16QyxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssTUFBTTtBQUV4QyxR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
