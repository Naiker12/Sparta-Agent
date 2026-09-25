import {
  type WorkspaceTab,
  useWorkspaceStore,
} from "@/features/chat/stores/use-workspace-store";
import { useDocumentPreviewStore } from "@/features/rag/components/preview-store";
import { cn } from "@/lib/utils";
import { BotIcon, FolderIcon, GitBranchIcon, GlobeIcon } from "lucide-react";
import type React from "react";

// GitHub icon SVG component for crisp rendering
function GitHubLogoIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

interface RailTabItem {
  id: WorkspaceTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
}

export function WorkspaceRail() {
  const activeTab = useWorkspaceStore((state) => state.activeTab);
  const isOpen = useWorkspaceStore((state) => state.isOpen);
  const capabilities = useWorkspaceStore((state) => state.capabilities);
  const setActiveTab = useWorkspaceStore((state) => state.setActiveTab);
  const setOpen = useWorkspaceStore((state) => state.setOpen);

  const tabs: RailTabItem[] = [
    {
      id: "files",
      label: "Explorador de archivos",
      icon: FolderIcon,
      enabled: true,
    },
    {
      id: "changes",
      label: "Cambios de archivos",
      icon: GitBranchIcon,
      enabled: capabilities.hasGit,
    },
    {
      id: "github",
      label: "GitHub",
      icon: GitHubLogoIcon,
      enabled: capabilities.hasGithub,
    },
    {
      id: "agents",
      label: "Subagentes",
      icon: BotIcon,
      enabled: capabilities.hasAgents,
    },
    {
      id: "browser",
      label: "Vista previa web",
      icon: GlobeIcon,
      enabled: capabilities.hasBrowser,
    },
  ];

  const handleTabClick = (tabId: WorkspaceTab) => {
    if (activeTab === tabId && isOpen) {
      // Clicking the already active tab toggles panel collapse
      setOpen(false);
    } else {
      useDocumentPreviewStore.getState().closePreview();
      setActiveTab(tabId);
    }
  };

  return (
    <aside
      className="flex w-10 shrink-0 flex-col items-center border-l border-border/40 bg-muted/15 px-[5px] py-2 select-none"
      aria-label="Workspace navigation"
    >
      <div className="flex w-full flex-col items-center gap-1">
        {tabs.map((tab) => {
          if (!tab.enabled) {
            return null;
          }
          const isActive = isOpen && activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              title={tab.label}
              className={cn(
                "relative flex size-[30px] items-center justify-center rounded-md transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-blue-500/12 text-blue-600 dark:bg-blue-400/15 dark:text-blue-300"
                  : "text-muted-foreground/75 hover:bg-muted hover:text-foreground",
              )}
            >
              {isActive && (
                <span
                  aria-hidden={true}
                  className="absolute -left-1 h-4 w-0.5 rounded-full bg-blue-500"
                />
              )}
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>
    </aside>
  );
}
