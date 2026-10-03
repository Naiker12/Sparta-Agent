import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "@/features/auth";
import { useExternalProvidersStore } from "@/features/chat/stores/external-providers-store";
import { ApiProviderLogo } from "@/features/chat/api-provider-logo";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { primeNativeNotificationPermission } from "@/lib/native-notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

type Task = {
  id: string;
  title: string;
  prompt: string;
  scheduleType: "interval" | "once" | "weekly";
  weekdays?: number[];
  localTime?: string;
  timezone?: string;
  notify?: boolean;
  intervalSeconds: number | null;
  runAt: number | null;
  enabled: boolean;
  nextRunAt: number | null;
  lastError?: string;
  runs?: {
    id: string;
    startedAt: number;
    status: string;
    output?: string;
    error?: string;
  }[];
};
type Draft = {
  title: string;
  prompt: string;
  scheduleType: "interval" | "once" | "weekly";
  weekdays: string[];
  localTime: string;
  timezone: string;
  notify: boolean;
  minutes: string;
  date: string;
};
const blank: Draft = {
  title: "",
  prompt: "",
  scheduleType: "interval",
  minutes: "60",
  date: "",
  weekdays: ["0", "1", "2", "3", "4"],
  localTime: "09:00",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  notify: true,
};
const days = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
const weeklyLabel = (value: {
  weekdays?: number[];
  localTime?: string;
  timezone?: string;
}) =>
  `${(value.weekdays ?? []).map((day) => days[day]?.slice(0, 3)).join(", ")} · ${value.localTime ?? "09:00"} · ${value.timezone ?? "UTC"}`;
