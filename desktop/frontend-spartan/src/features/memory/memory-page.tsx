import {
  Background,
  BaseEdge,
  Controls,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  type Node as FlowNode,
  Handle,
  MiniMap,
  type NodeProps,
  Position,
  ReactFlow,
  getBezierPath,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/features/auth";
import { ExtractionReview } from "./extraction-review";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  Add01Icon,
  AiBrain01Icon,
  AiMagicIcon,
  AlertCircleIcon,
  Clock01Icon,
  Delete02Icon,
  Idea01Icon,
  Link01Icon,
  ReloadIcon,
  Search01Icon,
  Share01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useMemo, useState } from "react";

type MemoryNode = {
  id: string;
  type: string;
  label: string;
  content: string;
  sourceThreadId: string | null;
  confidence: number;
  sourceRole?: string | null;
  sourceMessageId?: string | null;
};
type MemoryEdge = {
  id: string;
  source: string;
  target: string;
  relation: string;
};
type GraphResponse = { nodes: MemoryNode[]; edges: MemoryEdge[] };

type CustomNodeData = MemoryNode & {
  isSelected?: boolean;
};

const TYPE_CONFIG: Record<
  string,
  {
    label: string;
    icon: typeof Idea01Icon;
    nodeBg: string;
    nodeBorder: string;
    iconBadge: string;
    glow: string;
    badgeVariant: "default" | "secondary" | "outline";
  }
> = {
  fact: {
    label: "Hecho",
    icon: Idea01Icon,
    nodeBg: "bg-emerald-500/10 dark:bg-emerald-950/40",
    nodeBorder: "border-emerald-500/40 hover:border-emerald-500/80",
    iconBadge: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300",
    glow: "shadow-emerald-500/25",
    badgeVariant: "default",
  },
  preference: {
    label: "Preferencia",
    icon: AiMagicIcon,
    nodeBg: "bg-violet-500/10 dark:bg-violet-950/40",
    nodeBorder: "border-violet-500/40 hover:border-violet-500/80",
    iconBadge: "bg-violet-500/20 text-violet-600 dark:text-violet-300",
    glow: "shadow-violet-500/25",
    badgeVariant: "secondary",
  },
  entity: {
    label: "Entidad",
    icon: AiBrain01Icon,
    nodeBg: "bg-sky-500/10 dark:bg-sky-950/40",
    nodeBorder: "border-sky-500/40 hover:border-sky-500/80",
    iconBadge: "bg-sky-500/20 text-sky-600 dark:text-sky-300",
    glow: "shadow-sky-500/25",
    badgeVariant: "outline",
  },
  event: {
    label: "Evento",
    icon: Clock01Icon,
    nodeBg: "bg-amber-500/10 dark:bg-amber-950/40",
    nodeBorder: "border-amber-500/40 hover:border-amber-500/80",
    iconBadge: "bg-amber-500/20 text-amber-600 dark:text-amber-300",
    glow: "shadow-amber-500/25",
    badgeVariant: "outline",
  },
};

