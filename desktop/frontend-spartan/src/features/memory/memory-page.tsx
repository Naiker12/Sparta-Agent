import { useMemoryT as useUiT } from "./memory-i18n";
import { useMemo, useState } from "react";
import {
  AiBrain01Icon,
  Add01Icon,
  ReloadIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChatProjects } from "@/features/chat";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import { useMemory } from "./use-memory";
import { MemoryGraph } from "./memory-graph";
import { MemoryDetails } from "./memory-details";
import { MemoryEditor } from "./memory-editor";
import { filterMemoryGraph } from "./memory-graph-data";
import { MEMORY_TYPES, type MemoryNode } from "./memory-types";

export function MemoryPage() {
  const uiT = useUiT();

  const t = useT();
  const [query, setQuery] = useState("");
  const [view, setView] = useState("memories");
  const [type, setType] = useState("all");
  const [project, setProject] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<MemoryNode | "new" | null>(null);
  const memory = useMemory(query);
  const projectCatalog = useChatProjects();
  const visible = useMemo(
    () => filterMemoryGraph(memory.graph, view, type, project),
    [memory.graph, view, type, project],
  );
  const selected = memory.graph.nodes.find((node) => node.id === selectedId);
  const projects = [
    ...new Set(
      memory.graph.nodes
        .map((node) => node.projectId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const showPanel = Boolean(editor || selected);
  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 pt-4 pb-0 sm:px-6">
      <header className="flex shrink-0 items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <HugeiconsIcon icon={AiBrain01Icon} className="size-5" />
            </span>
            <h1 className="text-xl font-semibold">
              {t("shell.navigation.memory") || uiT("studio.params.memory")}
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {uiT("ui.connections_and_memories_from_your_conversations")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={memory.loading}
            onClick={() => void memory.refresh()}
          >
            <HugeiconsIcon icon={ReloadIcon} data-icon="inline-start" />
            {memory.loading
              ? uiT("chat.projectSwitcher.loading")
              : uiT("update.update")}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setSelectedId(null);
              setEditor("new");
            }}
          >
            <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" />
            {uiT("ui.add_memory")}
          </Button>
        </div>
      </header>
      <p className="text-xs text-muted-foreground">
        {visible.nodes.length}{" "}
        {view === "episodes" ? uiT("ui.episodes_") : uiT("ui.memories_")} ·{" "}
        {visible.edges.length} {uiT("ui.relationships_")}{" "}
        {memory.graph.nodes.length === 500
          ? uiT("ui.showing_up_to_500_records")
          : uiT("ui.with_original_source_when_available")}
      </p>
      {memory.error && (
        <Alert variant="destructive">
          <AlertDescription>{memory.error}</AlertDescription>
        </Alert>
      )}
      <div
        className={cn(
          "grid min-h-0 flex-1",
          showPanel &&
            "grid-cols-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-1",
        )}
      >
        <div
          className={cn("flex min-h-0 flex-col gap-3", showPanel && "lg:pr-4")}
        >
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-md">
              <HugeiconsIcon
                icon={Search01Icon}
                className="absolute left-3 top-3 size-4 text-muted-foreground"
              />
              <Input
                aria-label={uiT("ui.search_memory")}
                placeholder={uiT("ui.search_memories_entities_or_preferences")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-9"
              />
            </div>
            <Tabs value={type} onValueChange={setType}>
              <TabsList>
                <TabsTrigger value="all">{uiT("picker.all")}</TabsTrigger>
                {Object.entries(MEMORY_TYPES)
                  .filter(([key]) => key !== "episode")
                  .map(([key, label]) => (
                    <TabsTrigger
                      key={key}
                      value={key}
                      disabled={view === "episodes"}
                    >
                      {label === "Entidad" ? uiT("ui.entities") : `${label}s`}
                    </TabsTrigger>
                  ))}
              </TabsList>
            </Tabs>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <Tabs
              value={view}
              onValueChange={(value) => {
                setView(value);
                setType("all");
                setSelectedId(null);
                setEditor(null);
              }}
            >
              <TabsList>
                <TabsTrigger value="memories">{uiT("ui.memories")}</TabsTrigger>
                <TabsTrigger value="episodes">{uiT("ui.episodes")}</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select
              value={project || "personal"}
              onValueChange={(value) => {
                setProject(value === "personal" ? "" : value);
                setSelectedId(null);
              }}
            >
              <SelectTrigger
                aria-label={uiT("ui.filter_by_project")}
                className="w-56"
              >
                <SelectValue placeholder={uiT("ui.all_projects")} />
              </SelectTrigger>
              <SelectContent
                align="start"
                sideOffset={6}
                className="min-w-56 border shadow-md"
              >
                <SelectGroup>
                  <SelectItem value="all">{uiT("ui.all_projects")}</SelectItem>
                  <SelectItem value="personal">{uiT("ui.personal")}</SelectItem>
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>{uiT("chat.composer.projects")}</SelectLabel>
                  {projects.map((id) => (
                    <SelectItem key={id} value={id}>
                      <span
                        className="max-w-64 truncate"
                        title={
                          projectCatalog.projects.find((item) => item.id === id)
                            ?.name
                        }
                      >
                        {projectCatalog.projects.find((item) => item.id === id)
                          ?.name ??
                          (projectCatalog.isLoading
                            ? uiT("ui.loading_project")
                            : uiT("ui.project_unavailable"))}
                      </span>
                    </SelectItem>
                  ))}
                  {!projects.length && (
                    <SelectItem value="no-projects" disabled>
                      {uiT("ui.no_project_memories")}
                    </SelectItem>
                  )}
                </SelectGroup>
              </SelectContent>
            </Select>
            <details className="relative">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                {uiT("ui.list_of")}{" "}
                {view === "episodes"
                  ? uiT("ui.episodes_")
                  : uiT("ui.memories_")}
              </summary>
              <div className="absolute top-7 z-10 flex max-h-72 w-72 flex-col overflow-y-auto rounded-xl border bg-background p-2 shadow-sm">
                {visible.nodes.map((node) => (
                  <Button
                    key={node.id}
                    variant="ghost"
                    className="h-auto justify-start whitespace-normal text-left"
                    onClick={(event) => {
                      event.currentTarget
                        .closest("details")
                        ?.removeAttribute("open");
                      setEditor(null);
                      setSelectedId(node.id);
                    }}
                  >
                    {node.label}
                  </Button>
                ))}
              </div>
            </details>
          </div>
          <div
            className={cn(
              "relative min-h-0 flex-1",
              showPanel && "hidden lg:block",
            )}
          >
            <MemoryGraph
              graph={visible}
              selectedId={selectedId}
              onSelect={(id) => {
                setEditor(null);
                setSelectedId(id);
              }}
            />
            {!visible.nodes.length && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
                <HugeiconsIcon
                  icon={AiBrain01Icon}
                  className="size-10 text-muted-foreground"
                />
                <h2 className="font-medium">
                  {memory.loading
                    ? uiT("ui.loading_memory")
                    : query || type !== "all" || project !== "all"
                      ? uiT("ui.no_results_for_these_filters")
                      : view === "memories"
                        ? uiT("ui.no_saved_memories_yet")
                        : uiT("ui.no_episodes_yet")}
                </h2>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {view === "memories"
                    ? uiT(
                        "ui.add_a_memory_or_review_an_episode_to_extract_useful_information_c",
                      )
                    : uiT(
                        "ui.original_messages_will_appear_here_with_their_connections",
                      )}
                </p>
                {view === "memories" && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setView("episodes");
                      setType("all");
                    }}
                  >
                    {uiT("ui.explore_episodes")}
                  </Button>
                )}
              </div>
            )}
          </div>

          <p className="shrink-0 py-1 text-center text-xs text-muted-foreground">
            {uiT("ui.facts_preferences_entities_events")}
            {view === "episodes" && " · Mensajes originales, sin verificar"}
          </p>
        </div>
        {showPanel && (
          <aside className="min-h-0 overflow-y-auto border-l bg-background/40">
            {editor ? (
              <MemoryEditor
                key={editor === "new" ? "new" : editor.id}
                node={editor === "new" ? undefined : editor}
                projectId={project === "all" ? undefined : project}
                saving={memory.saving}
                onSave={memory.save}
                onClose={() => setEditor(null)}
              />
            ) : (
              selected && (
                <MemoryDetails
                  key={selected.id}
                  node={selected}
                  graph={memory.graph}
                  saving={memory.saving}
                  onClose={() => setSelectedId(null)}
                  onSelect={setSelectedId}
                  onEdit={() => setEditor(selected)}
                  onRemove={async () => {
                    if (await memory.remove(selected.id)) setSelectedId(null);
                  }}
                  onConnect={(target, relation) =>
                    memory.connect(selected.id, target, relation)
                  }
                  onRefresh={memory.refresh}
                />
              )
            )}
          </aside>
        )}
      </div>
    </main>
  );
}
