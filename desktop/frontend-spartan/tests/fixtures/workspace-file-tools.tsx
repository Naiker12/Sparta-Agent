import { createRoot } from "react-dom/client";
import { WorkspaceFileToolUI } from "../../src/components/assistant-ui/tool-ui-workspace-file";
import { DiffViewer } from "../../src/components/workspace-rail/diff-viewer";
import { useDocumentPreviewStore } from "../../src/features/rag/components/preview-store";
import "../../src/index.css";

declare global {
  interface Window { readWorkspacePreview: () => Promise<unknown> }
}

window.readWorkspacePreview = async () => {
  const preview = useDocumentPreviewStore.getState().localPreview;
  return preview ? { filename: preview.filename, kind: preview.kind, previewCode: preview.previewCode, text: await preview.blob.text() } : null;
};

function Fixture() {
  return <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
    <WorkspaceFileToolUI toolName="write_file" status={{ type: "complete" }} args={{ path: "calculator.html", content: "<!doctype html><html><body><h1>Saved calculator</h1></body></html>" }} result="Wrote calculator.html." />
    <WorkspaceFileToolUI toolName="write_file" status={{ type: "complete" }} args={{ path: "styles.css", content: "body { color: red; }" }} result="Wrote styles.css." />
    <WorkspaceFileToolUI toolName="create_file" status={{ type: "complete" }} args={{ path: "empty.txt", type: "file" }} result="Created file empty.txt." />
    <WorkspaceFileToolUI toolName="read_file" status={{ type: "complete" }} args={{ path: "src/app.ts" }} result={'export const answer = 42;'} />
    <WorkspaceFileToolUI toolName="list_directory" status={{ type: "complete" }} args={{ path: "src" }} result={'dir  components\nfile  app.ts'} />
    <WorkspaceFileToolUI toolName="search_in_files" status={{ type: "complete" }} args={{ path: ".", query: "answer" }} result={'src/app.ts:1: export const answer = 42;'} />
    <WorkspaceFileToolUI toolName="write_file" status={{ type: "complete" }} args={{ path: "failed.html", content: "<h1>Should not preview</h1>" }} result="Error: workspace is read only." />
    <DiffViewer file={{ path: "assets/logo.png", filename: "logo.png", status: "added", additions: 0, deletions: 0, binary: true, diff: "" }} />
  </main>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
