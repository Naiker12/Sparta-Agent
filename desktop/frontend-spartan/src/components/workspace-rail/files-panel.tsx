import { translate as uiTranslate } from "@/i18n";
import { useT as useUiT } from "@/i18n";
import { getProjectNativeFilesystem } from "@/features/chat/hooks/use-chat-projects";
import {
  type GitFileStatus,
  type WorkspaceChangedFile,
  useWorkspaceStore,
} from "@/features/chat/stores/use-workspace-store";
import type { ProjectRecord } from "@/features/chat/types";
import type { FileScope } from "@/features/chat/hooks/use-thread-file-scope";
import { cn } from "@/lib/utils";
import {
  ChevronLeftIcon,
  FileCode2Icon,
  FolderIcon,
  GitBranchIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DiffViewer } from "./diff-viewer";
import { FileContentView } from "./file-content-view";
import { ImageFileView } from "./image-file-view";

type Node = { name: string; path: string; type: "file" | "directory" };
const basename = (path: string) =>
  path.split(/[\\/]/).filter(Boolean).pop() ?? path;
const toStatus = (status: string): GitFileStatus =>
  status.includes("untracked") ||
  status.includes("added") ||
  status.includes("A")
    ? "added"
    : status.includes("deleted") || status.includes("D")
      ? "deleted"
      : "modified";

