import assert from "node:assert/strict";
import test from "node:test";
import { setLocale } from "../src/i18n/locale-store.ts";
import { translate } from "../src/i18n/messages.ts";
import { localizeUiMessage } from "../src/i18n/localize-message.ts";
import {
  WORK_FILTERS,
  WORK_STATUS_LABELS,
} from "../src/features/work/work-view-model.ts";

test("switching languages updates shared labels without changing identifiers or content", async () => {
  await setLocale("en");
  assert.equal(localizeUiMessage("Error de conexión"), "Connection error");
  await setLocale("es");
  assert.equal(
    translate("settings.keyboardShortcuts.actions.newChat.label"),
    "Nuevo chat",
  );
  const spanishStatus = WORK_STATUS_LABELS.queued;
  assert.equal(localizeUiMessage("Connection error"), "Error de conexión");
  assert.equal(WORK_FILTERS[2].value, "active");
  await setLocale("en");
  assert.notEqual(WORK_STATUS_LABELS.queued, spanishStatus);
  assert.equal(localizeUiMessage("Error de conexión"), "Connection error");
  assert.equal(
    localizeUiMessage("External provider: custom diagnostic 418"),
    "External provider: custom diagnostic 418",
  );
  assert.equal(
    translate("ui.new_chat_in_value0", { value0: "Mi proyecto" }),
    "New chat in Mi proyecto",
  );
});
