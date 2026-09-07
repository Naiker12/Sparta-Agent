import { useCallback, useEffect, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  AiMagicIcon,
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Delete02Icon,
  FlashIcon,
  Message01Icon,
  PencilEdit02Icon,
  ReloadIcon,
} from "@hugeicons/core-free-icons";
import { authFetch } from "@/features/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

type Task = {
  id: string;
  title: string;
  prompt: string;
  intervalSeconds: number | null;
  enabled: boolean;
  status: string;
  nextRunAt: number | null;
  createdAt?: number;
};

const FREQUENCY_PRESETS = [
  { label: "15 min", minutes: 15 },
  { label: "30 min", minutes: 30 },
  { label: "1 hora", minutes: 60 },
  { label: "6 horas", minutes: 360 },
  { label: "12 horas", minutes: 720 },
  { label: "24 horas", minutes: 1440 },
];

const TASK_TEMPLATES = [
  {
    title: "Resumen matutino y prioridades",
    prompt:
      "Genera un resumen ejecutivo de las tareas pendientes, notas recientes y prioridades estratégicas para iniciar la jornada.",
    minutes: 1440,
    badge: "Productividad",
    icon: AiMagicIcon,
  },
  {
    title: "Auditoría de salud y dependencias",
    prompt:
      "Revisa la salud del workspace local, estado de dependencias del proyecto y posibles alertas de seguridad o mantenimiento.",
    minutes: 360,
    badge: "Mantenimiento",
    icon: FlashIcon,
  },
  {
    title: "Monitoreo periódico del proyecto",
    prompt:
      "Analiza cambios recientes en el código, ramas activas e incidencias pendientes y proporciona un reporte condensado.",
    minutes: 60,
    badge: "Desarrollo",
    icon: PencilEdit02Icon,
  },
];

function formatInterval(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "Una vez";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `Cada ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Cada ${hours} ${hours === 1 ? "hora" : "horas"}`;
  const days = Math.round(hours / 24);
  return `Cada ${days} ${days === 1 ? "día" : "días"}`;
}