export function FilesPanel({
  flatView = false,
  project,
}: { flatView?: boolean; project: ProjectRecord | FileScope | null }) {
  const uiT = useUiT();

  const searchQuery = useWorkspaceStore((state) => state.searchQuery);
  const setSearchQuery = useWorkspaceStore((state) => state.setSearchQuery);
  const changedFiles = useWorkspaceStore((state) => state.changedFiles);
  const setChangedFiles = useWorkspaceStore((state) => state.setChangedFiles);
  const selectedDiffFile = useWorkspaceStore((state) => state.selectedDiffFile);
  const setSelectedDiffFile = useWorkspaceStore(
    (state) => state.setSelectedDiffFile,
  );
  const setSelectedFilePath = useWorkspaceStore(
    (state) => state.setSelectedFilePath,
  );
  const [path, setPath] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{path: string; content: string} | null>(null);
  const [image, setImage] = useState<{path: string; bytes: Uint8Array; mime: string} | null>(null);
  const generation = useRef(0);
  const readRequest = useRef(0);
  useEffect(() => {
    generation.current++;
    readRequest.current++;
    setNodes([]); setPath(null); setError(null);
    setPreview(null); setSelectedFilePath(null);
    setImage(null);
    setChangedFiles([]); setSelectedDiffFile(null);
    return () => { generation.current++; };
  }, [project?.id, project?.connectedFolderPath]);

  const loadDirectory = useCallback(
    async (nextPath: string) => {
      if (!project) {
        return;
      }
      const filesystem = getProjectNativeFilesystem();
      if (!filesystem?.readDirLevel) {
        setError(
          uiTranslate("ui.the_file_explorer_is_only_available_in_the_desktop_application"),
        );
        return;
      }
      setLoading(true);
      const current = generation.current;
      const request = ++readRequest.current;
      try {
        const result = await filesystem.readDirLevel(project.id, nextPath);
        if (current !== generation.current || request !== readRequest.current) return;
        setNodes(result.nodes ?? []);
        setPath(nextPath);
        setError(result.error ?? null);
      } catch (reason) {
        if (current === generation.current && request === readRequest.current) setError(reason instanceof Error ? reason.message : "No se pudo listar la carpeta.");
      } finally {
        if (current === generation.current && request === readRequest.current) setLoading(false);
      }
    },
    [project],
  );

  useEffect(() => {
    if (!project?.connectedFolderPath || flatView) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const filesystem = getProjectNativeFilesystem();
      const configured = "threadBinding" in project
        ? await filesystem?.setWorkspaceBinding?.(project.id, project.connectedFolderPath!, project.workspaceAccess)
        : await filesystem?.setWorkspaceRoot?.(project.id, project.connectedFolderPath!, project.workspaceAccess ?? "read");
      if (!configured?.success) throw new Error(configured?.error ?? "El puente de archivos no está disponible.");
      if (!cancelled) await loadDirectory(project.connectedFolderPath!);
    })().catch((reason) =>
      !cancelled && setError(reason instanceof Error ? reason.message : String(reason)),
    );
    return () => { cancelled = true; };
  }, [flatView, loadDirectory, project]);

  const refreshChanges = useCallback(async () => {
    if (!project) {
      return;
    }
    const result = await getProjectNativeFilesystem()?.getGitChanges?.(
      project.id,
    );
    if (!result?.success) {
      setError(result?.error ?? "No se pudo leer el estado de Git.");
      return;
    }
    const files = result.changes.map((change) => ({
      path: change.path,
      filename: basename(change.path),
      status: toStatus(change.status),
      additions: 0,
      deletions: 0,
    }));
    setChangedFiles(files);
    setSelectedDiffFile(files[0] ?? null);
    setError(null);
  }, [project, setChangedFiles, setSelectedDiffFile]);
  useEffect(() => {
    if (flatView) {
      void refreshChanges();
    }
  }, [flatView, refreshChanges]);

  const selectDiff = useCallback(
    async (file: WorkspaceChangedFile) => {
      if (!project) {
        return;
      }
      const result = await getProjectNativeFilesystem()?.getGitDiff?.(
        project.id,
        file.path,
      );
      const diff = result?.success ? (result.diff ?? "") : "";
      const additions = diff
        .split("\n")
        .filter(
          (line) => line.startsWith("+") && !line.startsWith("+++"),
        ).length;
      const deletions = diff
        .split("\n")
        .filter(
          (line) => line.startsWith("-") && !line.startsWith("---"),
        ).length;
      setSelectedDiffFile({ ...file, diff, additions, deletions });
    },
    [project, setSelectedDiffFile],
  );

  const visibleNodes = useMemo(
    () =>
      nodes.filter((node) =>
        node.name.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [nodes, searchQuery],
  );
  async function openFile(filePath: string) {
    if (!project) return;
    const current = generation.current;
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    const mime = ({png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",webp:"image/webp",bmp:"image/bmp",avif:"image/avif"} as Record<string,string>)[ext];
    if (mime) {
      try {
        const result = await getProjectNativeFilesystem()?.readPreview?.(project.id, filePath);
        if (current !== generation.current) return;
        if (!result?.success || !result.bytes) throw new Error(result?.error ?? "No se pudo cargar la imagen.");
        setImage({path: filePath, bytes: new Uint8Array(result.bytes), mime});
      } catch (reason) { if (current === generation.current) setError(reason instanceof Error ? reason.message : "Error de imagen"); }
      return;
    }
    if (/\.(zip|exe|dll|7z|rar|woff2?|ttf|mp4|mp3|bin)$/i.test(filePath)) { setError(uiTranslate("ui.this_binary_file_has_no_text_view")); return; }
    let result;
    try { result = await getProjectNativeFilesystem()?.readFile?.(project.id, filePath); }
    catch (reason) { if (current === generation.current) setError(reason instanceof Error ? reason.message : "No se pudo abrir el archivo."); return; }
    if (current !== generation.current) return;
    if (!result?.success) { setError(result?.error ?? "No se pudo abrir el archivo."); return; }
    setSelectedFilePath(filePath);
    setPreview({path: filePath, content: (result.content ?? "").slice(0, 100000)});
  }
  if (!project?.connectedFolderPath) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        {uiT("ui.connect_a_project_folder_to_view_its_actual_files")}</div>
    );
  }

  if (image) return <ImageFileView key={image.path} {...image} onClose={() => setImage(null)} />;
  if (preview) return <FileContentView key={preview.path} path={preview.path} content={preview.content} onClose={() => setPreview(null)} />;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="border-b border-border/30 px-5 pb-3 pt-5">
        <div className="mb-3 flex items-center gap-2">
          <GitBranchIcon
            className={cn("size-5 text-blue-600", !flatView && "hidden")}
          />
          <h2 className="font-serif text-2xl font-bold tracking-tight text-foreground/90">
            {flatView ? uiT("ui.file_changes") : uiT("ui.file_explorer")}
          </h2>
          <button
            type="button"
            onClick={() =>
              flatView
                ? void refreshChanges()
                : path && void loadDirectory(path)
            }
            className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            aria-label={uiT("update.update")}
          >
            <RefreshCwIcon
              className={cn("size-4", loading && "animate-spin")}
            />
          </button>
        </div>
        {flatView ? (
          <p className="text-xs text-muted-foreground">
            {changedFiles.length} {" "}{uiT("ui.changed_files")}</p>
        ) : (
          <div className="relative">
            <SearchIcon className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={uiT("ui.search_this_folder")}
              className="w-full rounded-xl border border-border/40 bg-muted/40 py-2 pl-9 pr-3 text-xs"
            />
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="border-b p-3 text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex-1 overflow-y-auto p-3">
        {loading && <p role="status" className="p-3 text-xs text-muted-foreground">{uiT("ui.reading_files")}</p>}
        {!loading && !error && !flatView && nodes.length === 0 && <p className="p-3 text-xs text-muted-foreground">{uiT("ui.the_folder_has_no_visible_files")}</p>}
        {flatView ? (
          <div className="space-y-3">
            {changedFiles.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">
                {uiT("ui.no_git_changes_in_this_project")}</p>
            ) : (
              changedFiles.map((file) => (
                <button
                  type="button"
                  key={file.path}
                  onClick={() => void selectDiff(file)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg p-2 text-left text-xs hover:bg-muted",
                    selectedDiffFile?.path === file.path && "bg-muted",
                  )}
                >
                  <span className="font-mono font-bold text-blue-600">
                    {file.status === "added"
                      ? "A"
                      : file.status === "deleted"
                        ? "D"
                        : "M"}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono">
                    {file.path}
                  </span>
                </button>
              ))
            )}
            {selectedDiffFile && <DiffViewer file={selectedDiffFile} />}
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
              <button
                type="button"
                disabled={path === project.connectedFolderPath}
                onClick={() =>
                  path &&
                  void loadDirectory(
                    path.split(/[\\/]/).slice(0, -1).join("\\"),
                  )
                }
                className="rounded p-1 hover:bg-muted disabled:opacity-30"
              >
                <ChevronLeftIcon className="size-4" />
              </button>
              <span className="truncate">{path}</span>
            </div>
            {visibleNodes.map((node) => (
              <button
                type="button"
                key={node.path}
                onClick={() =>
                  node.type === "directory"
                    ? void loadDirectory(node.path)
                    : void openFile(node.path)
                }
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-muted"
              >
                {node.type === "directory" ? (
                  <FolderIcon className="size-4 text-blue-500" />
                ) : (
                  <FileCode2Icon className="size-4 text-muted-foreground" />
                )}
                <span className="truncate">{node.name}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
