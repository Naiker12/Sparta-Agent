import assert from "node:assert/strict";
import test from "node:test";
import { QueueCheckpointWriter } from "../src/features/chat/utils/queue-checkpoint-writer.ts";
import { durableQueueSettings } from "../src/features/chat/utils/durable-queue-settings.ts";
import type { QueuedChatRunSettings } from "../src/features/chat/utils/queued-chat-run-settings.ts";

test("concurrent local changes are written in order with server revisions", async () => {
  const calls: Array<[string, number]> = [];
  const writer = new QueueCheckpointWriter<string>(async (snapshot, revision) => {
    calls.push([snapshot, revision]);
    await new Promise((resolve) => setTimeout(resolve, 1));
    return revision + 1;
  });
  await Promise.all([writer.write("queued"), writer.write("edited"), writer.write("dispatched")]);
  assert.deepEqual(calls, [["queued", 0], ["edited", 1], ["dispatched", 2]]);
});

test("lost acknowledgement retries exact content before applying a later edit", async () => {
  const calls: Array<[string, number]> = [];
  let first = true;
  const writer = new QueueCheckpointWriter<string>(async (snapshot, revision) => {
    calls.push([snapshot, revision]);
    if (first) { first = false; throw new Error("response lost"); }
    return revision + 1;
  });
  await assert.rejects(writer.write("before"));
  await writer.write("after");
  assert.deepEqual(calls, [["before", 0], ["before", 0], ["after", 1]]);
});

test("persistent conflict does not silently skip the uncertain write", async () => {
  const calls: Array<string> = [];
  const writer = new QueueCheckpointWriter<string>(async (snapshot) => {
    calls.push(snapshot);
    throw new Error("conflict");
  }, 7);
  await assert.rejects(writer.write("original"));
  await assert.rejects(writer.write("new"));
  assert.deepEqual(calls, ["original", "original"]);
});

test("recovery downgrades full access without mutating the live session", () => {
  const live = { permissionMode: "full", bypassPermissions: true, confirmToolCalls: false,
    params: { checkpoint: "external:model" },
    researchWebsitePolicy: { allowedDomains: ["example.com"], blockedDomains: [] },
  } as unknown as QueuedChatRunSettings;
  const saved = durableQueueSettings(live);
  assert.equal(saved.permissionMode, "ask");
  assert.equal(saved.bypassPermissions, false);
  assert.equal(saved.confirmToolCalls, true);
  saved.researchWebsitePolicy.allowedDomains.push("other.com");
  assert.equal(live.permissionMode, "full");
  assert.deepEqual(live.researchWebsitePolicy.allowedDomains, ["example.com"]);
});
