import { useChatProjects } from "@/features/chat/hooks/use-chat-projects";
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
  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-border/30">
        <h2 className="font-serif text-2xl font-bold tracking-tight text-foreground/90 mb-1">
          GitHub
        </h2>
        <p className="text-xs text-muted-foreground">
          Repositorio sincronizado con{" "}
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
              Rama principal al día
            </span>
            <span className="text-[11px] text-muted-foreground">
              Todos los cambios locales y remotos sincronizados
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
            Últimos commits
          </h3>
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
  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-border/30">
        <h2 className="font-serif text-2xl font-bold tracking-tight text-foreground/90 mb-1">
          Subagentes
        </h2>
        <p className="text-xs text-muted-foreground">
          Gestión de agentes especializados y tareas autónomas
        </p>
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
  const isOpen = useWorkspaceStore((state) => state.isOpen);
  const activeTab = useWorkspaceStore((state) => state.activeTab);
  const setOpen = useWorkspaceStore((state) => state.setOpen);
  const { projects } = useChatProjects();
  const project =
    projects.find((candidate) => candidate.id === projectId) ?? null;

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case "files":
        return <FilesPanel flatView={false} project={project} />;
      case "changes":
        return <FilesPanel flatView={true} project={project} />;
      case "github":
        return <GitHubPanel />;
      case "agents":
        return <AgentsPanel />;
      case "browser":
        return <BrowserPreviewPanel />;
      default:
        return <FilesPanel flatView={false} project={project} />;
    }
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-background pt-[var(--studio-custom-titlebar-height,38px)]">
      {/* Dynamic Pane content (collapsible) */}
      {isOpen && (
        <div className="relative h-full w-[clamp(18rem,24vw,22rem)] min-w-0 shrink-0 border-r border-border/40 transition-all duration-300 animate-in fade-in">
          <button
            type="button"
            onClick={() => setOpen(false)}
            title="Ocultar panel"
            aria-label="Ocultar panel lateral"
            className="absolute right-3 top-[calc(var(--studio-custom-titlebar-height,38px)+0.75rem)] z-30 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 bg-background/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PanelRightCloseIcon className="h-4 w-4" />
          </button>
          {renderActiveTabContent()}
        </div>
      )}

      {/* Rail vertical with 5 tabs */}
      <WorkspaceRail />
    </div>
  );
}
