import { createRoot } from "react-dom/client";
import { SandboxFiles } from "../../src/components/assistant-ui/sandbox-files-view";
import { DocumentPreviewSheet } from "../../src/features/rag/components/document-preview-sheet";
import { BrowserPreviewPanel } from "../../src/components/workspace-rail/browser-preview-panel";
import { useWorkspaceStore } from "../../src/features/chat/stores/use-workspace-store";
import { buildSandboxPreview } from "../../src/components/assistant-ui/sandbox-preview";
import "../../src/index.css";

Object.assign(window, { buildSandboxPreview });
function Fixture() {
  const browser = useWorkspaceStore(state => state.isOpen && state.activeTab === "browser");
  return <main className="p-6">
    <SandboxFiles sessionId="fixture" files={[{ name: "index.HTML", size: 280 }, { name: "missing.html", size: 10 }]} />
    <button onClick={() => useWorkspaceStore.getState().navigateBrowser("https://example.test/new")}>Open URL</button>
    <button onClick={() => useWorkspaceStore.getState().navigateBrowser("https://example.test/stalled")}>Open stalled URL</button>
    {browser && <BrowserPreviewPanel />}
    <DocumentPreviewSheet />
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
