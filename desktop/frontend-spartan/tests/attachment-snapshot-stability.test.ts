import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/components/assistant-ui/attachment.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("attachment.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const selectors: Array<(state: any) => unknown> = [];
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "AttachmentUI") {
    function collect(child: ts.Node) {
      if (ts.isCallExpression(child) && child.expression.getText(ast) === "useAuiState") {
        const expression = child.arguments[0].getText(ast);
        const js = ts.transpile(`const select = ${expression};`, { target: ts.ScriptTarget.ES2022 });
        selectors.push(new Function("getAttachmentFileKind", `${js}; return select;`)(
          (_name: string, mime: string) => mime.startsWith("audio/") ? "audio" : mime.startsWith("video/") ? "video" : "unknown",
        ));
      }
      ts.forEachChild(child, collect);
    }
    collect(node);
  } else ts.forEachChild(node, visit);
}
visit(ast);

// React's external-store hook reads a snapshot repeatedly without a store
// update. Object.is must hold, otherwise it schedules an endless render loop.
for (const [name, mime, type] of [
  ["report.pdf", "application/pdf", "document"],
  ["report.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "document"],
  ["notes.txt", "text/plain", "document"],
  ["photo.png", "image/png", "image"],
  ["voice.wav", "audio/wav", "file"],
] as const) {
  for (const sent of [false, true]) {
    test(`${sent ? "sent" : "pending"} ${name} has stable attachment snapshots`, () => {
      assert.ok(selectors.length >= 6, "exercise the actual AttachmentUI subscriptions");
      const file = new File(["fixture"], name, { type: mime });
      const part = type === "image"
        ? { type: "image", image: "data:image/png;base64,dGVzdA==" }
        : { type: "file", data: "data:application/octet-stream;base64,dGVzdA==", mimeType: mime };
      const state = { attachment: { id: "a1", name, type, contentType: mime, file: sent ? undefined : file, content: sent ? [part] : [] } };
      for (const select of selectors) {
        const first = select(state);
        for (let i = 0; i < 60; i++) assert.ok(Object.is(first, select(state)), "unchanged store must not allocate a new snapshot");
      }
      assert.ok(selectors.some(select => select(state) === (sent ? type === "image" ? part.image : part : file)), "preview retains its actual source reference");
      const renamed = { attachment: { ...state.attachment, name: "renamed.txt" } };
      assert.ok(selectors.some(select => select(renamed) === "renamed.txt"), "real store changes remain observable");
    });
  }
}
