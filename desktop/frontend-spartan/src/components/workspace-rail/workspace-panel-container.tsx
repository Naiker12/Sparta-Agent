import { useT as useUiT } from "@/i18n";
import { useChatProjects } from "@/features/chat/hooks/use-chat-projects";
import { useThreadFileScope } from "@/features/chat/hooks/use-thread-file-scope";
import { useChatRuntimeStore } from "@/features/chat/stores/chat-runtime-store";
import { useWorkspaceStore } from "@/features/chat/stores/use-workspace-store";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { PanelRightCloseIcon } from "lucide-react";
import { BrowserPreviewPanel } from "./browser-preview-panel";
import { FilesPanel } from "./files-panel";
import { WorkspaceRail } from "./workspace-rail";
import { GitReviewPanel } from "./git-review-panel";
import type { GitReviewScope } from "@/features/chat/api/modules/workspace-git-api";

function AgentsPanel() {
  const t = useUiT();
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{t("chat.repository.noAgents")}</EmptyTitle>
        <EmptyDescription>
          {t("chat.repository.noAgentsDescription")}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function WorkspacePanelContainer({
  projectId,
}: { projectId?: string | null }) {
  const uiT = useUiT();

  const isOpen = useWorkspaceStore((state) => state.isOpen);
  const panelWidth = useWorkspaceStore((state) => state.panelWidth);
  const setPanelWidth = useWorkspaceStore((state) => state.setPanelWidth);
  const activeTab = useWorkspaceStore((state) => state.activeTab);
  const setOpen = useWorkspaceStore((state) => state.setOpen);
  const activeProjectId = useChatRuntimeStore((state) => state.activeProjectId);
  const threadId = useChatRuntimeStore((state) => state.activeThreadId);
  const {
    scope,
    error: scopeError,
    loading: scopeLoading,
  } = useThreadFileScope(threadId);
  const { projects } = useChatProjects();
  // A new chat does not yet have a project id in its URL, but its composer can
  // already be connected to the active project workspace. Use that project for
  // the Files rail so attaching a folder immediately exposes its contents.
  const resolvedProjectId = projectId ?? activeProjectId;
  const project =
    scope ??
    projects.find((candidate) => candidate.id === resolvedProjectId) ??
    null;
  const reviewScope: GitReviewScope | null = project?.connectedFolderPath
    ? {
        id: project.id,
        root: project.connectedFolderPath,
        access: project.workspaceAccess ?? "read",
        binding: "threadBinding" in project,
      }
    : null;

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case "files":
        return (
          <FilesPanel
            key={project?.id ?? "unconnected"}
            flatView={false}
            project={project}
          />
        );
      case "changes":
        return (
          <FilesPanel
            key={project?.id ?? "unconnected"}
            flatView={true}
            project={project}
          />
        );
      case "github":
        return reviewScope ? (
          <GitReviewPanel preview={{ scope: reviewScope, kind: "github" }} />
        ) : null;
      case "agents":
        return <AgentsPanel />;
      case "browser":
        return <BrowserPreviewPanel />;
      default:
        return (
          <FilesPanel
            key={project?.id ?? "unconnected"}
            flatView={false}
            project={project}
          />
        );
    }
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-background">
      {isOpen && (
        <div
          style={{ width: `min(${panelWidth}px, 60vw)` }}
          className="relative flex h-full min-w-0 shrink-0 flex-col border-l border-border/40 animate-in fade-in"
        >
          <div
            role="separator"
            aria-label={uiT("ui.resize_file_panel")}
            aria-orientation="vertical"
            tabIndex={0}
            aria-valuemin={280}
            aria-valuemax={900}
            aria-valuenow={panelWidth}
            className="absolute -left-1 top-0 z-30 h-full w-2 cursor-col-resize touch-none hover:bg-primary/20 focus-visible:bg-primary/20"
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setPanelWidth(panelWidth + 24);
              if (e.key === "ArrowRight") setPanelWidth(panelWidth - 24);
            }}
            onPointerDown={(e) =>
              e.currentTarget.setPointerCapture(e.pointerId)
            }
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId))
                setPanelWidth(window.innerWidth - e.clientX - 48);
            }}
            onPointerUp={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId))
                e.currentTarget.releasePointerCapture(e.pointerId);
            }}
          />
          <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border/40 px-3">
            <span className="truncate text-xs font-medium text-foreground">
              {activeTab === "files"
                ? uiT("chat.composer.mentions.files")
                : activeTab === "changes"
                  ? uiT("projectsPage.gitChanges")
                  : activeTab === "github"
                    ? "GitHub"
                    : activeTab === "agents"
                      ? uiT("ui.subagents")
                      : uiT("chat.files.preview")}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              title={uiT("ui.hide_panel")}
              aria-label={uiT("ui.hide_side_panel")}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <PanelRightCloseIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {scopeLoading ? (
              <p role="status" className="p-4 text-sm text-muted-foreground">
                {uiT("chat.workspace.loading")}
              </p>
            ) : scopeError ? (
              <p role="alert" className="p-4 text-sm text-destructive">
                {scopeError}
              </p>
            ) : (
              renderActiveTabContent()
            )}
          </div>
        </div>
      )}

      <WorkspaceRail reviewScope={reviewScope} />
    </div>
  );
}
