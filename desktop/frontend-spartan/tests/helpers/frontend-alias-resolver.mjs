import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const sourceRoot = new URL("../../src/", import.meta.url);

function resolveSourceFile(unresolved) {
  const candidates = [
    unresolved,
    `${unresolved}.ts`,
    `${unresolved}.tsx`,
    `${unresolved}.js`,
    join(unresolved, "index.ts"),
    join(unresolved, "index.tsx"),
    join(unresolved, "index.js"),
  ];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

/** Match the @/ alias used by Vite so node:test loads the same source modules. */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const unresolved = fileURLToPath(new URL(specifier.slice(2), sourceRoot));
    const resolved = resolveSourceFile(unresolved);
    if (resolved) return nextResolve(pathToFileURL(resolved).href, context);
  }
  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const resolved = resolveSourceFile(fileURLToPath(new URL(specifier, context.parentURL)));
    if (resolved) return nextResolve(pathToFileURL(resolved).href, context);
  }
  return nextResolve(specifier, context);
}
