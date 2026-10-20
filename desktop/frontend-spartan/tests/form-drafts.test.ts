import assert from "node:assert/strict";
import test from "node:test";
import { readFormDraft, writeFormDraft, removeFormDraft } from "../src/features/chat/response-ui/form-drafts.ts";
import type { FormBlock } from "../src/features/chat/response-ui/panels.ts";

const storage = Object.create(null);
Object.defineProperties(storage, {
  getItem: {value: (key: string) => storage[key] ?? null},
  setItem: {value: (key: string, value: string) => {storage[key] = value;}},
  removeItem: {value: (key: string) => {delete storage[key];}},
});
Object.defineProperty(globalThis, "localStorage", {value: storage, configurable: true});
const form: FormBlock = {kind: "form", id: "task", title: "Task", fields: [
  {id: "name", label: "Name", type: "text"},
  {id: "budget", label: "Budget", type: "number"},
  {id: "research", label: "Research", type: "checkbox"},
]};

test("drafts retain incomplete input across remounts and stay isolated by thread and schema", () => {
  const values = {name: "Draft", budget: "0", research: false};
  writeFormDraft("thread-a:tool-a", form, values);
  assert.deepEqual(readFormDraft("thread-a:tool-a", form), values);
  assert.deepEqual(readFormDraft("thread-b:tool-a", form), {});
  assert.deepEqual(readFormDraft("thread-a:tool-a", {...form, fields: [{id: "other", label: "Other", type: "text"}]}), {});
  removeFormDraft("thread-a:tool-a", form);
  assert.deepEqual(readFormDraft("thread-a:tool-a", form), {});
});
test("temporary forms do not persist and broken or expired caches do not block editing", () => {
  writeFormDraft(undefined, form, {name: "temporary"});
  assert.deepEqual(readFormDraft(undefined, form), {});
  writeFormDraft("expired", form, {name: "old"});
  const key = Object.keys(storage)[0];
  storage[key] = JSON.stringify({savedAt: 1, values: {name: "old"}});
  assert.deepEqual(readFormDraft("expired", form), {});
  storage[key] = "invalid";
  assert.deepEqual(readFormDraft("expired", form), {});
});
