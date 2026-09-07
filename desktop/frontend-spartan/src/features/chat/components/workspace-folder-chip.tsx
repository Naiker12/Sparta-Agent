import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toast";
import { Folder01Icon, FolderAddIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChevronDownIcon, GitBranchIcon } from "lucide-react";
import { useT } from "@/i18n";

import {
  connectChatProjectWorkspace,
  disconnectChatProjectWorkspace,
  getProjectNativeFilesystem,
  useChatProjects,
} from "../hooks/use-chat-projects";
import { useChatRuntimeStore } from "../stores/chat-runtime-store";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

function folderName(path: string): string {
  return (
    path
      .replace(/[\\/]+$/, "")
      .split(/[\\/]/)
      .pop() || path
  );
}

/** Shows the writable folder for the active project, never the internal sandbox. */
export function WorkspaceFolderChip() {
  const t = useT();
  const navigate = useNavigate();
  const projectId = useChatRuntimeStore((state) => state.activeProjectId);
  const { projects } = useChatProjects();
  const project = projects.find((item) => item.id === projectId) ?? null;
  const connectedFolder = project?.connectedFolderPath;
  const access = project?.workspaceAccess ?? "read";
  const [git, setGit] = useState<{ isRepository?: boolean; changed?: number; insertions?: number; deletions?: number } | null>(null);

  useEffect(() => {
    if (!project?.id || !connectedFolder) return;
    const timer = window.setTimeout(() => {
      void getProjectNativeFilesystem()?.getGitStatus?.(project.id).then(result => setGit(result ?? null));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [connectedFolder, project?.id]);

  if (!project || !connectedFolder) return null;
  const activeProjectId = project.id;

  async function changeFolder() {
    try {
      const folder = await connectChatProjectWorkspace(activeProjectId);
      if (folder)
        toast.success(t("projectsPage.folderConnected"), {
          description: folder,
        });
    } catch (error) {
      toast.error(t("projectsPage.failedToUpdateFolder"), {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  async function disconnectFolder() {
    try {
      await disconnectChatProjectWorkspace(activeProjectId);
      toast.success(t("projectsPage.folderDisconnected"));
    } catch (error) {
      toast.error(t("projectsPage.failedToUpdateFolder"), {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="composer-pill-btn"
          data-keep-label="true"
          aria-label={connectedFolder}
          title={connectedFolder}
        >
          <span className="composer-pill-glyph">
            <HugeiconsIcon
              icon={Folder01Icon}
              className="size-[15px]"
              strokeWidth={1.8}
            />
          </span>
          <span className="max-w-32 truncate">
            {folderName(connectedFolder)}
          </span>
          <span className="rounded bg-muted px-1 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
            {access === "write" ? "RW" : "RO"}
          </span>
          <ChevronDownIcon className="composer-pill-caret size-[15px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-64">
        <DropdownMenuGroup>
        <DropdownMenuItem disabled className="truncate text-muted-foreground">
          {connectedFolder}
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="text-muted-foreground">
          {access === "write"
            ? t("projectsPage.workspaceAllowEdits")
            : t("projectsPage.workspaceReadOnly")}
        </DropdownMenuItem>
        {git?.isRepository && <DropdownMenuItem onSelect={() => navigate({ to: "/chat", search: { review: project.id } })}>
          <GitBranchIcon data-icon="inline-start" />
          {t("projectsPage.gitChanges")}
          <Badge className="ml-auto" variant="secondary">+{git.insertions ?? 0} −{git.deletions ?? 0}</Badge>
        </DropdownMenuItem>}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
        <DropdownMenuItem onSelect={() => void changeFolder()}>
          <HugeiconsIcon
            icon={FolderAddIcon}
            className="size-icon"
            strokeWidth={1.75}
          />
          {t("projectsPage.changeFolder")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void disconnectFolder()}>
          <HugeiconsIcon
            icon={Folder01Icon}
            className="size-icon"
            strokeWidth={1.75}
          />
          {t("projectsPage.disconnectFolder")}
        </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
