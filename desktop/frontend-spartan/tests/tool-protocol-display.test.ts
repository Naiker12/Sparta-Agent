import assert from "node:assert/strict";
import test from "node:test";
import { cleanToolProtocolDisplay as clean } from "../src/features/chat/utils/tool-protocol-display.ts";

test("empty protocol debris disappears without hiding actual results", () => {
  assert.equal(clean("Moviendo archivos\n<tool_call>\n</tool_call> <tool_call>\n</tool_call>\nListo", true), "Moviendo archivos\nListo");
  assert.equal(clean("<tool_call>\n</tool_call>", false), "<tool_call>\n</tool_call>");
  assert.equal(clean('<tool_call>{"name":"rename_path"}</tool_call>', true), '<tool_call>{"name":"rename_path"}</tool_call>');
});

test("code examples and inline documentation remain intact", () => {
  for (const text of [
    "```xml\n<tool_call>\n</tool_call>\n```",
    "~~~~xml\n<tool_call>\n```\n</tool_call>\n~~~~",
    "    <tool_call>\n    </tool_call>",
    "El marcador <tool_call> indica una llamada.",
    "`<tool_call>`", "&lt;tool_call&gt;",
  ]) assert.equal(clean(text, true), text);
});

test("split protocol tokens are hidden only on a tool message streaming tail", () => {
  for (const token of ["<tool_call>", "</tool_call>"]) {
    for (let n = 6; n <= token.length; n++) assert.equal(clean(token.slice(0, n), true, true), "");
  }
  assert.equal(clean("<tool_", false, true), "<tool_");
  assert.equal(clean("<tool_", true, false), "<tool_");
  assert.equal(clean("```\n<tool_", true, true), "```\n<tool_");
});
