import assert from "node:assert/strict";
import test from "node:test";
import { CHAT_PANE_LAYOUT_KEY, parsePaneLayout, readPaneLayout, writePaneLayout } from "../src/features/chat/utils/pane-layout.ts";

test("only saved unique chat ids and a valid focused chat survive decoding", () => {
  assert.deepEqual(parsePaneLayout(JSON.stringify({version: 1, threadIds: ["alpha", "alpha", null, "__LOCALID_new", "beta", "gamma", "fourth"], focusedThreadId: "beta", messages: ["private content"]})), {
    threadIds: ["alpha", "beta", "gamma"], focusedThreadId: "beta",
  });
  assert.deepEqual(parsePaneLayout('{"version":1,"threadIds":["alpha"],"focusedThreadId":"other"}'), {threadIds: ["alpha"], focusedThreadId: null});
  for (const raw of [null, "invalid", "null", '{"version":2,"threadIds":["alpha"]}']) assert.deepEqual(parsePaneLayout(raw), {threadIds: [], focusedThreadId: null});
});

test("storage failures are harmless and closing the last panel removes its layout", () => {
  const rows = new Map<string, string>();
  const storage = {getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => {rows.set(key, value);}, removeItem: (key: string) => {rows.delete(key);}};
  writePaneLayout(storage, {threadIds: ["alpha"], focusedThreadId: "alpha"});
  assert.deepEqual(readPaneLayout(storage), {threadIds: ["alpha"], focusedThreadId: "alpha"});
  assert.deepEqual(Object.keys(JSON.parse(rows.get(CHAT_PANE_LAYOUT_KEY)!)).sort(), ["focusedThreadId", "threadIds", "version"]);
  writePaneLayout(storage, {threadIds: [], focusedThreadId: null});
  assert.equal(rows.has(CHAT_PANE_LAYOUT_KEY), false);
  const blocked = {getItem: () => {throw new Error("blocked");}, setItem: () => {throw new Error("quota");}, removeItem: () => {throw new Error("blocked");}};
  assert.deepEqual(readPaneLayout(blocked), {threadIds: [], focusedThreadId: null});
  assert.doesNotThrow(() => writePaneLayout(blocked, {threadIds: ["alpha"], focusedThreadId: null}));
});