export function TasksPage() {
  const t = useT();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [selectedPresetMinutes, setSelectedPresetMinutes] = useState<number | null>(60);
  const [customMinutes, setCustomMinutes] = useState("60");
  const [isCustomInterval, setIsCustomInterval] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeMinutes = isCustomInterval
    ? Math.max(1, Number(customMinutes) || 60)
    : selectedPresetMinutes ?? 60;

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authFetch("/api/tasks");
      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? "El servicio de tareas aún no está activo en el backend. Reinicia la aplicación para conectarlo."
            : `Error al cargar tareas (HTTP ${response.status})`
        );
      }
      const data = await response.json();
      setTasks(data.tasks ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudieron cargar las tareas";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = async () => {
    if (!title.trim() || !prompt.trim() || isCreating) return;
    setIsCreating(true);
    setError(null);
    try {
      const seconds = activeMinutes * 60;
      const response = await authFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          prompt: prompt.trim(),
          scheduleType: "interval",
          intervalSeconds: seconds,
        }),
      });

      if (!response.ok) {
        throw new Error("No se pudo crear la tarea programada");
      }

      setTitle("");
      setPrompt("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear la tarea");
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggle = async (task: Task) => {
    try {
      const response = await authFetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...task,
          scheduleType: "interval",
          enabled: !task.enabled,
        }),
      });
      if (response.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, enabled: !t.enabled } : t))
        );
      }
    } catch (e) {
      console.error("Error toggling task:", e);
    }
  };

  const handleDelete = async (taskId: string) => {
    setDeletingId(taskId);
    try {
      const response = await authFetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      } else {
        await refresh();
      }
    } catch (e) {
      console.error("Error deleting task:", e);
    } finally {
      setDeletingId(null);
    }
  };

  const applyTemplate = (template: (typeof TASK_TEMPLATES)[number]) => {
    setTitle(template.title);
    setPrompt(template.prompt);
    setIsCustomInterval(false);
    setSelectedPresetMinutes(template.minutes);
  };

  const activeCount = useMemo(() => tasks.filter((t) => t.enabled).length, [tasks]);

  return (
    <main className="flex w-full flex-1 flex-col gap-6 p-4 sm:p-6 md:p-8 lg:p-10 transition-all">
      {/* Top Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <HugeiconsIcon icon={Clock01Icon} strokeWidth={1.75} className="size-5" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {t("shell.navigation.tasks") || "Tareas Programadas"}
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Automatiza agentes autónomos para ejecutar análisis, recordatorios y reportes periódicos en segundo plano.
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
              className={cn("size-3.5", isLoading && "animate-spin text-primary")}
            />
            {isLoading ? "Cargando..." : "Actualizar"}
          </Button>
        </div>
      </header>

      {/* Error Alert Banner */}
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Atención con el servicio de tareas</p>
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

      {/* Quick Stats Grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-3xl border border-foreground/10 bg-card p-4 ring-1 ring-foreground/5 shadow-xs">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={1.75} className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tareas Activas</p>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight">{activeCount}</span>
              <span className="text-xs text-muted-foreground">de {tasks.length} total</span>
              {activeCount > 0 && (
                <span className="inline-block size-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-3xl border border-foreground/10 bg-card p-4 ring-1 ring-foreground/5 shadow-xs">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <HugeiconsIcon icon={Message01Icon} strokeWidth={1.75} className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Canal de Notificación</p>
            <p className="mt-0.5 text-sm font-semibold">Chat Spartan</p>
            <p className="text-[11px] text-muted-foreground">Resultados directos en el feed</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-3xl border border-foreground/10 bg-card p-4 ring-1 ring-foreground/5 shadow-xs">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={1.75} className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Modo Agente</p>
            <p className="mt-0.5 text-sm font-semibold">Autónomo seguro</p>
            <p className="text-[11px] text-muted-foreground">Permisos requeridos en cambios</p>
          </div>
        </div>
      </section>

      {/* Quick Templates Bar */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={FlashIcon} strokeWidth={1.75} className="size-4 text-primary" />
          <h2 className="text-sm font-medium">Plantillas de Automatización Rápida</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {TASK_TEMPLATES.map((tmpl, idx) => {
            return (
              <button
                key={idx}
                type="button"
                onClick={() => applyTemplate(tmpl)}
                className="group flex flex-col items-start rounded-2xl border border-foreground/10 bg-card p-3.5 text-left transition-all hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex w-full items-center justify-between">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-105">
                    <HugeiconsIcon icon={tmpl.icon} strokeWidth={1.75} className="size-3.5" />
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                    {tmpl.badge}
                  </Badge>
                </div>
                <h3 className="mt-2 text-xs font-semibold group-hover:text-primary">
                  {tmpl.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                  {tmpl.prompt}
                </p>
                <div className="mt-2.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <HugeiconsIcon icon={Clock01Icon} strokeWidth={1.75} className="size-3" />
                  <span>{formatInterval(tmpl.minutes * 60)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Scheduled Tasks List */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Clock01Icon} strokeWidth={1.75} className="size-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Tareas Programadas</h2>
            <Badge variant="secondary" className="text-xs">
              {tasks.length}
            </Badge>
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-foreground/15 bg-card/50 p-10 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <HugeiconsIcon icon={Clock01Icon} strokeWidth={1.75} className="size-7 opacity-70" />
            </div>
            <h3 className="mt-3.5 text-base font-medium">Aún no tienes tareas programadas</h3>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              Programa tu primera tarea abajo o selecciona una de las plantillas rápidas para que el agente trabaje de forma autónoma.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {tasks.map((task) => {
              const isExpanded = expandedTaskId === task.id;
              const isDeleting = deletingId === task.id;

              return (
                <article
                  key={task.id}
                  className={cn(
                    "flex flex-col rounded-3xl border border-foreground/10 bg-card p-5 ring-1 ring-foreground/5 transition-all shadow-xs",
                    !task.enabled && "opacity-70 bg-card/60"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div
                        className={cn(
                          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
                          task.enabled
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={1.75} className="size-4.5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold tracking-tight">{task.title}</h3>
                          <Badge
                            variant={task.enabled ? "default" : "outline"}
                            className={cn(
                              "text-[10px] gap-1",
                              task.enabled && "bg-emerald-600 hover:bg-emerald-600 text-white"
                            )}
                          >
                            <span
                              className={cn(
                                "size-1.5 rounded-full",
                                task.enabled ? "bg-white animate-pulse" : "bg-muted-foreground"
                              )}
                            />
                            {task.enabled ? "Activa" : "Pausada"}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <HugeiconsIcon icon={Clock01Icon} strokeWidth={1.75} className="size-2.5" />
                            {formatInterval(task.intervalSeconds)}
                          </Badge>
                        </div>

                        <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                          {task.prompt}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {task.enabled ? "Habilitada" : "En pausa"}
                        </span>
                        <Switch
                          checked={task.enabled}
                          onCheckedChange={() => void handleToggle(task)}
                        />
                      </div>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(task.id)}
                        disabled={isDeleting}
                        title="Eliminar tarea"
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.75} className="size-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Expandable Prompt Preview */}
                  <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 text-xs text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                      className="flex items-center gap-1 font-medium hover:text-foreground transition-colors cursor-pointer"
                    >
                      {isExpanded ? (
                        <>
                          <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={1.75} className="size-3.5" /> Ocultar instrucciones del agente
                        </>
                      ) : (
                        <>
                          <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={1.75} className="size-3.5" /> Ver instrucciones completas
                        </>
                      )}
                    </button>

                    <span className="text-[11px]">Canal: Chat Spartan</span>
                  </div>

                  {isExpanded && (
                    <div className="mt-2.5 rounded-2xl bg-muted/50 p-3 text-xs leading-relaxed font-mono whitespace-pre-wrap text-foreground/90 border">
                      {task.prompt}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* New Task Form Card */}
      <Card className="rounded-4xl border border-foreground/10 ring-1 ring-foreground/5 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <HugeiconsIcon icon={Add01Icon} strokeWidth={1.75} className="size-4" />
            </div>
            <CardTitle className="text-lg">Programar Nueva Tarea Agéntica</CardTitle>
          </div>
          <CardDescription>
            Define qué acción deseas que el agente ejecute de forma autónoma y con qué frecuencia.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Title Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Nombre de la Tarea <span className="text-destructive">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Revisión nocturna de issues y PRs"
              className="rounded-xl h-10 text-sm"
            />
          </div>

          {/* Prompt Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">
                Instrucciones del Agente <span className="text-destructive">*</span>
              </label>
              <span className="text-[11px] text-muted-foreground">
                Sé claro con el objetivo y el formato esperado
              </span>
            </div>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe detalladamente qué debe revisar o redactar el agente en cada intervalo..."
              className="min-h-28 rounded-xl text-sm leading-relaxed"
            />
          </div>

          {/* Frequency Selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">
              Frecuencia de Ejecución
            </label>

            {/* Quick Presets Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {FREQUENCY_PRESETS.map((preset) => {
                const isSelected = !isCustomInterval && selectedPresetMinutes === preset.minutes;
                return (
                  <button
                    key={preset.minutes}
                    type="button"
                    onClick={() => {
                      setIsCustomInterval(false);
                      setSelectedPresetMinutes(preset.minutes);
                    }}
                    className={cn(
                      "flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium border transition-all cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-xs"
                        : "border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <HugeiconsIcon icon={Clock01Icon} strokeWidth={1.75} className="size-3" />
                    {preset.label}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setIsCustomInterval(true)}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-medium border transition-all cursor-pointer",
                  isCustomInterval
                    ? "border-primary bg-primary text-primary-foreground shadow-xs"
                    : "border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                Personalizado
              </button>
            </div>

            {/* Custom Minutes Input */}
            {isCustomInterval && (
              <div className="flex items-center gap-2 pt-1 max-w-xs">
                <Input
                  type="number"
                  min="1"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  placeholder="Minutos"
                  className="rounded-xl h-9 text-sm"
                />
                <span className="text-xs text-muted-foreground shrink-0">minutos por ciclo</span>
              </div>
            )}
          </div>
        </CardContent>

        <div className="flex items-center justify-between border-t border-border/60 px-6 py-4">
          <p className="text-xs text-muted-foreground">
            Se ejecutará: <strong className="text-foreground">{formatInterval(activeMinutes * 60)}</strong>
          </p>

          <Button
            onClick={() => void handleCreate()}
            disabled={!title.trim() || !prompt.trim() || isCreating}
            className="gap-2 rounded-full px-5"
          >
            {isCreating ? (
              <>
                <HugeiconsIcon icon={ReloadIcon} strokeWidth={1.75} className="size-4 animate-spin" /> Guardando...
              </>
            ) : (
              <>
                <HugeiconsIcon icon={Add01Icon} strokeWidth={1.75} className="size-4" /> Crear Tarea Programada
              </>
            )}
          </Button>
        </div>
      </Card>
    </main>
  );
}
