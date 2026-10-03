import { setPendingWorkspace } from "./pending-workspace";
import { useWorkspaceStore } from "../stores/use-workspace-store";

/** Reset only draft/UI state. Never revoke another chat's durable folder binding. */
export function resetNewChatWorkspace(): void {
  setPendingWorkspace(null);
  const workspace = useWorkspaceStore.getState();
  workspace.setSelectedFilePath(null);
  workspace.setSelectedDiffFile(null);
  workspace.setChangedFiles([]);
  workspace.setSearchQuery("");
  workspace.setCapabilities({hasGit: false, hasGithub: false, hasAgents: false, hasBrowser: false});
  workspace.setOpen(false);
}