const dateLabel = (value: number | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(value)
    : "Sin fecha";
const message = (error: unknown) =>
  error instanceof Error ? error.message : "No se pudo completar la operación.";
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/tasks${path}`, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(
      typeof payload?.detail === "string"
        ? payload.detail
        : `No se pudo completar la operación (HTTP ${response.status}).`,
    );
  }
  return response.json();
}

export function AutomationsPage() {
  const providers = useExternalProvidersStore((s) => s.providers).filter(
    (p) => p.authKind !== "chatgpt_oauth" && p.providerType !== "openai_codex",
  );
  const [providerId, setProviderId] = useState("");
  const [model, setModel] = useState("");
  const provider = providers.find((p) => p.id === providerId);
  const models = provider?.models.length
    ? provider.models
    : (provider?.availableModels ?? []);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Task | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editor, setEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [activating, setActivating] = useState(false);
  const detailSequence = useRef(0);
  const listSequence = useRef(0);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const refresh = useCallback(async () => {
    const sequence = ++listSequence.current;
    setLoading(true);
    try {
      const data = await request<{ tasks: Task[] }>("");
      if (sequence === listSequence.current) {
        setTasks(data.tasks);
        setError(null);
      }
    } catch (cause) {
      if (sequence === listSequence.current) setError(message(cause));
    } finally {
      if (sequence === listSequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    return () => {
      listSequence.current++;
      detailSequence.current++;
    };
  }, [refresh]);
  function create() {
    setEditingId(null);
    setDraft(blank);
    setStep(0);
    setEditor(true);
    setError(null);
  }
  function edit(task: Task) {
    const date = task.runAt ? new Date(task.runAt) : null;
    setEditingId(task.id);
    setDraft({
      title: task.title,
      prompt: task.prompt,
      scheduleType: task.scheduleType,
      weekdays: (task.weekdays ?? [0, 1, 2, 3, 4]).map(String),
      localTime: task.localTime ?? "09:00",
      timezone: task.timezone ?? timezone,
      notify: task.notify ?? true,
      minutes: String((task.intervalSeconds ?? 3600) / 60),
      date: date
        ? new Date(date.getTime() - date.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16)
        : "",
    });
    detailSequence.current++;
    setStep(0);
    setEditor(true);
    setSelected(null);
    setError(null);
  }
  async function detail(task: Task) {
    const sequence = ++detailSequence.current;
    setSelected(task);
    setDetailLoading(true);
    setError(null);
    try {
      const next = await request<Task>(`/${task.id}`);
      if (sequence === detailSequence.current) setSelected(next);
    } catch (cause) {
      if (sequence === detailSequence.current) setError(message(cause));
    } finally {
      if (sequence === detailSequence.current) setDetailLoading(false);
    }
  }
  const validText = Boolean(draft.title.trim() && draft.prompt.trim());
  const validSchedule =
    draft.scheduleType === "interval"
      ? Number.isInteger(Number(draft.minutes)) && Number(draft.minutes) >= 1
      : draft.scheduleType === "weekly"
        ? draft.weekdays.length > 0 &&
          /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.localTime)
        : Boolean(draft.date) && new Date(draft.date).getTime() > Date.now();
  async function save() {
    if (busy || !validText || !validSchedule) return;
    setBusy(true);
    setError(null);
    try {
      await request(editingId ? `/${editingId}` : "", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title.trim(),
          prompt: draft.prompt.trim(),
          scheduleType: draft.scheduleType,
          intervalSeconds:
            draft.scheduleType === "interval"
              ? Number(draft.minutes) * 60
              : null,
          runAt:
            draft.scheduleType === "once"
              ? new Date(draft.date).getTime()
              : null,
          enabled: false,
          weekdays: draft.weekdays.map(Number),
          localTime: draft.localTime,
          timezone: draft.timezone,
          notify: draft.notify,
        }),
      });
      setEditor(false);
      await refresh();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  async function pause(task: Task) {
    setBusy(true);
    setError(null);
    try {
      const next = await request<Task>(`/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });
      setSelected(next);
      await refresh();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleting || busy) return;
    setBusy(true);
    setError(null);
    try {
      await request(`/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      setSelected(null);
      await refresh();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  async function preview() {
    if (!selected || busy || !provider || !models.includes(model)) return;
    const taskId = selected.id;
    const sequence = ++detailSequence.current;
    setBusy(true);
    setError(null);
    try {
      const next = await request<Task>(`/${taskId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, model }),
      });
      if (sequence === detailSequence.current) setSelected(next);
      if (selected.notify !== false)
        toast.success(`Prueba completada: ${selected.title}`);
    } catch (cause) {
      if (sequence === detailSequence.current) {
        if (selected.notify !== false)
          toast.error(`La prueba falló: ${selected.title}`);
        setError(message(cause));
        // Failed executions also leave a durable history record.
        const next = await request<Task>(`/${taskId}`).catch(() => null);
        if (next && sequence === detailSequence.current) setSelected(next);
      }
    } finally {
      setBusy(false);
    }
  }
  async function activate() {
    if (!selected || busy || !provider || !models.includes(model)) return;
    setBusy(true);
    setError(null);
    try {
      const next = await request<Task>(`/${selected.id}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, model }),
      });
      setSelected(next);
      setActivating(false);
      if (selected.notify !== false) await primeNativeNotificationPermission();
      await refresh();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  const visible = tasks.filter(
    (task) =>
      (filter === "all" ||
        (filter === "enabled"
          ? task.enabled
          : filter === "paused"
            ? !task.enabled
            : Boolean(task.lastError))) &&
      `${task.title} ${task.prompt}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  const errorAlert = error && (
    <Alert variant="destructive" role="alert">
      <AlertTitle>No se pudo completar la operación</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-5 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Automatizaciones</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organiza lo que quieres delegar y revisa cada resultado.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || busy}
            onClick={() => void refresh()}
          >
            Actualizar
          </Button>
          <Button size="sm" onClick={create}>
            Nueva automatización
          </Button>
        </div>
      </header>
      <Alert>
        <AlertTitle>Ejecución mientras la aplicación esté abierta</AlertTitle>
        <AlertDescription>
          Guarda un borrador, elige proveedor y modelo y confirma la activación.
          No se ejecuta con el backend cerrado. Las tareas son de texto y no tienen acceso a archivos ni comandos.
        </AlertDescription>
      </Alert>
      {errorAlert}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="enabled">Habilitadas</TabsTrigger>
            <TabsTrigger value="paused">Borradores</TabsTrigger>
            <TabsTrigger value="attention">Con errores</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          aria-label="Buscar automatizaciones"
          placeholder="Buscar automatizaciones…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-xs"
        />
      </div>
      {loading ? (
        <div
          className="flex flex-col gap-3"
          role="status"
          aria-label="Cargando automatizaciones"
        >
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : visible.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>
              {tasks.length ? "Sin coincidencias" : "Tu primera automatización"}
            </EmptyTitle>
            <EmptyDescription>
              {tasks.length
                ? "Prueba otro filtro o búsqueda."
                : "Define instrucciones y horario. Se guardará como borrador."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={create}>
              Crear borrador
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <section
          aria-label="Automatizaciones guardadas"
          className="overflow-hidden rounded-xl border border-border"
        >
          {visible.map((task, index) => (
            <div key={task.id}>
              {index > 0 && <Separator />}
              <button
                type="button"
                onClick={() => void detail(task)}
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{task.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {task.scheduleType === "once"
                      ? `Una vez · ${dateLabel(task.runAt)}`
                      : task.scheduleType === "weekly"
                        ? weeklyLabel(task)
                        : `Cada ${(task.intervalSeconds ?? 0) / 60} minutos`}
                  </p>
                </div>
                <Badge variant={task.lastError ? "destructive" : "secondary"}>
                  {task.lastError
                    ? "Requiere atención"
                    : task.enabled
                      ? "Activa"
                      : "Borrador"}
                </Badge>
              </button>
            </div>
          ))}
        </section>
      )}
      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (busy) return;
          if (!open) {
            detailSequence.current++;
            setSelected(null);
          }
        }}
      >
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{selected?.title ?? "Automatización"}</SheetTitle>
            <SheetDescription>
              Instrucciones, horario y registros disponibles.
            </SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="flex flex-col gap-5 px-4 pb-6">
              {errorAlert}
              <section>
                <h2 className="text-sm font-medium">Instrucciones</h2>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                  {selected.prompt}
                </p>
              </section>
              <Separator />
              <p className="text-sm text-muted-foreground">
                Próxima ejecución: {dateLabel(selected.nextRunAt)}. Requiere el
                backend abierto. Solo texto, sin archivos ni comandos.
              </p>
              {selected.scheduleType === "weekly" && (
                <p className="text-sm text-muted-foreground">
                  {weeklyLabel(selected)}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={busy || detailLoading}
                  onClick={() => edit(selected)}
                >
                  Editar
                </Button>
                {selected.enabled && (
                  <Button
                    variant="outline"
                    disabled={busy || detailLoading}
                    onClick={() => void pause(selected)}
                  >
                    Pausar
                  </Button>
                )}
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => setDeleting(selected)}
                >
                  Eliminar
                </Button>
              </div>
              <Separator />
              <FieldGroup>
                <Field data-disabled={busy}>
                  <FieldLabel htmlFor="preview-provider">
                    Proveedor para la prueba
                  </FieldLabel>
                  <Select
                    value={providerId}
                    disabled={busy}
                    onValueChange={(value) => {
                      setProviderId(value);
                      setModel("");
                    }}
                  >
                    <SelectTrigger id="preview-provider">
                      <SelectValue placeholder="Elegir proveedor API" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {providers.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <ApiProviderLogo
                              providerType={p.providerType}
                              className="size-4"
                            />
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Si no aparece ninguno, configura una conexión API en
                    ajustes.
                  </FieldDescription>
                </Field>
                <Field data-disabled={busy || !provider}>
                  <FieldLabel htmlFor="preview-model">Modelo</FieldLabel>
                  <Select
                    value={model}
                    disabled={busy || !provider}
                    onValueChange={setModel}
                  >
                    <SelectTrigger id="preview-model">
                      <SelectValue placeholder="Elegir modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {models.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Envía solo estas instrucciones al proveedor elegido; puede
                    generar coste. No lee archivos, ejecuta comandos ni activa
                    el horario.
                  </FieldDescription>
                </Field>
                <Button
                  disabled={
                    busy ||
                    detailLoading ||
                    !provider ||
                    !models.includes(model)
                  }
                  onClick={() => void preview()}
                >
                  {busy ? "Procesando…" : "Enviar prueba al proveedor"}
                </Button>
                {!selected.enabled && (
                  <Button
                    disabled={
                      busy ||
                      detailLoading ||
                      !provider ||
                      !models.includes(model)
                    }
                    onClick={() => setActivating(true)}
                  >
                    Activar horario…
                  </Button>
                )}
              </FieldGroup>
              <Separator />
              <h2 className="text-sm font-medium">Historial</h2>
              {detailLoading ? (
                <Skeleton className="h-16" />
              ) : selected.runs?.length ? (
                selected.runs.map((run) => (
                  <section key={run.id} className="flex flex-col gap-2">
                    <p className="text-sm">
                      {dateLabel(run.startedAt)} · {run.status}
                    </p>
                    <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {run.error || run.output || "Sin resultado registrado"}
                    </p>
                  </section>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No hay ejecuciones registradas.
                </p>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
      <Sheet
        open={editor}
        onOpenChange={(open) => {
          if (!busy) setEditor(open);
        }}
      >
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {editingId ? "Editar automatización" : "Nueva automatización"}
            </SheetTitle>
            <SheetDescription>
              Paso {step + 1} de 3 · {timezone}
            </SheetDescription>
          </SheetHeader>
          <form
            className="flex flex-col gap-5 px-4 pb-6"
            onSubmit={(event) => {
              event.preventDefault();
              if (step < 2) {
                if (step === 0 ? validText : validSchedule) setStep(step + 1);
              } else void save();
            }}
          >
            {errorAlert}
            <FieldGroup>
              {step === 0 && (
                <>
                  <Field>
                    <FieldLabel htmlFor="task-title">Nombre</FieldLabel>
                    <Input
                      id="task-title"
                      value={draft.title}
                      maxLength={300}
                      required
                      onChange={(event) =>
                        setDraft({ ...draft, title: event.target.value })
                      }
                      placeholder="Resumen del proyecto"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="task-prompt">
                      ¿Qué debe hacer el agente?
                    </FieldLabel>
                    <Textarea
                      id="task-prompt"
                      value={draft.prompt}
                      maxLength={20000}
                      required
                      rows={6}
                      onChange={(event) =>
                        setDraft({ ...draft, prompt: event.target.value })
                      }
                      placeholder="Describe el objetivo y el resultado esperado…"
                    />
                    <FieldDescription>
                      No incluyas claves API ni contraseñas.
                    </FieldDescription>
                  </Field>
                </>
              )}
              {step === 1 && (
                <>
                  <Field>
                    <FieldLabel>Frecuencia</FieldLabel>
                    <Select
                      value={draft.scheduleType}
                      onValueChange={(value) =>
                        setDraft({
                          ...draft,
                          scheduleType: value as Draft["scheduleType"],
                        })
                      }
                    >
                      <SelectTrigger aria-label="Frecuencia">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="interval">
                            Cada cierto tiempo
                          </SelectItem>
                          <SelectItem value="once">Una sola vez</SelectItem>
                          <SelectItem value="weekly">
                            Días de la semana
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  {draft.scheduleType === "interval" ? (
                    <Field data-invalid={!validSchedule}>
                      <FieldLabel htmlFor="task-minutes">
                        Intervalo en minutos
                      </FieldLabel>
                      <Input
                        id="task-minutes"
                        type="number"
                        min={1}
                        step={1}
                        required
                        aria-invalid={!validSchedule}
                        value={draft.minutes}
                        onChange={(event) =>
                          setDraft({ ...draft, minutes: event.target.value })
                        }
                      />
                    </Field>
                  ) : draft.scheduleType === "weekly" ? (
                    <>
                      <Field data-invalid={!draft.weekdays.length}>
                        <FieldLabel id="task-days">
                          Días de ejecución
                        </FieldLabel>
                        <ToggleGroup
                          type="multiple"
                          variant="outline"
                          size="sm"
                          aria-labelledby="task-days"
                          value={draft.weekdays}
                          onValueChange={(weekdays) =>
                            setDraft({ ...draft, weekdays })
                          }
                          className="flex-wrap justify-start"
                        >
                          {days.map((day, index) => (
                            <ToggleGroupItem
                              key={day}
                              value={String(index)}
                              aria-label={day}
                            >
                              {day.slice(0, 3)}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                        {!draft.weekdays.length && (
                          <FieldDescription>
                            Selecciona al menos un día.
                          </FieldDescription>
                        )}
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="task-time">Hora</FieldLabel>
                        <Input
                          id="task-time"
                          type="time"
                          required
                          value={draft.localTime}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              localTime: event.target.value,
                            })
                          }
                        />
                        <FieldDescription>
                          Zona guardada: {draft.timezone}. Horario preparado; se
                          ejecuta únicamente con la aplicación abierta.
                        </FieldDescription>
                      </Field>
                    </>
                  ) : (
                    <Field data-invalid={!validSchedule}>
                      <FieldLabel htmlFor="task-date">
                        Fecha y hora local
                      </FieldLabel>
                      <Input
                        id="task-date"
                        type="datetime-local"
                        required
                        aria-invalid={!validSchedule}
                        value={draft.date}
                        onChange={(event) =>
                          setDraft({ ...draft, date: event.target.value })
                        }
                      />
                      <FieldDescription>
                        Elige una fecha futura. Zona: {timezone}.
                      </FieldDescription>
                    </Field>
                  )}
                  <Field orientation="horizontal">
                    <Switch
                      id="task-notify"
                      checked={draft.notify}
                      onCheckedChange={(notify) =>
                        setDraft({ ...draft, notify })
                      }
                    />
                    <FieldLabel htmlFor="task-notify">
                      Avisarme del resultado en la aplicación
                    </FieldLabel>
                  </Field>
                  <FieldDescription>
                    Actualmente avisa al terminar una prueba manual en esta
                    pantalla. Las notificaciones del sistema y de ejecuciones
                    programadas requieren permiso del sistema y la aplicación
                    abierta.
                  </FieldDescription>
                </>
              )}
              {step === 2 && (
                <>
                  <Field>
                    <FieldLabel>Revisar borrador</FieldLabel>
                    <p className="font-medium">{draft.title}</p>
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {draft.prompt}
                    </p>
                    <FieldDescription>
                      {draft.scheduleType === "interval"
                        ? `Cada ${draft.minutes} minutos`
                        : draft.scheduleType === "weekly"
                          ? weeklyLabel({
                              ...draft,
                              weekdays: draft.weekdays.map(Number),
                            })
                          : dateLabel(new Date(draft.date).getTime())}
                    </FieldDescription>
                  </Field>
                  <Alert>
                    <AlertTitle>Se guardará pausada</AlertTitle>
                    <AlertDescription>
                      No concede acceso a carpetas ni ejecuta acciones. La
                      selección de proyecto, proveedor y permisos llegará con el
                      ejecutor.
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </FieldGroup>
            <div className="flex justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => (step ? setStep(step - 1) : setEditor(false))}
              >
                {step ? "Atrás" : "Cancelar"}
              </Button>
              <Button
                type="submit"
                disabled={busy || (step === 0 ? !validText : !validSchedule)}
              >
                {busy
                  ? "Guardando…"
                  : step === 2
                    ? "Guardar borrador"
                    : "Continuar"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={activating}
        onOpenChange={(open) => {
          if (!busy) setActivating(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Activar este horario?</AlertDialogTitle>
            <AlertDialogDescription>
              Autoriza enviar las instrucciones guardadas a {provider?.name}{" "}
              usando {model} en cada horario. Puede generar costes. No accede a
              archivos ni ejecuta comandos. Requiere el backend abierto; al
              reiniciar ejecutará una sola ocurrencia pendiente, no todas las
              perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {errorAlert}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <Button disabled={busy} onClick={() => void activate()}>
              {busy ? "Activando…" : "Confirmar activación"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!busy && !open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta automatización?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán «{deleting?.title}» y su historial. No se borrarán
              archivos de tu proyecto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {errorAlert}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? "Eliminando…" : "Eliminar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
