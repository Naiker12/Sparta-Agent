import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/lib/toast";
import { Folder01Icon, FolderAddIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChevronDownIcon } from "lucide-react";
import { useT } from "@/i18n";

import {
  connectChatProjectWorkspace,
  disconnectChatProjectWorkspace,
  useChatProjects,
} from "../hooks/use-chat-projects";
import { useChatRuntimeStore } from "../stores/chat-runtime-store";

function folderName(path: string): string {
  return path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path;
}

/** Shows the writable folder for the active project, never the internal sandbox. */
export function WorkspaceFolderChip() {
  const t = useT();
  const projectId = useChatRuntimeStore((state) => state.activeProjectId);
  const { projects } = useChatProjects();
  const project = projects.find((item) => item.id === projectId) ?? null;
  const connectedFolder = project?.connectedFolderPath;

  if (!project || !connectedFolder) return null;
  const activeProjectId = project.id;

  async function changeFolder() {
    try {
      const folder = await connectChatProjectWorkspace(activeProjectId);
      if (folder) toast.success(t("projectsPage.folderConnected"), { description: folder });
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
            <HugeiconsIcon icon={Folder01Icon} className="size-[15px]" strokeWidth={1.8} />
          </span>
          <span className="max-w-32 truncate">{folderName(connectedFolder)}</span>
          <ChevronDownIcon className="composer-pill-caret size-[15px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-64">
        <DropdownMenuItem disabled className="truncate text-muted-foreground">
          {connectedFolder}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void changeFolder()}>
          <HugeiconsIcon icon={FolderAddIcon} className="size-icon" strokeWidth={1.75} />
          {t("projectsPage.changeFolder")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void disconnectFolder()}>
          <HugeiconsIcon icon={Folder01Icon} className="size-icon" strokeWidth={1.75} />
          {t("projectsPage.disconnectFolder")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
