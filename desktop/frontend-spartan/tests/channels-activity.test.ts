import assert from "node:assert/strict";
import test from "node:test";
import {
  activityCounts,
  activityPage,
  activityType,
  filterActivity,
} from "../src/features/channels/activity-model.ts";
const events = [
  { id: 4, account_id: "a", code: "reply_sent", created_at: 4 },
  { id: 3, account_id: "b", code: "credentials_error", created_at: 3 },
  { id: 2, account_id: "a", code: "pairing_approved", created_at: 2 },
  { id: 1, account_id: "a", code: "future_code", created_at: 1 },
];
test("pagination bounds each page and clamps after filtering", () => {
  const many = Array.from({ length: 19 }, (_, id) => ({ ...events[0], id }));
  assert.equal(activityPage(many, 0).events.length, 8);
  assert.equal(activityPage(many, 2).events.length, 3);
  assert.equal(activityPage(events, 20).page, 0);
  assert.equal(activityPage([], 0).pages, 1);
  assert.deepEqual(
    activityPage(many, 1).events.map((item) => item.id),
    [8, 9, 10, 11, 12, 13, 14, 15],
  );
});
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

test("photo events distinguish discovery, delivery and incomplete delivery", () => {
  assert.deepEqual(activityType("image_search_completed"), [
    "other",
    "imageSearchCompleted",
  ]);
  assert.deepEqual(activityType("photo_sent"), ["other", "photoSent"]);
  assert.deepEqual(activityType("photo_unavailable"), [
    "errors",
    "photoUnavailable",
  ]);
  assert.deepEqual(activityType("delivery_cancelled"), [
    "other",
    "deliveryCancelled",
  ]);
});

test("voice preparation and transcription are separate from delivered replies", () => {
  assert.deepEqual(activityType("voice_preparation_requested"), [
    "connections",
    "voicePreparationRequested",
  ]);
  assert.deepEqual(activityType("audio_transcription_completed"), [
    "other",
    "audioTranscriptionCompleted",
  ]);
  assert.deepEqual(activityType("audio_transcription_failed"), [
    "errors",
    "audioTranscriptionFailed",
  ]);
});
