import assert from "node:assert/strict";
import test from "node:test";
import type { ThreadMessage } from "@assistant-ui/react";
import { copyPaneContext } from "../src/features/chat/utils/pane-context.ts";
import { PANE_EVIDENCE_LIMITS, paneContextEvidence } from "../src/features/chat/utils/pane-context-evidence.ts";

test("context copying creates an independent branch and strips execution and approval metadata", () => {
  const source = [
    {id: "old-user", role: "user", content: [{type: "text", text: "Objetivo y decisiones"}], attachments: [{id: "private-file"}], metadata: {custom: {responseUiSubmission: {toolCallId: "old-tool"}}}},
    {id: "old-assistant", role: "assistant", content: [{type: "text", text: "Pendiente: revisar pruebas"}, {type: "tool-call", toolCallId: "old-tool", toolName: "terminal", args: {}, result: "done"}]},
  ] as unknown as ThreadMessage[];
  const before = structuredClone(source);
  let next = 0;
  const copied = copyPaneContext(source, "new-thread", () => `new-${++next}`, 100);
  assert.equal(copied[0].id, "new-1");
  assert.equal(copied[1].parentId, "new-1");
  assert.ok(copied.every(message => message.threadId === "new-thread" && !message.metadata && !message.attachments));
  assert.match(JSON.stringify(copied), /Objetivo y decisiones/);
  assert.match(JSON.stringify(copied), /Pendiente: revisar pruebas/);
  assert.ok(copied.every(message => message.content.every(part => part.type === "text")));
  assert.deepEqual(source, before);
});

test("only messages from the supplied visible branch are copied", () => {
  const source = [{role: "user", content: [{type: "text", text: "Visible"}]}] as ThreadMessage[];
  assert.equal(copyPaneContext(source, "target").length, 1);
  assert.deepEqual(copyPaneContext([], "target"), []);
});

test("completed results become readable context while commands, sessions and approvals stay behind", () => {
  const source = [{role: "assistant", content: [
    {type: "tool-call", toolName: "terminal", args: {command: "DO_NOT_COPY_COMMAND"}, result: {stdout: "12 pruebas superadas", exit_code: 0, sessionId: "DO_NOT_COPY_SESSION", apiKey: "DO_NOT_COPY_KEY"}},
    {type: "tool-call", toolName: "pending_tool", args: {path: "DO_NOT_COPY_PATH"}},
    {type: "tool-call", toolName: "failed_tool", isError: true, result: "El archivo no existe"},
    {type: "tool-call", toolName: "present_ui", result: {fallbackText: "Prioridad: Alta", panel: {blocks: [{kind: "form"}]}}},
  ]}] as unknown as ThreadMessage[];
  const copied = JSON.stringify(copyPaneContext(source, "target", undefined, undefined, "es"));
  assert.match(copied, /12 pruebas superadas/);
  assert.match(copied, /exit_code: 0/);
  assert.match(copied, /Acción sin resultado final/);
  assert.match(copied, /Resultado con error: failed_tool/);
  assert.match(copied, /Prioridad: Alta/);
  assert.doesNotMatch(copied, /DO_NOT_COPY|"tool-call"|"form"|"args"/);
});

test("sources, file names and extracted text survive without transferring binaries or local access", () => {
  const source = [{role: "user", content: [
    {type: "text", text: "Revisar el plan"},
    {type: "source", title: "Referencia", url: "https://example.org/research"},
    {type: "source", title: "Unsafe", url: "javascript:alert(1)"},
    {type: "image", image: "data:image/png;base64,DO_NOT_COPY_BINARY"},
  ], attachments: [{name: "C:\\private\\plan.pdf", content: [{type: "text", text: "Extracto: objetivo y presupuesto"}, {type: "file", data: "DO_NOT_COPY_BINARY"}]}]}] as unknown as ThreadMessage[];
  const copied = JSON.stringify(copyPaneContext(source, "target", undefined, undefined, "es"));
  assert.match(copied, /https:\/\/example.org\/research/);
  assert.match(copied, /plan.pdf/);
  assert.match(copied, /Extracto: objetivo y presupuesto/);
  assert.match(copied, /contenido completo no transferido/);
  assert.doesNotMatch(copied, /DO_NOT_COPY|C:|private|javascript:/);
});

test("structured JSON results expose only selected display fields and large evidence is bounded", () => {
  const message = {role: "assistant", content: [{type: "tool-call", toolName: "search", result: JSON.stringify({results: [{title: "Evidence", snippet: "Relevant fact", url: "https://example.org/source"}], access_token: "DO_NOT_COPY_TOKEN"})}]} as unknown as ThreadMessage;
  const evidence = paneContextEvidence(message, false, 1000);
  assert.match(evidence, /Relevant fact/);
  assert.doesNotMatch(evidence, /DO_NOT_COPY_TOKEN|access_token/);
  const huge = {role: "assistant", content: Array.from({length: 30}, () => ({type: "tool-call", toolName: "terminal", result: "x".repeat(30000)}))} as unknown as ThreadMessage;
  assert.ok(paneContextEvidence(huge, true, 1200).length <= 1200);
  assert.match(paneContextEvidence(huge, true, 1200), /Referencia recortada/);
  const copied = copyPaneContext(Array.from({length: 30}, () => huge), "target");
  const chars = copied.reduce((total, row) => total + row.content.reduce((sum, part) => sum + (part.type === "text" ? part.text.length : 0), 0), 0);
  assert.ok(chars <= PANE_EVIDENCE_LIMITS.totalChars);
  assert.ok(chars > 0);
});

test("sandbox file envelopes retain file references but omit embedded image data", () => {
  const message = {role: "assistant", content: [{type: "tool-call", toolName: "python", result: 'Informe preparado\n__FILES__:[{"name":"report.pdf","size":20}]\n__IMAGES__:["DO_NOT_COPY_BINARY"]'}]} as unknown as ThreadMessage;
  const evidence = paneContextEvidence(message, true, 4000);
  assert.match(evidence, /Informe preparado/);
  assert.match(evidence, /report.pdf/);
  assert.doesNotMatch(evidence, /DO_NOT_COPY_BINARY|__IMAGES__|__FILES__/);
});

test("recent evidence takes priority without changing the order or text of the conversation", () => {
  const messages = Array.from({length: 12}, (_, index) => ({role: "assistant", content: [
    {type: "text", text: `Mensaje ${index}`},
    {type: "tool-call", toolName: "terminal", result: `Resultado ${index}: ${"x".repeat(20000)}`},
  ]})) as unknown as ThreadMessage[];
  const copied = copyPaneContext(messages, "target");
  const serialized = JSON.stringify(copied);
  assert.match(serialized, /Resultado 11:/);
  assert.doesNotMatch(serialized, /Resultado 0:/);
  assert.equal(copied.length, 12);
  assert.equal(copied[0].content[0].type === "text" && copied[0].content[0].text, "Mensaje 0");
});
