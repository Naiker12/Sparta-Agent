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
      strictPort: true,
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxzcGFydGEtYWdlbnRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXHNwYXJ0YS1hZ2VudFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovc3BhcnRhLWFnZW50L3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBjcmVhdGVMb2dnZXIgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJ1xuaW1wb3J0IGVsZWN0cm9uIGZyb20gJ3ZpdGUtcGx1Z2luLWVsZWN0cm9uL3NpbXBsZSdcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcbmltcG9ydCB0YWlsd2luZGNzcyBmcm9tICdAdGFpbHdpbmRjc3Mvdml0ZSdcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xuICAvLyBEZWZhdWx0OiBFbGVjdHJvbi4gV2ViIG1vZGUgdmlhIC0tbW9kZSB3ZWIgKHBucG0gZGV2OndlYilcbiAgY29uc3QgaXNFbGVjdHJvbiA9IG1vZGUgIT09ICd3ZWInXG5cbiAgcmV0dXJuIHtcbiAgICByZXNvbHZlOiB7XG4gICAgICBhbGlhczoge1xuICAgICAgICAnQCc6IHBhdGguam9pbihfX2Rpcm5hbWUsICcuJyksXG4gICAgICAgICdAL2NvbXBvbmVudHMnOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnY29tcG9uZW50cycpLFxuICAgICAgICAnaWEtc3BhcnRhLWFwcC1zaGVsbCc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1hcHAtc2hlbGwvc3JjL2luZGV4LnRzJyksXG4gICAgICAgICdpYS1zcGFydGEtaXBjLWJyaWRnZSc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1pcGMtYnJpZGdlL3NyYy9pbmRleC50cycpLFxuICAgICAgICAnaWEtc3BhcnRhLWNoYXQtaXBjJzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLWNoYXQtaXBjL3NyYy9pbmRleC50cycpLFxuICAgICAgICAnaWEtc3BhcnRhLXZhdWx0JzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLXZhdWx0L3NyYy9pbmRleC50cycpLFxuICAgICAgICAnaWEtc3BhcnRhLXN0cmVhbS1ldmVudHMnOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnZGVza3RvcC9pYS1zcGFydGEtc3RyZWFtLWV2ZW50cy9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgJ2lhLXNwYXJ0YS1jaGF0JzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLWNoYXQvc3JjL2luZGV4LnRzJyksXG4gICAgICAgICdpYS1zcGFydGEtYWdlbnRzJzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLWFnZW50cy9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgJ2lhLXNwYXJ0YS10ZXJtaW5hbCc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS10ZXJtaW5hbC9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgJ2lhLXNwYXJ0YS1tY3AnOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnZGVza3RvcC9pYS1zcGFydGEtbWNwL3NyYy9pbmRleC50cycpLFxuICAgICAgICAnaWEtc3BhcnRhLW1lbW9yeSc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1tZW1vcnkvc3JjL2luZGV4LnRzJyksXG4gICAgICAgICdpYS1zcGFydGEtcGVybWlzc2lvbic6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1wZXJtaXNzaW9uL3NyYy9pbmRleC50cycpLFxuICAgICAgICAnaWEtc3BhcnRhLXByb3ZpZGVycyc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1wcm92aWRlcnMvc3JjL2luZGV4LnRzJyksXG4gICAgICAgICdpYS1zcGFydGEtc2V0dGluZ3MnOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnZGVza3RvcC9pYS1zcGFydGEtc2V0dGluZ3Mvc3JjL2luZGV4LnRzJyksXG4gICAgICAgICdpYS1zcGFydGEtc2tpbGxzJzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLXNraWxscy9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgJ2lhLXNwYXJ0YS1jaGFubmVscyc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1jaGFubmVscy9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgJ2lhLXNwYXJ0YS1wcm9qZWN0cyc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1wcm9qZWN0cy9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgJ2lhLXNwYXJ0YS1zaGVsbC1sYXlvdXQnOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnZGVza3RvcC9pYS1zcGFydGEtc2hlbGwtbGF5b3V0L3NyYy9pbmRleC50cycpLFxuICAgICAgICAnaWEtc3BhcnRhLWRlc2lnbi1zeXN0ZW0nOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnZGVza3RvcC9pYS1zcGFydGEtZGVzaWduLXN5c3RlbS9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgJ2lhLXNwYXJ0YS1pMThuJzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLWkxOG4vc3JjL2luZGV4LnRzJyksXG4gICAgICAgICdpYS1zcGFydGEtY29yZSc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1jb3JlL3NyYy9pbmRleC50cycpLFxuICAgICAgICAnaWEtc3BhcnRhLXBsYXRmb3JtJzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLXBsYXRmb3JtL3NyYy9pbmRleC50cycpLFxuICAgICAgICAnaWEtc3BhcnRhLXRhYnMnOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnZGVza3RvcC9pYS1zcGFydGEtdGFicy9zcmMvaW5kZXgudHMnKSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBkZWZpbmU6IHtcbiAgICAgIF9fSVNfRUxFQ1RST05fXzogSlNPTi5zdHJpbmdpZnkoaXNFbGVjdHJvbiksXG4gICAgfSxcbiAgICBwbHVnaW5zOiBbXG4gICAgICB0YWlsd2luZGNzcygpLFxuICAgICAgcmVhY3QoKSxcbiAgICAgIC4uLihpc0VsZWN0cm9uXG4gICAgICAgID8gW2VsZWN0cm9uKHtcbiAgICAgICAgICAgIG1haW46IHtcbiAgICAgICAgICAgICAgZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1hcHAtc2hlbGwvc3JjL2VsZWN0cm9uLW1haW4udHMnKSxcbiAgICAgICAgICAgICAgdml0ZToge1xuICAgICAgICAgICAgICAgIHJlc29sdmU6IHtcbiAgICAgICAgICAgICAgICAgIGFsaWFzOiB7XG4gICAgICAgICAgICAgICAgICAgICdpYS1zcGFydGEtaXBjLWJyaWRnZSc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1pcGMtYnJpZGdlL3NyYy9pbmRleC50cycpLFxuICAgICAgICAgICAgICAgICAgICAnaWEtc3BhcnRhLWNoYXQtaXBjJzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLWNoYXQtaXBjL3NyYy9pbmRleC50cycpLFxuICAgICAgICAgICAgICAgICAgICAnaWEtc3BhcnRhLXZhdWx0JzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLXZhdWx0L3NyYy9pbmRleC50cycpLFxuICAgICAgICAgICAgICAgICAgICAnaWEtc3BhcnRhLXN0cmVhbS1ldmVudHMnOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnZGVza3RvcC9pYS1zcGFydGEtc3RyZWFtLWV2ZW50cy9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgICAgICAgICAgICAgJ2lhLXNwYXJ0YS1jaGF0JzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLWNoYXQvc3JjL2luZGV4LnRzJyksXG4gICAgICAgICAgICAgICAgICAgICdpYS1zcGFydGEtYWdlbnRzJzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLWFnZW50cy9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgICAgICAgICAgICAgJ2lhLXNwYXJ0YS10ZXJtaW5hbCc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS10ZXJtaW5hbC9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgICAgICAgICAgICAgJ2lhLXNwYXJ0YS1tY3AnOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnZGVza3RvcC9pYS1zcGFydGEtbWNwL3NyYy9pbmRleC50cycpLFxuICAgICAgICAgICAgICAgICAgICAnaWEtc3BhcnRhLW1lbW9yeSc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1tZW1vcnkvc3JjL2luZGV4LnRzJyksXG4gICAgICAgICAgICAgICAgICAgICdpYS1zcGFydGEtcGVybWlzc2lvbic6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1wZXJtaXNzaW9uL3NyYy9pbmRleC50cycpLFxuICAgICAgICAgICAgICAgICAgICAnaWEtc3BhcnRhLXByb3ZpZGVycyc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1wcm92aWRlcnMvc3JjL2luZGV4LnRzJyksXG4gICAgICAgICAgICAgICAgICAgICdpYS1zcGFydGEtc2V0dGluZ3MnOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnZGVza3RvcC9pYS1zcGFydGEtc2V0dGluZ3Mvc3JjL2luZGV4LnRzJyksXG4gICAgICAgICAgICAgICAgICAgICdpYS1zcGFydGEtc2tpbGxzJzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLXNraWxscy9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgICAgICAgICAgICAgJ2lhLXNwYXJ0YS1jaGFubmVscyc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1jaGFubmVscy9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgICAgICAgICAgICAgJ2lhLXNwYXJ0YS1wcm9qZWN0cyc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1wcm9qZWN0cy9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgICAgICAgICAgICAgJ2lhLXNwYXJ0YS1zaGVsbC1sYXlvdXQnOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnZGVza3RvcC9pYS1zcGFydGEtc2hlbGwtbGF5b3V0L3NyYy9pbmRleC50cycpLFxuICAgICAgICAgICAgICAgICAgICAnaWEtc3BhcnRhLWRlc2lnbi1zeXN0ZW0nOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnZGVza3RvcC9pYS1zcGFydGEtZGVzaWduLXN5c3RlbS9zcmMvaW5kZXgudHMnKSxcbiAgICAgICAgICAgICAgICAgICAgJ2lhLXNwYXJ0YS1pMThuJzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLWkxOG4vc3JjL2luZGV4LnRzJyksXG4gICAgICAgICAgICAgICAgICAgICdpYS1zcGFydGEtY29yZSc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1jb3JlL3NyYy9pbmRleC50cycpLFxuICAgICAgICAgICAgICAgICAgICAnaWEtc3BhcnRhLXBsYXRmb3JtJzogcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Rlc2t0b3AvaWEtc3BhcnRhLXBsYXRmb3JtL3NyYy9pbmRleC50cycpLFxuICAgICAgICAgICAgICAgICAgICAnaWEtc3BhcnRhLWFwcC1zaGVsbCc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1hcHAtc2hlbGwvc3JjL2luZGV4LnRzJyksXG4gICAgICAgICAgICAgICAgICAgICdpYS1zcGFydGEtdGFicyc6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS10YWJzL3NyYy9pbmRleC50cycpLFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGJ1aWxkOiB7XG4gICAgICAgICAgICAgICAgICBzb3VyY2VtYXA6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgbWluaWZ5OiAnZXNidWlsZCcsXG4gICAgICAgICAgICAgICAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAgICAgICAgICAgICAgIGV4dGVybmFsOiBbJ2VsZWN0cm9uJywgJ25vZGUtcHR5J10sXG4gICAgICAgICAgICAgICAgICAgIG9ud2Fybih3YXJuaW5nLCB3YXJuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHdhcm5pbmcuY29kZSA9PT0gJ01PRFVMRV9MRVZFTF9ESVJFQ1RJVkUnKSByZXR1cm5cbiAgICAgICAgICAgICAgICAgICAgICBpZiAod2FybmluZy5jb2RlID09PSAnVU5VU0VEX0VYVEVSTkFMX0lNUE9SVCcpIHJldHVyblxuICAgICAgICAgICAgICAgICAgICAgIGlmICh3YXJuaW5nLm1lc3NhZ2U/LmluY2x1ZGVzKFwiQ2FuJ3QgcmVzb2x2ZSBvcmlnaW5hbCBsb2NhdGlvbiBvZiBlcnJvclwiKSkgcmV0dXJuXG4gICAgICAgICAgICAgICAgICAgICAgd2Fybih3YXJuaW5nKVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHByZWxvYWQ6IHtcbiAgICAgICAgICAgICAgaW5wdXQ6IHBhdGguam9pbihfX2Rpcm5hbWUsICdkZXNrdG9wL2lhLXNwYXJ0YS1pcGMtYnJpZGdlL3NyYy9wcmVsb2FkLnRzJyksXG4gICAgICAgICAgICAgIHZpdGU6IHtcbiAgICAgICAgICAgICAgICBidWlsZDoge1xuICAgICAgICAgICAgICAgICAgc291cmNlbWFwOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgIG1pbmlmeTogJ2VzYnVpbGQnLFxuICAgICAgICAgICAgICAgICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgICAgICAgICAgICAgICBleHRlcm5hbDogWydlbGVjdHJvbicsICdub2RlLXB0eSddLFxuICAgICAgICAgICAgICAgICAgICBvbndhcm4od2FybmluZywgd2Fybikge1xuICAgICAgICAgICAgICAgICAgICAgIGlmICh3YXJuaW5nLmNvZGUgPT09ICdNT0RVTEVfTEVWRUxfRElSRUNUSVZFJykgcmV0dXJuXG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHdhcm5pbmcuY29kZSA9PT0gJ1VOVVNFRF9FWFRFUk5BTF9JTVBPUlQnKSByZXR1cm5cbiAgICAgICAgICAgICAgICAgICAgICBpZiAod2FybmluZy5tZXNzYWdlPy5pbmNsdWRlcyhcIkNhbid0IHJlc29sdmUgb3JpZ2luYWwgbG9jYXRpb24gb2YgZXJyb3JcIikpIHJldHVyblxuICAgICAgICAgICAgICAgICAgICAgIHdhcm4od2FybmluZylcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZW5kZXJlcjogcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICd0ZXN0J1xuICAgICAgICAgICAgICA/IHVuZGVmaW5lZFxuICAgICAgICAgICAgICA6IHt9LFxuICAgICAgICAgIH0pXVxuICAgICAgICA6IFtdKSxcbiAgICBdLFxuICAgIGJ1aWxkOiB7XG4gICAgICBvdXREaXI6IGlzRWxlY3Ryb24gPyAnZGlzdCcgOiAnZGlzdC13ZWInLFxuICAgICAgc291cmNlbWFwOiBmYWxzZSxcbiAgICAgIG1pbmlmeTogJ2VzYnVpbGQnLFxuICAgICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAyMDAwLFxuICAgICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgICBvbndhcm4od2FybmluZywgd2Fybikge1xuICAgICAgICAgIC8vIFNpbGVuY2lhIHdhcm5pbmdzIGRlIFwidXNlIGNsaWVudFwiIGVuIGxpYnJlclx1MDBFRGFzIFJlYWN0IChzb25uZXIsIGZyYW1lci1tb3Rpb24pXG4gICAgICAgICAgaWYgKHdhcm5pbmcuY29kZSA9PT0gJ01PRFVMRV9MRVZFTF9ESVJFQ1RJVkUnKSByZXR1cm5cbiAgICAgICAgICAvLyBTaWxlbmNpYSB3YXJuaW5ncyBkZSBpbXBvcnRzIG5vIHVzYWRvcyBlbiBkZXBlbmRlbmNpYXMgKGNob2tpZGFyLCBldGMuKVxuICAgICAgICAgIGlmICh3YXJuaW5nLmNvZGUgPT09ICdVTlVTRURfRVhURVJOQUxfSU1QT1JUJykgcmV0dXJuXG4gICAgICAgICAgaWYgKHdhcm5pbmcubWVzc2FnZT8uaW5jbHVkZXMoXCJDYW4ndCByZXNvbHZlIG9yaWdpbmFsIGxvY2F0aW9uIG9mIGVycm9yXCIpKSByZXR1cm5cbiAgICAgICAgICB3YXJuKHdhcm5pbmcpXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gICAgc2VydmVyOiB7XG4gICAgICBwb3J0OiA1MTczLFxuICAgICAgc3RyaWN0UG9ydDogdHJ1ZSxcbiAgICAgIHByb3h5OiBpc0VsZWN0cm9uID8gdW5kZWZpbmVkIDoge1xuICAgICAgICAnL2FwaSc6IHtcbiAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0Ojg3NjUnLFxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBjc3M6IHtcbiAgICAgIGRldlNvdXJjZW1hcDogZmFsc2UsXG4gICAgfSxcbiAgICBjdXN0b21Mb2dnZXI6ICgoKSA9PiB7XG4gICAgICBjb25zdCBsb2dnZXIgPSBjcmVhdGVMb2dnZXIoKVxuICAgICAgY29uc3Qgb3JpZ2luYWxXYXJuID0gbG9nZ2VyLndhcm4uYmluZChsb2dnZXIpXG4gICAgICBjb25zdCBvcmlnaW5hbEVycm9yID0gbG9nZ2VyLmVycm9yLmJpbmQobG9nZ2VyKVxuICAgICAgbG9nZ2VyLndhcm4gPSAobXNnLCBvcHRpb25zKSA9PiB7XG4gICAgICAgIGlmIChtc2cuaW5jbHVkZXMoXCJDYW4ndCByZXNvbHZlIG9yaWdpbmFsIGxvY2F0aW9uIG9mIGVycm9yXCIpKSByZXR1cm5cbiAgICAgICAgaWYgKG1zZy5pbmNsdWRlcyhcInNvdXJjZW1hcFwiKSkgcmV0dXJuXG4gICAgICAgIG9yaWdpbmFsV2Fybihtc2csIG9wdGlvbnMpXG4gICAgICB9XG4gICAgICBsb2dnZXIuZXJyb3IgPSAobXNnLCBvcHRpb25zKSA9PiB7XG4gICAgICAgIGlmIChtc2cuaW5jbHVkZXMoXCJDYW4ndCByZXNvbHZlIG9yaWdpbmFsIGxvY2F0aW9uIG9mIGVycm9yXCIpKSByZXR1cm5cbiAgICAgICAgaWYgKG1zZy5pbmNsdWRlcyhcInNvdXJjZW1hcFwiKSkgcmV0dXJuXG4gICAgICAgIG9yaWdpbmFsRXJyb3IobXNnLCBvcHRpb25zKVxuICAgICAgfVxuICAgICAgcmV0dXJuIGxvZ2dlclxuICAgIH0pKCksXG4gIH1cbn0pXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQW1PLFNBQVMsY0FBYyxvQkFBb0I7QUFDOVEsT0FBTyxVQUFVO0FBQ2pCLE9BQU8sY0FBYztBQUNyQixPQUFPLFdBQVc7QUFDbEIsT0FBTyxpQkFBaUI7QUFKeEIsSUFBTSxtQ0FBbUM7QUFNekMsSUFBTyxzQkFBUSxhQUFhLENB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
