
import path from "node:path";
import { readFileSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const { version } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

// https://vite.dev/config/
export default defineConfig({
  define: { __SPARTA_VERSION__: JSON.stringify(version) },
  plugins: [react(), tailwindcss()],
  // Keep an unrelated PostCSS config in an ancestor directory from leaking
  // into Studio installs. Tailwind is provided by its dedicated Vite plugin.
  css: {
    postcss: {
      plugins: [],
    },
  },
  optimizeDeps: {
    include: ["@dagrejs/dagre", "@dagrejs/graphlib", "docx-preview"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8888",
        changeOrigin: true,
      },
      "/v1": {
        target: "http://127.0.0.1:8888",
        changeOrigin: true,
      },
      "/seed/inspect": {
        target: "http://127.0.0.1:8004",
        changeOrigin: true,
      },
      "/seed/preview": {
        target: "http://127.0.0.1:8004",
        changeOrigin: true,
      },
      "/preview": {
        target: "http://127.0.0.1:8004",
        changeOrigin: true,
      },
      "/validate": {
        target: "http://127.0.0.1:8004",
        changeOrigin: true,
      },
      "/tools": {
        target: "http://127.0.0.1:8004",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@dagrejs/dagre": path.resolve(
        __dirname,
        "./node_modules/@dagrejs/dagre/dist/dagre.cjs.js",
      ),
    },
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/, /@dagrejs\/dagre/, /@dagrejs\/graphlib/],
    },
  },
});
