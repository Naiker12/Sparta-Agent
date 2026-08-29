import assert from "node:assert/strict";
import test from "node:test";
import { buildCurrentTemporalContext } from "../src/features/chat/api/chat-adapter/system-prompt.ts";

test("every chat can receive local date, time, day and timezone context", () => {
  const context = buildCurrentTemporalContext("en-US", new Date(2026, 7, 29, 14, 5, 6));

  assert.match(context, /<current_datetime>/);
  assert.match(context, /Local date: 2026-08-29/);
  assert.match(context, /Local time: 14:05:06[+-]\d{2}:\d{2}/);
  assert.match(context, /Day of week: /);
  assert.match(context, /Time zone: /);
  assert.match(context, /tomorrow/);
});
