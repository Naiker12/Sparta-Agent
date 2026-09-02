import { FolderAddIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { toast } from "@/lib/toast";
import { useT } from "@/i18n";

import {
  connectChatProjectWorkspace,
  useChatProjects,
} from "../hooks/use-chat-projects";
import { useChatRuntimeStore } from "../stores/chat-runtime-store";

/**
 * Entry point for a code workspace from the composer.  It deliberately does
 * not render in project creation or Sources: a workspace grants file access;
 * sources merely add indexed knowledge.
 */
export function ConnectWorkspaceFolderChip() {
  const t = useT();
  const projectId = useChatRuntimeStore((state) => state.activeProjectId);
  const { projects } = useChatProjects();
  const project = projects.find((item) => item.id === projectId) ?? null;

  if (!project || project.connectedFolderPath) return null;
  const activeProjectId = project.id;

  async function connectFolder() {
    try {
      const folder = await connectChatProjectWorkspace(activeProjectId);
      if (folder) {
        toast.success(t("projectsPage.folderConnected"), {
          description: folder,
        });
      }
    } catch (error) {
      toast.error(t("projectsPage.failedToUpdateFolder"), {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  return (
    <button
      type="button"
      onClick={() => void connectFolder()}
      className="composer-pill-btn"
      data-keep-label="true"
      aria-label={t("projectsPage.connectFolder")}
    >
      <span className="composer-pill-glyph">
        <HugeiconsIcon icon={FolderAddIcon} className="size-[15px]" strokeWidth={1.8} />
      </span>
      <span>{t("projectsPage.connectFolder")}</span>
    </button>
  );
}
