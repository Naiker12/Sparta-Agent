import { useEffect } from "react";
import { useChatArtifactsStore } from "../artifacts/store";
import { useWorkspaceStore } from "../stores/use-workspace-store";

/**
 * Global relay listener for web preview events.
 * Lives mounted at the root application shell so that openings
 * are never missed even when the right panel is closed or another tab is active.
 */
export function useWorkspaceRelay(): void {
  const selectedArtifactId = useChatArtifactsStore(
    (state) => state.selectedArtifactId,
  );
  const artifactsById = useChatArtifactsStore((state) => state.artifactsById);

  useEffect(() => {
    if (!selectedArtifactId) {
      return;
    }
    const artifact = artifactsById[selectedArtifactId];
    if (!artifact) {
      return;
    }

    // Check if the artifact is an HTML / web page
    const isHtml =
      artifact.title.endsWith(".html") ||
      artifact.title.toLowerCase().includes("web") ||
      artifact.title.toLowerCase().includes("page") ||
      artifact.code.includes("<html") ||
      artifact.code.includes("<!DOCTYPE html");

    if (isHtml) {
      const workspace = useWorkspaceStore.getState();
      // If not already in browser tab, switch and open panel
      workspace.openTab("browser");
      workspace.setBrowserUrl(
        artifact.title.includes("localhost")
          ? artifact.title
          : "http://localhost:4200",
      );
    }
  }, [selectedArtifactId, artifactsById]);
}

/**
 * Imperative trigger to focus the browser preview from any tool execution or link.
 */
export function triggerWorkspaceWebPreview(url: string, title?: string): void {
  useWorkspaceStore.getState().navigateBrowser(url, title);
}
