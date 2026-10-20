import assert from "node:assert/strict";
import test from "node:test";
import { bindChatRunSettings } from "../src/features/chat/utils/queued-chat-run-settings.ts";

type State = Parameters<typeof bindChatRunSettings>[0];
const state = (checkpoint: string) => ({
  params: { checkpoint, temperature: 0.3 },
  toolsEnabled: false,
  bypassPermissions: false,
  confirmToolCalls: true,
  permissionMode: "ask",
  supportsTools: false,
  reasoningEffortLevels: ["low"],
  modelLoading: true,
}) as unknown as State;

test("concurrent sends retain their model, parameters and permissions after navigation", () => {
  const a = state("model-a");
  const b = { ...state("model-b"), toolsEnabled: true, bypassPermissions: true };
  const readA = bindChatRunSettings(a);
  const readB = bindChatRunSettings(b);
  a.params.temperature = 1;
  const live = { ...b, modelLoading: false };
  assert.equal(readA(live).params.checkpoint, "model-a");
  assert.equal(readA(live).params.temperature, 0.3);
  assert.equal(readA(live).toolsEnabled, false);
  assert.equal(readA(live).bypassPermissions, false);
  assert.equal(readA(live).confirmToolCalls, true);
  assert.equal(readA(live).modelLoading, false);
  assert.equal(readB(live).params.checkpoint, "model-b");
  assert.equal(readB(live).toolsEnabled, true);
  const result = readA(live);
  result.params.temperature = 2;
  assert.equal(readA(live).params.temperature, 0.3);
});

test("auto-loading fills an empty model without adopting another chat's permission choices", () => {
  const read = bindChatRunSettings(state(""));
  const loaded = {
    ...state("loaded-model"), supportsTools: true,
    toolsEnabled: true, bypassPermissions: true,
  };
  const run = read(loaded);
  assert.equal(run.params.checkpoint, "loaded-model");
  assert.equal(run.supportsTools, true);
  assert.equal(run.toolsEnabled, false);
  assert.equal(run.bypassPermissions, false);
  assert.equal(run.params.temperature, 0.3);
});
