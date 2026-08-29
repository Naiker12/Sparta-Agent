import { useCallback, useEffect, useState } from "react";
import { File02Icon, Folder01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/i18n";

import { getProjectNativeFilesystem } from "../hooks/use-chat-projects";
import type { ProjectRecord } from "../types";

type Node = { name: string; path: string; type: "file" | "directory" };

export function WorkspaceExplorerDialog({ project, open, onOpenChange }: {
  project: ProjectRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const root = project?.connectedFolderPath ?? null;
  const [currentPath, setCurrentPath] = useState<string | null>(root);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const loadDirectory = useCallback(async (path: string) => {
    const filesystem = getProjectNativeFilesystem();
    if (!filesystem?.readDirLevel || !project) throw new Error(t("projectsPage.folderBrowserDesktopOnly"));
    const result = await filesystem.readDirLevel(project.id, path);
    setError(result.error ?? null);
    setNodes(result.nodes ?? []);
  }, [project, t]);

  useEffect(() => setCurrentPath(root), [root, open]);
  useEffect(() => {
    if (!open || !currentPath || !root) return;
    let cancelled = false;
    void (async () => {
      const filesystem = getProjectNativeFilesystem();
      if (!filesystem?.readDirLevel || !project) throw new Error(t("projectsPage.folderBrowserDesktopOnly"));
      const configured = await filesystem.setWorkspaceRoot?.(project.id, root);
      if (configured && !configured.success) throw new Error(configured.error);
      const result = await filesystem.readDirLevel(project.id, currentPath);
      if (cancelled) return;
      setError(result.error ?? null);
      setNodes(result.nodes ?? []);
    })().catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => { cancelled = true; };
  }, [currentPath, open, project, root, t]);

  const openFile = useCallback(async (path: string) => {
    const filesystem = getProjectNativeFilesystem();
    if (!filesystem?.readFile || !project) {
      setError(t("projectsPage.folderBrowserDesktopOnly"));
      return;
    }
    const result = await filesystem.readFile(project.id, path, "utf-8");
    if (!result.success) {
      setError(result.error ?? "Could not read file");
      return;
    }
    setError(null);
    setSelectedFile(path);
    setContent(result.content ?? "");
  }, [project, t]);

  const saveFile = useCallback(async () => {
    if (!selectedFile) return;
    const filesystem = getProjectNativeFilesystem();
    if (!filesystem?.writeFile || !project) {
      setError(t("projectsPage.folderBrowserDesktopOnly"));
      return;
    }
    setSaving(true);
    try {
      const result = await filesystem.writeFile(project.id, selectedFile, content);
      if (!result.success) throw new Error(result.error ?? "Could not save file");
      setError(null);
      if (currentPath) await loadDirectory(currentPath);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  }, [content, currentPath, loadDirectory, project, selectedFile, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="corner-squircle dialog-soft-surface flex h-[min(80vh,48rem)] flex-col sm:max-w-5xl">
        <DialogHeader><DialogTitle>{t("projectsPage.folderBrowser")}</DialogTitle></DialogHeader>
        <p className="truncate text-sm text-muted-foreground" title={currentPath ?? ""}>{currentPath}</p>
        {currentPath !== root && <Button variant="ghost" className="w-fit" onClick={() => setCurrentPath(root)}>{t("projectsPage.folderBrowserRoot")}</Button>}
        {error ? <p className="text-sm text-destructive">{error}</p> : (
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(12rem,0.8fr)_minmax(0,2fr)] gap-3 overflow-hidden">
            <div className="overflow-auto rounded-lg border border-border p-1">
              {nodes.map((node) => <button key={node.path} type="button" onClick={() => node.type === "directory" ? setCurrentPath(node.path) : void openFile(node.path)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted">
                <HugeiconsIcon icon={node.type === "directory" ? Folder01Icon : File02Icon} className="size-4 text-muted-foreground" />{node.name}
              </button>)}
            </div>
            <div className="flex min-h-0 flex-col gap-2">
              {selectedFile ? <>
                <div className="flex items-center gap-2"><p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{selectedFile}</p><Button type="button" size="sm" onClick={() => void saveFile()} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></div>
                <Textarea aria-label="Workspace file editor" fieldSizing="fixed" value={content} onChange={(event) => setContent(event.target.value)} className="min-h-0 flex-1 font-mono text-xs" />
              </> : <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Select a file to edit</p>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
