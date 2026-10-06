import { useT as useUiT } from "@/i18n";
import { useChatProjects } from "@/features/chat/hooks/use-chat-projects";
import { useThreadFileScope } from "@/features/chat/hooks/use-thread-file-scope";
import { useChatRuntimeStore } from "@/features/chat/stores/chat-runtime-store";
import { useWorkspaceStore } from "@/features/chat/stores/use-workspace-store";
import { cn } from "@/lib/utils";
import {
  BotIcon,
  CheckCircle2Icon,
  GitCommitIcon,
  PanelRightCloseIcon,
} from "lucide-react";
import { BrowserPreviewPanel } from "./browser-preview-panel";
import { FilesPanel } from "./files-panel";
import { WorkspaceRail } from "./workspace-rail";

function GitHubPanel() {
  const uiT = useUiT();

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-border/30">
        <h2 className="font-serif text-2xl font-bold tracking-tight text-foreground/90 mb-1">
          GitHub
        </h2>
        <p className="text-xs text-muted-foreground">
          {uiT("ui.repository_synced_with")}{" "}
          <span className="font-mono font-medium text-foreground">
            origin/main
          </span>
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/40 text-xs">
          <CheckCircle2Icon className="w-4 h-4 text-emerald-500 shrink-0" />
          <div className="flex flex-col">
            <span className="font-medium text-foreground">
              {uiT("ui.main_branch_up_to_date")}</span>
            <span className="text-[11px] text-muted-foreground">
              {uiT("ui.all_local_and_remote_changes_synced")}</span>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
            {uiT("ui.latest_commits")}</h3>
          <div className="flex flex-col gap-2">
            {[
              {
                id: "faee9be",
                msg: "feat: improve memory and task persistence, asset routing and packaging checks",
                author: "Sparta Agent",
                time: "Reciente",
              },
              {
                id: "d50d27e",
                msg: "Fix typo in license section of README.md",
                author: "Naiker12",
                time: "Hoy",
              },
              {
                id: "3f0157c",
                msg: "feat(i18n): add new translation keys for model loading and download states",
                author: "Naiker12",
                time: "Hoy",
              },
            ].map((commit) => (
              <div
                key={commit.id}
                className="flex items-start gap-2.5 p-2.5 rounded-xl border border-border/30 hover:bg-muted/30 transition-colors text-xs"
              >
                <GitCommitIcon className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-medium text-foreground/90 truncate">
                    {commit.msg}
                  </span>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono mt-0.5">
                    <span className="text-blue-600 dark:text-blue-400">
                      {commit.id}
                    </span>
                    <span>•</span>
                    <span>{commit.author}</span>
                    <span>•</span>
                    <span>{commit.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentsPanel() {
  const uiT = useUiT();

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-border/30">
        <h2 className="font-serif text-2xl font-bold tracking-tight text-foreground/90 mb-1">
          {uiT("ui.subagents")}</h2>
        <p className="text-xs text-muted-foreground">
          {uiT("ui.manage_specialized_agents_and_autonomous_tasks")}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div className="flex flex-col gap-3">
          {[
            {
              name: "Research Agent",
              role: "Búsqueda profunda y síntesis técnica",
              status: "Disponible",
              active: true,
            },
            {
              name: "Code Reviewer",
              role: "Análisis de lint, tipos y cobertura",
              status: "Inactivo",
              active: false,
            },
            {
              name: "Database Orchestrator",
              role: "Migraciones SQLite y esquema studio",
              status: "Inactivo",
              active: false,
            },
          ].map((agent, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3.5 rounded-xl border border-border/40 hover:bg-muted/40 transition-colors text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <BotIcon className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground">
                    {agent.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {agent.role}
                  </span>
                </div>
              </div>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-medium",
                  agent.active
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {agent.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
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
  const { scope, error: scopeError, loading: scopeLoading } = useThreadFileScope(threadId);
  const { projects } = useChatProjects();
  // A new chat does not yet have a project id in its URL, but its composer can
  // already be connected to the active project workspace. Use that project for
  // the Files rail so attaching a folder immediately exposes its contents.
  const resolvedProjectId = projectId ?? activeProjectId;
  const project = scope ?? (projects.find((candidate) => candidate.id === resolvedProjectId) ?? null);

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case "files":
        return <FilesPanel key={project?.id ?? "unconnected"} flatView={false} project={project} />;
      case "changes":
        return <FilesPanel key={project?.id ?? "unconnected"} flatView={true} project={project} />;
      case "github":
        return <GitHubPanel />;
      case "agents":
        return <AgentsPanel />;
      case "browser":
        return <BrowserPreviewPanel />;
      default:
        return <FilesPanel key={project?.id ?? "unconnected"} flatView={false} project={project} />;
    }
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-background">
      {/* Dynamic Pane content (collapsible) */}
      {isOpen && (
        <div style={{width: `min(${panelWidth}px, 60vw)`}} className="relative flex h-full min-w-0 shrink-0 flex-col border-l border-border/40 animate-in fade-in">
          <div role="separator" aria-label={uiT("ui.resize_file_panel")} aria-orientation="vertical" tabIndex={0} aria-valuemin={280} aria-valuemax={900} aria-valuenow={panelWidth}
            className="absolute -left-1 top-0 z-30 h-full w-2 cursor-col-resize touch-none hover:bg-primary/20 focus-visible:bg-primary/20"
            onKeyDown={e => {if(e.key === "ArrowLeft") setPanelWidth(panelWidth+24); if(e.key === "ArrowRight") setPanelWidth(panelWidth-24);}}
            onPointerDown={e => e.currentTarget.setPointerCapture(e.pointerId)}
            onPointerMove={e => {if(e.currentTarget.hasPointerCapture(e.pointerId)) setPanelWidth(window.innerWidth-e.clientX-48);}}
            onPointerUp={e => {if(e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);}} />
          <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border/40 px-3">
            <span className="truncate text-xs font-medium text-foreground">
              {activeTab === "files" ? uiT("chat.composer.mentions.files") : activeTab === "changes" ? uiT("projectsPage.gitChanges") : activeTab === "github" ? "GitHub" : activeTab === "agents" ? uiT("ui.subagents") : uiT("chat.files.preview")}
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
          <div className="min-h-0 flex-1 overflow-hidden">{scopeLoading ? <p role="status" className="p-4 text-sm text-muted-foreground">{uiT("chat.workspace.loading")}</p> : scopeError ? <p role="alert" className="p-4 text-sm text-destructive">{scopeError}</p> : renderActiveTabContent()}</div>
        </div>
      )}

      {/* Rail vertical with 5 tabs */}
      <WorkspaceRail />
    </div>
  );
}
