import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveConfig } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const frontend = path.join(root, "desktop/frontend-spartan");
const normalize = value => path.resolve(value).replaceAll("\\", "/").toLowerCase();
const modules = ["react", "react/jsx-runtime", "react/jsx-dev-runtime", "react-dom/client"];

for (const configFile of [path.join(root, "vite.config.ts"), path.join(frontend, "vite.config.ts")]) {
  const config = await resolveConfig({ configFile }, "serve");
  const resolve = config.createResolver();
  for (const importer of [path.join(frontend, "src/main.tsx"), path.join(root, "node_modules/lucide-react/dist/esm/lucide-react.js")]) {
    for (const id of modules) {
      const resolved = await resolve(id, importer);
      assert.ok(resolved, `${id} must resolve`);
      const packageName = id.startsWith("react-dom") ? "react-dom" : "react";
      assert.ok(normalize(resolved).startsWith(normalize(path.join(frontend, "node_modules", packageName)) + "/"), `${configFile}: ${id} from ${importer} resolved to a different React installation: ${resolved}`);
    }
  }
}
console.log("React startup resolution: desktop and frontend use one React/JSX/React DOM installation, including root dependencies.");
