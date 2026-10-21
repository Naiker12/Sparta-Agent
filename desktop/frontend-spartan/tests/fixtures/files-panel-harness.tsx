import { createRoot } from "react-dom/client";
import { useState } from "react";
import { FilesPanel } from "../../src/components/workspace-rail/files-panel";
import { useDocumentPreviewStore } from "@/features/rag/components/preview-store";
import "../../src/index.css";

declare global {
  interface Window {
    fs?: {
      setWorkspaceRoot: (projectId: string, root: string, access?: "read" | "write") => Promise<{success: boolean}>;
      readDirLevel: (projectId: string, path: string) => Promise<{nodes: Array<{name: string; path: string; type: "file" | "directory"}>}>;
      readFile: (projectId: string, path: string) => Promise<{success: boolean; content?: string}>;
      readPreview: (projectId: string, path: string) => Promise<{success: boolean; bytes?: Uint8Array}>;
      getGitChanges: (projectId: string) => Promise<{
        success: boolean;
        changes: Array<{ path: string; status: string }>;
      }>;
      getGitDiff: (projectId: string, path: string) => Promise<{
        success: boolean;
        error?: string;
        diff?: string;
      }>;
    };
    pendingGitDiffs: Record<string, (result: { success: boolean; error?: string; diff?: string }) => void>;
    resolveGitDiff: (path: string, result: { success: boolean; error?: string; diff?: string }) => void;
    showFilesExplorer: () => void;
    getFilesPreview: () => unknown;
    getFilesPreviewBytes: () => Promise<number[]>;
    previewResourcePaths: string[];
  }
}

window.pendingGitDiffs = {};
window.previewResourcePaths = [];
window.resolveGitDiff = (path, result) => window.pendingGitDiffs[path]?.(result);
window.fs = {
  setWorkspaceRoot: async () => ({ success: true }),
  readDirLevel: async () => ({ nodes: [
    { name: "index.html", path: "C:\\fixture\\index.html", type: "file" },
    { name: "external.html", path: "C:\\fixture\\external.html", type: "file" },
    { name: "module.html", path: "C:\\fixture\\module.html", type: "file" },
    { name: "report.pdf", path: "C:\\fixture\\report.pdf", type: "file" },
  ] }),
  readFile: async (_projectId, path) => ({ success: true, content: path.endsWith("module.html") ? '<script type="module" src="app.js"></script>' : '<link rel="stylesheet" href="style.css"><h1>Workspace page</h1>' }),
  readPreview: async (_projectId, path) => {
    window.previewResourcePaths.push(path);
    const content = path.endsWith("report.pdf") ? null
      : path.endsWith("style.css") ? "h1 { color: rgb(12, 34, 56); }"
      : path.endsWith("module.html") ? '<script type="module" src="app.js"></script>'
      : path.endsWith("app.js") ? 'import "./other.js";'
      : '<!doctype html><link rel="stylesheet" href="style.css"><body><h1>Workspace page</h1></body>';
    return { success: true, bytes: content === null ? new Uint8Array([37, 80, 68, 70]) : new TextEncoder().encode(content) };
  },
  getGitChanges: async () => ({
    success: true,
    changes: [
      { path: "src/a.ts", status: "modified" },
      { path: "src/b.ts", status: "modified" },
      { path: "src/c.ts", status: "modified" },
    ],
  }),
  getGitDiff: async (_projectId, path) =>
    new Promise((resolve) => {
      window.pendingGitDiffs[path] = resolve;
    }),
};

function Fixture() {
  const [flatView, setFlatView] = useState(true);
  window.showFilesExplorer = () => setFlatView(false);
  window.getFilesPreview = () => {
    const preview = useDocumentPreviewStore.getState().localPreview;
    return preview ? { filename: preview.filename, kind: preview.kind, previewCode: preview.previewCode, workspaceSource: preview.workspaceSource } : null;
  };
  window.getFilesPreviewBytes = async () => {
    const preview = useDocumentPreviewStore.getState().localPreview;
    return preview ? Array.from(new Uint8Array(await preview.blob.arrayBuffer())) : [];
  };
  return <main className="h-screen w-full">
    <FilesPanel
      flatView={flatView}
      project={{
        id: "files-panel-fixture",
        name: "Fixture",
        connectedFolderPath: "C:\\fixture",
        workspaceAccess: "write",
        archived: false,
        createdAt: 0,
        updatedAt: 0,
      }}
    />
  </main>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