function CustomMemoryNode({ data }: NodeProps) {
  const node = data as unknown as CustomNodeData;
  return (
    <div className="relative flex flex-col items-center">
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div className={cn("size-5 rounded-full border-2 border-background bg-primary shadow-sm",
        node.isSelected && "ring-4 ring-primary/25")} />
      <span className="absolute top-7 max-w-40 truncate text-xs text-foreground">{node.label}</span>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}

function CustomMemoryEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  label,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        className="stroke-primary/40 dark:stroke-primary/50 transition-all"
        style={{
          strokeWidth: 2,
          strokeDasharray: "5, 5",
          ...style,
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="rounded-full border border-foreground/15 bg-background/95 px-2.5 py-0.5 text-[10px] font-medium text-foreground/80 shadow-xs backdrop-blur-md select-none transition-all hover:border-primary/50 hover:text-foreground"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export function MemoryPage() {
  const t = useT();
  const [graph, setGraph] = useState<GraphResponse>({ nodes: [], edges: [] });
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [label, setLabel] = useState("");
  const [content, setContent] = useState("");
  const [kind, setKind] = useState("fact");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState("");
  const [relation, setRelation] = useState("relacionado con");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const nodeTypes = useMemo(() => ({ memoryNode: CustomMemoryNode }), []);
  const edgeTypes = useMemo(() => ({ memoryEdge: CustomMemoryEdge }), []);

  const refresh = useCallback(
    async (q = query) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await authFetch(
          `/api/memory/graph${q ? `?q=${encodeURIComponent(q)}` : ""}`,
        );
        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? "El módulo de memoria aún no está activo en el backend. Reinicia la aplicación para conectarlo."
              : `Error al cargar la memoria (HTTP ${response.status})`,
          );
        }
        setGraph(await response.json());
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Error al conectar con la memoria",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [query],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const add = async () => {
    if (!(label.trim() && content.trim()) || isSaving) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const response = await authFetch("/api/memory/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: kind,
          label: label.trim(),
          content: content.trim(),
        }),
      });
      if (!response.ok) {
        throw new Error(
          "No se pudo guardar el recuerdo en la memoria de Sparta",
        );
      }
      setLabel("");
      setContent("");
      await refresh("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al guardar recuerdo",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await authFetch(`/api/memory/nodes/${id}`, { method: "DELETE" });
      if (selectedId === id) {
        setSelectedId(null);
      }
      await refresh();
    } catch (_err) {}
  };

  const connect = async () => {
    if (!(selectedId && targetId && relation.trim())) {
      return;
    }
    try {
      const response = await authFetch("/api/memory/edges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: selectedId,
          target: targetId,
          relation,
        }),
      });
      if (!response.ok) {
        return setError("No se pudo guardar la relación en el grafo");
      }
      setTargetId("");
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al conectar recuerdos",
      );
    }
  };

  const filteredNodes = useMemo(() => {
    if (activeFilter === "all") {
      return graph.nodes;
    }
    return graph.nodes.filter((node) => node.type === activeFilter);
  }, [graph.nodes, activeFilter]);

  // Organic constellation layout
  const flowNodes = useMemo<FlowNode[]>(() => {
    const total = filteredNodes.length;
    const centerX = 440;
    const centerY = 320;
    const radius = Math.max(220, Math.min(380, 180 + total * 24));

    return filteredNodes.map((node, index) => {
      let x = centerX;
      let y = centerY;

      if (total > 1) {
        const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
        const r = radius + (index % 2 === 0 ? 35 : -35);
        x = Math.round(centerX + Math.cos(angle) * r);
        y = Math.round(centerY + Math.sin(angle) * (r * 0.78));
      }

      return {
        id: node.id,
        type: "memoryNode",
        position: { x, y },
        data: {
          ...node,
          isSelected: node.id === selectedId,
        },
        draggable: true,
      };
    });
  }, [filteredNodes, selectedId]);

  // Smooth curved bezier connections rendered via CustomMemoryEdge
  const flowEdges = useMemo<Edge[]>(
    () =>
      graph.edges.filter((edge) => filteredNodes.some((n) => n.id === edge.source) && filteredNodes.some((n) => n.id === edge.target)).map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "memoryEdge",
        animated: false,
        label: edge.relation,
      })),
    [graph.edges, filteredNodes],
  );

  const selected = graph.nodes.find((node) => node.id === selectedId) ?? null;

  return (
    <main className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden px-4 py-4 sm:px-6">
      {/* Top Header */}
      <header className="flex shrink-0 items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <HugeiconsIcon
                icon={AiBrain01Icon}
                strokeWidth={1.75}
                className="size-5"
              />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">
              {t("shell.navigation.memory") || "Memoria Agéntica"}
            </h1>
          </div>
          <p className="mt-1 hidden text-xs text-muted-foreground sm:block">
            Conexiones y recuerdos de tus conversaciones.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={isLoading}
            className="gap-2 min-w-[120px]"
          >
            <HugeiconsIcon
              icon={ReloadIcon}
              strokeWidth={1.75}
              className={cn(
                "size-3.5",
                isLoading && "animate-spin text-primary",
              )}
            />
            {isLoading ? "Cargando..." : "Actualizar"}
          </Button>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <HugeiconsIcon
            icon={AlertCircleIcon}
            strokeWidth={1.75}
            className="mt-0.5 size-5 shrink-0"
          />
          <div className="flex-1">
            <p className="font-medium">Atención con el servicio de memoria</p>
            <p className="mt-0.5 text-xs opacity-90">{error}</p>
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => void refresh()}
            className="shrink-0 text-destructive hover:bg-destructive/20"
          >
            Reintentar
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{graph.nodes.length} nodos · {graph.edges.length} conexiones · Episodios con fuente original</p>
      {/* Search and Filters Bar */}
      <section className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <HugeiconsIcon
            icon={Search01Icon}
            strokeWidth={1.75}
            className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void refresh()}
            placeholder="Buscar recuerdos, entidades o preferencias..."
            className="pl-9 rounded-2xl h-10 text-sm"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "all", label: "Todos" },
            { id: "fact", label: "Hechos" },
            { id: "preference", label: "Preferencias" },
            { id: "entity", label: "Entidades" },
            { id: "event", label: "Eventos" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setActiveFilter(f.id)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-medium border transition-all cursor-pointer",
                activeFilter === f.id
                  ? "border-primary bg-primary text-primary-foreground shadow-xs"
                  : "border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      {/* Interactive Knowledge Graph & Detail Section */}
      <section className={cn("grid min-h-0 flex-1 gap-4", selected && "lg:grid-cols-[minmax(0,1fr)_20rem]")}>
        {/* ReactFlow Canvas */}
        <div className="relative min-h-0 overflow-hidden rounded-xl bg-background">
          {graph.nodes.length > 0 ? (
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView={true}
              minZoom={0.2}
              maxZoom={2}
              onNodeClick={(_, node) => setSelectedId(node.id)}
              onPaneClick={() => setSelectedId(null)}
            >
              <Background
                gap={28}
                size={1.2}
                color="hsl(var(--foreground)/0.08)"
              />
              <Controls
                showInteractive={false}
                className="rounded-2xl overflow-hidden border bg-card/80 backdrop-blur-md shadow-xs"
              />
              <MiniMap
                nodeStrokeWidth={3}
                zoomable={true}
                pannable={true}
                className="!rounded-2xl !overflow-hidden !border !border-foreground/10 !bg-card/75 !backdrop-blur-md !shadow-xs !bottom-4 !right-4"
              />
            </ReactFlow>
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <HugeiconsIcon
                  icon={AiBrain01Icon}
                  strokeWidth={1.75}
                  className="size-7 opacity-70"
                />
              </div>
              <h3 className="mt-3.5 text-base font-medium">
                Aún no hay recuerdos guardados
              </h3>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Tus preguntas y respuestas guardadas aparecerán aquí con sus conexiones.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refresh()}
                disabled={isLoading}
                className="mt-4 gap-1.5 rounded-full"
              >
                <HugeiconsIcon
                  icon={AiMagicIcon}
                  strokeWidth={1.75}
                  className={cn(
                    "size-3.5 text-primary",
                    isLoading && "animate-spin",
                  )}
                />
                {isLoading
                  ? "Extrayendo de conversaciones..."
                  : "Actualizar grafo"}
              </Button>
            </div>
          )}
        </div>

        {/* Selected Node Detail Sidebar */}
        <aside className={cn("flex min-h-0 flex-col overflow-y-auto border-l p-4", !selected && "hidden")}>
          {selected ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase tracking-wider"
                  >
                    {TYPE_CONFIG[selected.type]?.label ?? selected.type}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {selected.sourceRole ? (selected.sourceRole === "assistant" ? "Respuesta generada" : "Mensaje del usuario") : `Confianza: ${Math.round((selected.confidence ?? 1) * 100)}%`}
                  </span>
                </div>
                <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                  {selected.label}
                </h3>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed bg-muted/40 p-3 rounded-2xl border">
                  {selected.content}
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {selected.sourceThreadId
                    ? `Origen: conversación ${selected.sourceThreadId.slice(0, 8)}`
                    : "Origen: añadido manualmente"}
                </p>
              </div>

              {selected.sourceMessageId && <ExtractionReview key={selected.id} nodeId={selected.id} onSaved={() => refresh()} />}
              {/* Connect to Another Memory */}
              <div className="space-y-2.5 border-t border-border/60 pt-4">
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <HugeiconsIcon
                    icon={Link01Icon}
                    strokeWidth={1.75}
                    className="size-3.5 text-primary"
                  />
                  <span>Conectar con otro recuerdo</span>
                </div>
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="h-9 w-full rounded-xl border bg-background px-3 text-xs"
                >
                  <option value="">Seleccionar nodo destino…</option>
                  {graph.nodes
                    .filter((n) => n.id !== selected.id)
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label} ({n.type})
                      </option>
                    ))}
                </select>
                <Input
                  value={relation}
                  onChange={(e) => setRelation(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                  placeholder="Relación (ej. depende de, pertenece a)"
                />
                <Button
                  className="w-full rounded-xl text-xs"
                  size="sm"
                  onClick={() => void connect()}
                  disabled={!(targetId && relation.trim())}
                >
                  Guardar Relación
                </Button>
              </div>

              <div className="pt-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void remove(selected.id)}
                  className="w-full gap-1.5 rounded-xl text-xs"
                >
                  <HugeiconsIcon
                    icon={Delete02Icon}
                    strokeWidth={1.75}
                    className="size-3.5"
                  />{" "}
                  Eliminar Recuerdo
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center p-6 text-muted-foreground">
              <HugeiconsIcon
                icon={Idea01Icon}
                strokeWidth={1.75}
                className="size-8 opacity-40 mb-2"
              />
              <p className="text-sm font-medium">Detalle del Recuerdo</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Haz clic en cualquier nodo del grafo para explorar sus detalles,
                editar sus relaciones o eliminarlo.
              </p>
            </div>
          )}
        </aside>
      </section>

      {/* Add Memory Card Form */}
      <details className="shrink-0 overflow-y-auto open:max-h-[45%]"><summary className="cursor-pointer text-xs text-muted-foreground">Añadir un recuerdo manualmente</summary>
      <Card className="rounded-4xl border border-foreground/10 ring-1 ring-foreground/5 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <HugeiconsIcon
                icon={Add01Icon}
                strokeWidth={1.75}
                className="size-4"
              />
            </div>
            <CardTitle className="text-lg">Agregar Recuerdo a Sparta</CardTitle>
          </div>
          <CardDescription>
            Enseña hechos, preferencias o entidades fijas que Spartan Agent
            recordará y aplicará en futuros chats.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[12rem_1fr]">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Tipo de Recuerdo</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
              >
                <option value="fact">Hecho (Fact)</option>
                <option value="preference">Preferencia (Preference)</option>
                <option value="entity">Entidad (Entity)</option>
                <option value="event">Evento (Event)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                Título Breve <span className="text-destructive">*</span>
              </label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ej. Idioma preferido o stack tecnológico"
                className="rounded-xl h-10 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">
              Contenido del Recuerdo <span className="text-destructive">*</span>
            </label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escribe lo que Sparta debe saber (ej. 'El usuario prefiere respuestas concisas en español y código TypeScript')."
              className="min-h-24 rounded-xl text-sm"
            />
          </div>
        </CardContent>

        <div className="flex items-center justify-end border-t border-border/60 px-6 py-4">
          <Button
            onClick={() => void add()}
            disabled={!(label.trim() && content.trim()) || isSaving}
            className="gap-2 rounded-full px-5"
          >
            {isSaving ? (
              <>
                <HugeiconsIcon
                  icon={ReloadIcon}
                  strokeWidth={1.75}
                  className="size-4 animate-spin"
                />{" "}
                Guardando...
              </>
            ) : (
              <>
                <HugeiconsIcon
                  icon={Add01Icon}
                  strokeWidth={1.75}
                  className="size-4"
                />{" "}
                Guardar Recuerdo
              </>
            )}
          </Button>
        </div>
      </Card>
      </details>
    </main>
  );
}
