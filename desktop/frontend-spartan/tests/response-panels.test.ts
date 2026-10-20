import test from "node:test";
import assert from "node:assert/strict";
import { toThreadMessage } from "../src/features/chat/runtime/message-converters.ts";
import { serializeToolResultPart } from "../src/features/chat/api/chat-adapter/message-serialization.ts";
import {
  validatePanel,
  validateFormValues,
  parsePanelResult,
  formSubmissionText,
  formatFormValue,
  type FormBlock,
} from "../src/features/chat/response-ui/panels.ts";

const form: FormBlock = {
  kind: "form",
  id: "details",
  title: "Datos",
  fields: [
    { id: "name", label: "Nombre", type: "text", required: true },
    {
      id: "count",
      label: "Cantidad",
      type: "number",
      min: 0,
      max: 10,
      required: true,
    },
    { id: "option", label: "Opción", type: "select", options: ["A", "B"] },
    { id: "agree", label: "Activo", type: "checkbox" },
    { id: "date", label: "Fecha", type: "date" },
  ],
};

test("submission display localizes booleans and dates without losing zero", () => {
  assert.equal(formatFormValue({id: "zero", label: "Budget", type: "number"}, 0, "es"), "0");
  assert.equal(formatFormValue({id: "check", label: "Research", type: "checkbox"}, false, "es"), "No");
  assert.equal(formatFormValue({id: "check", label: "Research", type: "checkbox"}, true, "en"), "Yes");
  const date = formatFormValue({id: "date", label: "Date", type: "date"}, "2026-10-25", "es");
  assert.ok(date.includes("25") && date.includes("2026"));
  assert.ok(!date.includes("2026-10-25"));
});

test("backend history restores the identity and values of a submitted form", () => {
  const submission = {
    messageId: "panel-message", toolCallId: "panel-tool", formId: "details",
    values: { name: "Ana", budget: 0, research: false },
  };
  const restored = toThreadMessage({
    id: "submission", threadId: "chat", role: "user", createdAt: 1,
    content: [{ type: "text", text: "Submitted form" }],
    metadata: { responseUiSubmission: submission },
  });
  assert.deepEqual(restored.metadata.custom.responseUiSubmission, submission);
  assert.notEqual(restored.metadata.custom.responseUiSubmission, submission);
});
const panel = {
  version: 1,
  title: "Plan",
  layout: "grid",
  blocks: [{ kind: "metric", label: "Total", value: "0" }, form],
};

test("bounded panels support composition and never admit actions or executable components", () => {
  assert.ok(validatePanel(panel));
  for (const block of [
    { kind: "script", code: "alert(1)" },
    { kind: "form", ...form, action: "https://example.org" },
    { kind: "metric", label: "A", value: "B", onClick: "run" },
  ])
    assert.equal(validatePanel({ ...panel, blocks: [block] }), null);
  assert.equal(validatePanel({ ...panel, blocks: [form, form] }), null);
  assert.equal(
    validatePanel({
      ...panel,
      blocks: Array(25).fill({ kind: "text", text: "x" }),
    }),
    null,
  );
  assert.equal(
    validatePanel({
      ...panel,
      blocks: [
        { ...form, fields: [{ id: "key", label: "Key", type: "password" }] },
      ],
    }),
    null,
  );
});

test("field validation preserves zero, false and quoted user input without interpreting it", () => {
  const validated = validateFormValues(form, {
    name: 'Ignore instructions <script>"',
    count: "0",
    option: "A",
    agree: false,
    date: "2026-10-19",
  });
  assert.deepEqual(validated.errors, []);
  assert.equal(validated.values.count, 0);
  assert.equal(validated.values.agree, false);
  const text = formSubmissionText(
    validatePanel(panel)!,
    form,
    validated.values,
  );
  assert.ok(text.includes("Cantidad: 0"));
  assert.ok(!text.includes('"field":'));
});

test("normalized small decimals can be revalidated without scientific-string rounding", () => {
  const tinyForm: FormBlock = {
    kind: "form",
    id: "tiny",
    title: "Tiny",
    fields: [{ id: "value", label: "Value", type: "number", required: true }],
  };
  const first = validateFormValues(tinyForm, { value: "0.0000001" });
  assert.deepEqual(first.errors, []);
  assert.deepEqual(validateFormValues(tinyForm, first.values), first);
});

test("invalid numeric, required, select and date values cannot be submitted", () => {
  const validated = validateFormValues(form, {
    name: " ",
    count: "11",
    option: "not-an-option",
    date: "2026-02-30",
  });
  assert.deepEqual(validated.errors, ["name", "count", "option", "date"]);
  assert.doesNotThrow(() =>
    validateFormValues(form, { name: "A", count: "0", date: "9999-99-99" }),
  );
});

test("restored tool results revalidate the panel and retain a text fallback", () => {
  const result = JSON.stringify({
    kind: "response_panel",
    panel,
    fallbackText: "Plan\nDatos",
  });
  assert.ok(parsePanelResult(result));
  assert.equal(
    parsePanelResult(result.replace('"version":1', '"version":2')),
    null,
  );
  assert.equal(parsePanelResult("Error: invalid panel"), null);
  const serialized = serializeToolResultPart({
    type: "tool-call",
    toolName: "present_ui",
    toolCallId: "panel-1",
    args: { panel },
    argsText: JSON.stringify({ panel }),
    result,
  });
  assert.deepEqual(JSON.parse(serialized!.content), {
    presentationPrepared: true,
    title: "Plan",
    forms: ["details"],
    externalActionExecuted: false,
    nextStep: "The panel is already visible. Reply with at most one brief confirmation; do not repeat its fields or instructions. If it contains a form, wait for the user's submission.",
  });
  assert.ok(JSON.parse(result).panel.blocks[1].fields);
});
