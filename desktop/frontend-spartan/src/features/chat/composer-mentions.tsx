import { listMcpServers } from "@/features/chat/api/mcp-servers-api";
import { listInstalledSkills } from "@/features/chat/api/skills-api";
import { useChatProjects } from "@/features/chat/hooks/use-chat-projects";
import { useChatRuntimeStore } from "@/features/chat/stores/chat-runtime-store";
import {
  listProjectDocuments,
  listThreadDocuments,
} from "@/features/rag/api/rag-api";
import {
  ComposerPrimitive,
  unstable_useMentionAdapter,
} from "@assistant-ui/react";
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Folder,
  Server,
  Sparkles,
} from "lucide-react";
import { Component, useEffect, useMemo, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { useT } from "@/i18n";

type Mention = {
  id: string;
  type: string;
  label: string;
  description?: string;
  icon: string;
};

function getCategoryIcon(id: string) {
  switch (id) {
    case "mcp":
      return <Server className="size-4 text-emerald-500 shrink-0" />;
    case "project":
      return <Folder className="size-4 text-amber-500 shrink-0" />;
    case "files":
      return <FileText className="size-4 text-blue-500 shrink-0" />;
    case "skills":
      return <Sparkles className="size-4 text-purple-500 shrink-0" />;
    default:
      return <Sparkles className="size-4 text-muted-foreground shrink-0" />;
  }
}

function getItemIcon(type: string) {
  switch (type) {
    case "mcp":
      return <Server className="size-3.5 text-emerald-500 shrink-0" />;
    case "project":
      return <Folder className="size-3.5 text-amber-500 shrink-0" />;
    case "file":
      return <FileText className="size-3.5 text-blue-500 shrink-0" />;
    case "skill":
      return <Sparkles className="size-3.5 text-purple-500 shrink-0" />;
    default:
      return <FileText className="size-3.5 text-muted-foreground shrink-0" />;
  }
}

/** Native assistant-ui @ mention surface. Selecting only serializes context; it never runs a tool. */
class ComposerMentionsBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn("Mention picker was disabled after a render error", error, info);
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

function ComposerMentionsContent({ threadId }: { threadId: string | null }) {
  const t = useT();
  const activeProjectId = useChatRuntimeStore((s) => s.activeProjectId);
  const { projects } = useChatProjects();
  const [mcps, setMcps] = useState<Mention[]>([]);
  const [files, setFiles] = useState<Mention[]>([]);
  const [skills, setSkills] = useState<Mention[]>([]);

  useEffect(() => {
    void listMcpServers()
      .then((rows) =>
        setMcps(
          rows
            .filter((row) => row.is_enabled)
            .map((row) => ({
              id: row.id,
              type: "mcp",
              label: row.display_name,
              description:
                row.tool_count == null
                  ? t("chat.composer.mentions.unverifiedMcp")
                  : t("chat.composer.mentions.mcpToolsCount", {
                      count: row.tool_count,
                    }),
              icon: "mcp",
            })),
        ),
      )
      .catch(() => setMcps([]));
    void listInstalledSkills()
      .then((rows) =>
        setSkills(
          rows.map((skill) => ({
            id: skill.id,
            type: "skill",
            label: skill.name,
            description: skill.description,
            icon: "skill",
          })),
        ),
      )
      .catch(() => setSkills([]));
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    const requests = [
      threadId ? listThreadDocuments(threadId) : Promise.resolve([]),
    ];
    if (activeProjectId) requests.push(listProjectDocuments(activeProjectId));
    void Promise.all(requests)
      .then((groups) => {
        if (cancelled) return;
        const byId = new Map(groups.flat().map((file) => [file.id, file]));
        setFiles(
          [...byId.values()].map((file) => ({
            id: file.id,
            type: "file",
            label: file.filename,
            description:
              file.status === "completed"
                ? t("chat.composer.mentions.indexedFile")
                : t("chat.composer.mentions.fileStatus", {
                    status: file.status,
                  }),
            icon: "file",
          })),
        );
      })
      .catch(() => !cancelled && setFiles([]));
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, t, threadId]);

  const project = projects.find((item) => item.id === activeProjectId);
  const categories = useMemo(
    () =>
      [
        {
          id: "mcp",
          label: t("chat.composer.mentions.mcpConnected"),
          items: mcps,
        },
        {
          id: "project",
          label: t("chat.composer.mentions.projectContext"),
          items: project
            ? [
                {
                  id: project.id,
                  type: "project",
                  label: project.name,
                  description: t("chat.composer.mentions.projectContextDesc"),
                  icon: "project",
                },
              ]
            : [],
        },
        {
          id: "files",
          label: t("chat.composer.mentions.files"),
          items: files,
        },
        {
          id: "skills",
          label: t("chat.composer.mentions.skills"),
          items: skills,
        },
      ].filter((category) => category.items.length > 0),
    [files, mcps, project, skills, t],
  );
  const mention = unstable_useMentionAdapter({
    categories,
    includeModelContextTools: false,
  });

  return (
    <ComposerPrimitive.Unstable_TriggerPopover
      char="@"
      adapter={mention.adapter}
      className="absolute bottom-full left-0 z-30 mb-2 w-84 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border/80 bg-popover/95 backdrop-blur-md p-1.5 shadow-xl transition-all"
      aria-label={t("chat.composer.mentions.ariaLabel")}
      data-slot="composer-trigger-popover"
    >
      <ComposerPrimitive.Unstable_TriggerPopover.Directive
        {...mention.directive}
      />
      <ComposerPrimitive.Unstable_TriggerPopoverCategories className="flex flex-col gap-0.5">
        {(categories) =>
          categories.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {t("chat.composer.mentions.noCategories")}
            </div>
          ) : (
            categories.map((category) => (
              <ComposerPrimitive.Unstable_TriggerPopoverCategoryItem
                key={category.id}
                categoryId={category.id}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm outline-none hover:bg-accent data-[highlighted]:bg-accent cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {getCategoryIcon(category.id)}
                  <span className="truncate font-medium">{category.label}</span>
                </div>
                <ChevronRight className="size-4 text-muted-foreground shrink-0" />
              </ComposerPrimitive.Unstable_TriggerPopoverCategoryItem>
            ))
          )
        }
      </ComposerPrimitive.Unstable_TriggerPopoverCategories>
      <ComposerPrimitive.Unstable_TriggerPopoverBack className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors rounded-md mb-0.5">
        <ArrowLeft className="size-3.5" />
        <span>{t("chat.composer.mentions.back")}</span>
      </ComposerPrimitive.Unstable_TriggerPopoverBack>
      <ComposerPrimitive.Unstable_TriggerPopoverItems className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
        {(items) =>
          items.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {t("chat.composer.mentions.noResults")}
            </div>
          ) : (
            items.map((item, index) => (
              <ComposerPrimitive.Unstable_TriggerPopoverItem
                key={`${item.type}-${item.id}`}
                item={item}
                index={index}
                className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none hover:bg-accent data-[highlighted]:bg-accent cursor-pointer transition-colors"
              >
                <div className="mt-0.5 shrink-0">{getItemIcon(item.type)}</div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-medium truncate">
                    {item.label}
                  </span>
                  {item.description ? (
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {item.description}
                    </span>
                  ) : null}
                </div>
              </ComposerPrimitive.Unstable_TriggerPopoverItem>
            ))
          )
        }
      </ComposerPrimitive.Unstable_TriggerPopoverItems>
    </ComposerPrimitive.Unstable_TriggerPopover>
  );
}

export function ComposerMentions({ threadId }: { threadId: string | null }) {
  return (
    <ComposerMentionsBoundary key={threadId ?? "new"}>
      <ComposerMentionsContent threadId={threadId} />
    </ComposerMentionsBoundary>
  );
}
