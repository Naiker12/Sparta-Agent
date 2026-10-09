import assert from "node:assert/strict";
import test from "node:test";
import { useSettingsDialogStore as store } from "../src/features/settings/stores/settings-dialog-store.ts";

test("a connection target survives lazy loading and reselecting its settings tab", () => {
  store.getState().closeDialog();
  store
    .getState()
    .openDialog("channels-permissions", { channelAccountId: "second-bot" });
  assert.equal(store.getState().channelAccountId, "second-bot");
  store.getState().setActiveTab("channels-permissions");
  store.getState().openDialog();
  assert.equal(store.getState().channelAccountId, "second-bot");
  store
    .getState()
    .openDialog("channels-permissions", { channelAccountId: "first-bot" });
  assert.equal(store.getState().channelAccountId, "first-bot");
});

test("closing or leaving channel settings discards a stale connection target", () => {
  store
    .getState()
    .openDialog("channels-permissions", { channelAccountId: "second-bot" });
  store.getState().setActiveTab("voice");
  assert.equal(store.getState().channelAccountId, null);
  store.getState().openDialog("channels-permissions");
  assert.equal(store.getState().channelAccountId, null);
  store
    .getState()
    .openDialog("channels-permissions", { channelAccountId: "first-bot" });
  store.getState().closeDialog();
  assert.equal(store.getState().channelAccountId, null);
});
