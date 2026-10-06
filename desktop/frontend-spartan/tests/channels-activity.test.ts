import assert from "node:assert/strict";
import test from "node:test";
import {
  activityCounts,
  activityType,
  filterActivity,
} from "../src/features/channels/activity-model.ts";
const events = [
  { id: 4, account_id: "a", code: "reply_sent", created_at: 4 },
  { id: 3, account_id: "b", code: "credentials_error", created_at: 3 },
  { id: 2, account_id: "a", code: "pairing_approved", created_at: 2 },
  { id: 1, account_id: "a", code: "future_code", created_at: 1 },
];
test("activity combines bot and category filters without reordering events", () => {
  assert.deepEqual(
    filterActivity(events, "a", "all").map((item) => item.id),
    [4, 2, 1],
  );
  assert.deepEqual(filterActivity(events, "a", "errors"), []);
  assert.deepEqual(
    filterActivity(events, "all", "errors").map((item) => item.id),
    [3],
  );
  assert.deepEqual(activityCounts(events), {
    responses: 1,
    errors: 1,
    connections: 1,
    other: 1,
  });
});
test("unknown activity is informational rather than a fabricated error", () => {
  assert.deepEqual(activityType("future_code"), ["other", "unknown"]);
  assert.deepEqual(activityType("consumer_conflict"), [
    "errors",
    "consumerConflict",
  ]);
});
