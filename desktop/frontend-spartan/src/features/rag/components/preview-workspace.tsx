/* eslint-disable no-restricted-imports -- Direct imports avoid loading the full chat barrel in the lazy preview chunk. */
import { useCallback, useEffect, useState } from "react";
import { FolderOpenIcon, GitBranchIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspaceFolderChip } from "@/features/chat/components/workspace-folder-chip";
import { WorkspaceExplorerDialog } from "@/features/chat/components/workspace-explorer-dialog";
import { getProjectNativeFilesystem, useChatProjects } from "@/features/chat/hooks/use-chat-projects";
import { useChatRuntimeStore } from "@/features/chat/stores/chat-runtime-store";
import { useT } from "@/i18n";
import { useDocumentPreviewStore } from "./preview-store";

type GitStatus = {
  success: boolean;
  isRepository?: boolean;
  branch?: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
  changed?: number;
  insertions?: number;
  deletions?: number;
};

export function PreviewWorkspace() {
  const t = useT();
  const [open,setOpen] = useState(false);
  const id = useChatRuntimeStore(state=>state.activeProjectId);
  const source = useDocumentPreviewStore(state=>state.localPreview?.workspaceSource);
  const {projects} = useChatProjects();
  const project = projects.find(item=>item.id===id) ?? null;
  const [git, setGit] = useState<GitStatus | null>(null);
  const refreshGit = useCallback(async () => {
    if (!project) return;
    const result = await getProjectNativeFilesystem()?.getGitStatus?.(project.id);
    setGit(result ?? null);
  }, [project]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void refreshGit(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshGit]);
  if (!project?.connectedFolderPath) return null;
  const root = project.connectedFolderPath.replace(/\\/g, "/").replace(/\/$/, "");
  const path = source?.path.replace(/\\/g, "/");
  const relative = source?.projectId === project.id && path?.toLowerCase().startsWith(`${root.toLowerCase()}/`)
    ? path.slice(root.length + 1) : null;
  return <div className="flex min-w-0 flex-col border-b">
    <div className="flex min-w-0 items-center gap-1 px-3 py-1">
    <WorkspaceFolderChip />
    {relative && <nav aria-label={t("projectsPage.browseFolder")} title={relative} className="flex min-w-0 flex-1 items-center overflow-hidden text-xs text-muted-foreground">
      {relative.split("/").map((part, index, parts) => <span key={index} className="flex min-w-0 items-center"><span aria-hidden="true" className="px-2">›</span><span className="truncate" aria-current={index === parts.length - 1 ? "page" : undefined}>{part}</span></span>)}
    </nav>}
    <Button className="ml-auto shrink-0" variant="ghost" size="icon-sm" aria-label={t("projectsPage.browseFolder")} onClick={()=>setOpen(true)}><FolderOpenIcon data-icon="inline-start" /></Button>
    </div>
    {git?.isRepository && <div className="flex min-w-0 items-center gap-2 border-t px-3 py-1 text-xs text-muted-foreground">
      <GitBranchIcon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate font-medium text-foreground">{git.branch || "HEAD"}</span>
      {git.upstream && <span className="truncate">→ {git.upstream}</span>}
      {git.changed ? <span className="shrink-0">{t("projectsPage.gitChanges")} +{git.insertions ?? 0} −{git.deletions ?? 0}</span> : <span className="shrink-0">{t("projectsPage.gitNoChanges")}</span>}
      {!!(git.ahead || git.behind) && <span className="truncate">{t("projectsPage.gitAheadBehind", { ahead: git.ahead ?? 0, behind: git.behind ?? 0 })}</span>}
      <Button className="ml-auto shrink-0" variant="ghost" size="icon-sm" aria-label={t("projectsPage.gitRefresh")} onClick={() => void refreshGit()}><RefreshCwIcon className="size-3.5" /></Button>
    </div>}
    {git && !git.isRepository && <p className="border-t px-3 py-1 text-xs text-muted-foreground">{t("projectsPage.gitNoRepository")}</p>}
    <WorkspaceExplorerDialog project={project} open={open} onOpenChange={setOpen} />
  </div>;
}
