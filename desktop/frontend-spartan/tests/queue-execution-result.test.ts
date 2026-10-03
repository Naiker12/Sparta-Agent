import assert from "node:assert/strict";
import test from "node:test";
import { queueExecutionResult } from "../src/features/chat/utils/queue-execution-result.ts";

const baseline = new Set(["old"]);
const message = (type: string, reason?: string) => ({ id: "new", role: "assistant", content: [{ type: "text", text: "Respuesta" }], status: { type, reason } });
test("only a new complete response confirms completion", () => {
  assert.equal(queueExecutionResult([{ ...message("complete"), id: "old" }], baseline).status, "needs_review");
  assert.equal(queueExecutionResult([message("running")], baseline).status, "needs_review");
  assert.equal(queueExecutionResult([message("complete")], baseline).status, "completed");
  assert.equal(queueExecutionResult([message("complete")], null).status, "needs_review");
});
test("error, cancellation and incomplete responses remain distinct", () => {
  assert.equal(queueExecutionResult([message("incomplete", "error")], baseline).status, "failed");
  assert.equal(queueExecutionResult([message("incomplete", "cancelled")], baseline).status, "cancelled");
  assert.equal(queueExecutionResult([message("incomplete", "length")], baseline).status, "needs_review");
  assert.equal(queueExecutionResult([{ ...message("complete"), metadata: { custom: { incomplete: true } } }], baseline).status, "needs_review");
});
test("preview excludes reasoning and tool data and limits output", () => {
  const result = queueExecutionResult([{ ...message("complete"), content: [{ type: "reasoning", text: "private" }, { type: "tool-call", text: "secret" }, { type: "text", text: "a".repeat(3000) }] }], baseline);
  assert.equal(result.summary, "a".repeat(2000));
});
