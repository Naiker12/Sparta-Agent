import { useWorkspaceStore } from "../stores/use-workspace-store";

/**
 * Imperative trigger to focus the browser preview from any tool execution or link.
 */
export function triggerWorkspaceWebPreview(url: string, title?: string): void {
  useWorkspaceStore.getState().navigateBrowser(url, title);
}
