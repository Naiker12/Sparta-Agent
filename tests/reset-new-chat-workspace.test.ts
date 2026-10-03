import { expect, it, vi } from "vitest";
import { setPendingWorkspace, getPendingWorkspace } from "../desktop/frontend-spartan/src/features/chat/utils/pending-workspace";
import { useWorkspaceStore } from "../desktop/frontend-spartan/src/features/chat/stores/use-workspace-store";
import { resetNewChatWorkspace } from "../desktop/frontend-spartan/src/features/chat/utils/reset-new-chat-workspace";

const bindings = vi.hoisted(() => ({bindThreadWorkspace: vi.fn(), getThreadWorkspace: vi.fn()}));
vi.mock("../desktop/frontend-spartan/src/features/chat/api/modules/workspaces-api", () => bindings);

it("clears inherited draft and file UI without touching saved chat bindings", () => {
  const values = new Map<string, string>();
  const storage = {getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key,value), removeItem: (key: string) => values.delete(key)};
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("sessionStorage", storage);
  vi.stubGlobal("window", {dispatchEvent: vi.fn()});
  setPendingWorkspace({folder: "D:/previous-project", access: "write"});
  useWorkspaceStore.setState({isOpen: true, selectedFilePath: "private.txt", searchQuery: "previous", capabilities: {hasGit: true, hasGithub: true, hasAgents: false, hasBrowser: false}});
  resetNewChatWorkspace();
  expect(getPendingWorkspace()).toBeNull();
  expect(useWorkspaceStore.getState()).toMatchObject({isOpen: false, selectedFilePath: null, selectedDiffFile: null, searchQuery: "", changedFiles: [], capabilities: {hasGit: false, hasGithub: false}});
  expect(bindings.bindThreadWorkspace).not.toHaveBeenCalled();
  expect(bindings.getThreadWorkspace).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
