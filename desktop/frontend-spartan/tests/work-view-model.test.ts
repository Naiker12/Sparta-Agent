import assert from "node:assert/strict";
import test from "node:test";
import { visibleWork, workExplanation } from "../src/features/work/work-view-model.ts";
import type { WorkRun } from "../src/features/work/types.ts";

const run = (status: WorkRun["status"]): WorkRun => ({ id: status, status, created_at: 1, updated_at: 1, attempt: 0, source_kind: "chat_queue", source_thread_id: "chat", source_queue_id: "queue", source_item_id: "item", thread_title: "Formulario", project_name: "Tienda", request: { promptPreview: "Revisa contacto" }, result: { summary: "Validación corregida" } });
test("review includes uncertain and failed work, never completed work", () => {
  const rows = [run("completed"), run("failed"), run("needs_review"), run("running")];
  assert.deepEqual(visibleWork(rows, "review", "").map((item) => item.status), ["failed", "needs_review"]);
  assert.equal(visibleWork(rows, "active", "")[0].status, "running");
});
test("search matches chat, project and result with normalized case", () => {
  for (const query of ["FORMULARIO", "tienda", "corregida", "contacto"]) assert.equal(visibleWork([run("queued")], "all", query).length, 1);
  assert.equal(visibleWork([run("queued")], "all", "inexistente").length, 0);
});
test("manual queued work does not imply an attached executor", () => {
  assert.match(workExplanation({ ...run("queued"), source_kind: "manual" }), /no tiene un ejecutor/);
  assert.match(workExplanation(run("needs_review")), /No hay confirmación/);
  assert.equal(workExplanation(run("paused")), "La solicitud está pausada.");
});
