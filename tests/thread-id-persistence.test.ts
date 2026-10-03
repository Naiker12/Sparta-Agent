import { expect, test } from "vitest";
import { isAssistantLocalThreadId, notePersistedThreadId } from "../desktop/frontend-spartan/src/features/chat/utils/thread-ids";

test("provisional IDs avoid backend reads while older saved chats remain readable", () => {
  const id = "__LOCALID_legacy-regression";
  expect(isAssistantLocalThreadId(id)).toBe(true);
  notePersistedThreadId(id);
  expect(isAssistantLocalThreadId(id)).toBe(false);
  expect(isAssistantLocalThreadId("__LOCALID_new-regression")).toBe(true);
  expect(isAssistantLocalThreadId(null)).toBe(false);
});
