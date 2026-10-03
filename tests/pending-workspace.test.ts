import { beforeEach, expect, it, vi } from "vitest";

vi.mock("../desktop/frontend-spartan/src/features/chat/api/modules/workspaces-api", () => ({
  bindThreadWorkspace: vi.fn(async (threadId, folder, access) => ({threadId, canonicalPath: folder, access, bindingId: threadId})),
  getThreadWorkspace: vi.fn(async () => null),
}));
import { getPendingWorkspace, setPendingWorkspace, ensureThreadWorkspace } from "../desktop/frontend-spartan/src/features/chat/utils/pending-workspace";

function storage() {
  const values = new Map<string, string>();
  return {getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key)};
}
beforeEach(() => {
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("sessionStorage", storage());
  vi.stubGlobal("window", {dispatchEvent: vi.fn()});
});
it("retains a draft outside session storage without expanding access", () => {
  setPendingWorkspace({folder: "D:/work", access: "write_no_delete"});
  vi.stubGlobal("sessionStorage", storage());
  expect(getPendingWorkspace()).toEqual({folder: "D:/work", access: "write_no_delete"});
});
it("rejects malformed saved capabilities and disconnect clears both stores", () => {
  localStorage.setItem("sparta.pending-workspace", JSON.stringify({folder: "D:/work", access: "full"}));
  expect(getPendingWorkspace()).toBeNull();
  setPendingWorkspace({folder: "D:/work", access: "read"});
  setPendingWorkspace(null);
  expect(getPendingWorkspace()).toBeNull();
});
it("persists the selected capability when converting a draft to a chat", async () => {
  setPendingWorkspace({folder: "D:/work", access: "read"});
  const binding = await ensureThreadWorkspace("saved-thread");
  expect(binding?.access).toBe("read");
  expect(getPendingWorkspace()).toBeNull();
});
