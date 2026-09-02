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
import { Component, useEffect, useMemo, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";

type Mention = {
  id: string;
  type: string;
  label: string;
  description?: string;
  icon: string;
};

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
  const activeProjectId = useChatRuntimeStore((s) => s.activeProjectId);
  const { projects } = useChatProjects();
  const [mcps, setMcps] = useState<Mention[]>([]);
  const [files, setFiles] = useState<Mention[]>([]);
  const [skills, setSkills] = useState<Mention[]>([]);

  useEffect(() => {
    void listMcpServers()
      .then((rows) => setMcps(rows.filter((row) => row.is_enabled).map((row) => ({
        id: row.id,
        type: "mcp",
        label: row.display_name,
        description: row.tool_count == null ? "Servidor conectado sin verificar" : `${row.tool_count} herramientas disponibles`,
        icon: "mcp",
      }))))
      .catch(() => setMcps([]));
    void listInstalledSkills()
      .then((rows) => setSkills(rows.map((skill) => ({
        id: skill.id,
        type: "skill",
        label: skill.name,
        description: skill.description,
        icon: "skill",
      }))))
      .catch(() => setSkills([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const requests = [threadId ? listThreadDocuments(threadId) : Promise.resolve([])];
    if (activeProjectId) requests.push(listProjectDocuments(activeProjectId));
    void Promise.all(requests)
      .then((groups) => {
        if (cancelled) return;
        const byId = new Map(groups.flat().map((file) => [file.id, file]));
        setFiles([...byId.values()].map((file) => ({
          id: file.id,
          type: "file",
          label: file.filename,
          description: file.status === "completed" ? "Archivo indexado" : `Archivo: ${file.status}`,
          icon: "file",
        })));
      })
      .catch(() => !cancelled && setFiles([]));
    return () => { cancelled = true; };
  }, [activeProjectId, threadId]);

  const project = projects.find((item) => item.id === activeProjectId);
  const categories = useMemo(() => [
    { id: "mcp", label: "MCP conectados", items: mcps },
    { id: "project", label: "Contexto del proyecto", items: project ? [{ id: project.id, type: "project", label: project.name, description: "Usar las instrucciones y el contexto del proyecto", icon: "project" }] : [] },
    { id: "files", label: "Archivos", items: files },
    { id: "skills", label: "Skills", items: skills },
  ].filter((category) => category.items.length > 0), [files, mcps, project, skills]);
  const mention = unstable_useMentionAdapter({ categories, includeModelContextTools: false });

  return (
    <ComposerPrimitive.Unstable_TriggerPopover char="@" adapter={mention.adapter} className="absolute bottom-full left-0 z-30 mb-2 w-80 overflow-hidden rounded-xl border bg-popover p-1 shadow-md" aria-label="Mencionar contexto">
      <ComposerPrimitive.Unstable_TriggerPopover.Directive {...mention.directive} />
      <ComposerPrimitive.Unstable_TriggerPopoverCategories className="flex flex-col gap-0.5">
        {(categories) => categories.map((category) => (
          <ComposerPrimitive.Unstable_TriggerPopoverCategoryItem key={category.id} categoryId={category.id} className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm outline-none hover:bg-accent data-[highlighted]:bg-accent">
            {category.label}
          </ComposerPrimitive.Unstable_TriggerPopoverCategoryItem>
        ))}
      </ComposerPrimitive.Unstable_TriggerPopoverCategories>
      <ComposerPrimitive.Unstable_TriggerPopoverBack className="px-3 py-2 text-sm text-muted-foreground">← Volver</ComposerPrimitive.Unstable_TriggerPopoverBack>
      <ComposerPrimitive.Unstable_TriggerPopoverItems className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
        {(items) => items.map((item, index) => (
          <ComposerPrimitive.Unstable_TriggerPopoverItem key={`${item.type}-${item.id}`} item={item} index={index} className="flex w-full flex-col rounded-md px-3 py-2 text-left outline-none hover:bg-accent data-[highlighted]:bg-accent">
            <span className="text-sm">{item.label}</span>
            {item.description ? <span className="text-xs text-muted-foreground">{item.description}</span> : null}
          </ComposerPrimitive.Unstable_TriggerPopoverItem>
        ))}
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
