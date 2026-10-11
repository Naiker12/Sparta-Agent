
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";

// Only llama-server knows whether a GGUF takes video, so the flag travels from
// /props to the model row and the adapter reads it off that row. Every hop that
// carries the audio flag has to carry this one too: a hop that drops it leaves
// the adapter reading false and refusing video on a model that supports it.
// Two separate hops (syncModelCapabilities, then the direct status adoption)
// were each missing it, hence a rule rather than two spot checks.

const SRC = new URL("../src/", import.meta.url);

async function sourceFiles(dir: URL): Promise<URL[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: URL[] = [];
  for (const entry of entries) {
    if (entry.name === "node_modules") continue;
    if (entry.isDirectory()) {
      found.push(...(await sourceFiles(new URL(`${entry.name}/`, dir))));
    } else if (/\.tsx?$/.test(entry.name)) {
      found.push(new URL(entry.name, dir));
    }
  }
  return found;
}

const rel = (file: URL) =>
  path.relative(fileURLToPath(SRC), fileURLToPath(file)).replaceAll(path.sep, "/");

test("every mapper that writes hasAudioInput writes hasVideoInput too", async () => {
  const files = await sourceFiles(SRC);
  const dropped: string[] = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    // Only object assignments carry capabilities; interface props describe UI contracts.
    const ast = ts.createSourceFile(file.pathname, source, ts.ScriptTarget.Latest, true);
    let writesAudioInput = false;
    const visit = (node: ts.Node): void => {
      if (ts.isPropertyAssignment(node) && node.name.getText(ast) === "hasAudioInput") {
        writesAudioInput = true;
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
    if (!writesAudioInput) continue;
    // The runtime type declares both as optional fields, not a mapping.
    if (rel(file) === "features/chat/types/runtime.ts") continue;
    if (!/\bhasVideoInput\s*:/.test(source)) dropped.push(rel(file));
  }
  assert.deepEqual(dropped, []);
});

test("the direct status adoption carries the video capability", async () => {
  const source = await readFile(
    new URL("features/chat/lib/apply-inference-status-to-store.ts", SRC),
    "utf8",
  );
  // This path never calls syncModelCapabilities, so whatever it omits here is
  // simply absent from the row a server-adopted GGUF gets.
  const caps = source.slice(
    source.indexOf("function ensureActiveModelInStoreList"),
    source.indexOf("const existing = store.models.find"),
  );
  assert.match(caps, /hasAudioInput:\s*status\.has_audio_input/);
  assert.match(caps, /hasVideoInput:\s*status\.has_video_input/);
});

test("the video drain names video when a clip cannot be read", async () => {
  const source = await readFile(
    new URL("components/assistant-ui/thread.tsx", SRC),
    "utf8",
  );
  // The toast was localized in the i18n pass; it now uses uiTranslate with the
  // key "ui.could_not_attach_dropped_video". Verify the key carries "video" so
  // the drain is still clearly identified as the video path, not the audio one.
  const drain = source.slice(source.indexOf("claimVideoAttachments"));
  const i18nKey = drain.match(/toast\.error\(uiTranslate\(["']ui\.could_not_attach_dropped_(\w+)["']\)/)?.[1];
  assert.equal(i18nKey, "video");
});
