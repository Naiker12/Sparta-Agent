import { useT as useUiT } from "@/i18n";
import { getLocale, translate } from "@/i18n";
import { WORK_STATUS_LABELS, type WorkStatus } from "@/features/work";
import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "@/features/auth";
import { useNavigate } from "@tanstack/react-router";
import { useExternalProvidersStore, ApiProviderLogo } from "@/features/chat";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/lib/toast";
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
  executionMode?: "text" | "agent";
  workspaceAccess?: "none" | "read" | "write";
  webAccess?: boolean;
  projectId?: string | null;
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
    threadId?: string | null;
    deliveries?: {
      event: "started" | "finished";
      status:
        | "pending"
        | "sending"
        | "delivered"
        | "blocked"
        | "unknown"
        | "failed";
      attempts: number;
    }[];
    id: string;
    startedAt: number;
    status: string;
    output?: string;
    error?: string;
  }[];
};
type Draft = {
  executionMode: "text" | "agent";
  workspaceAccess: "none" | "read" | "write";
  webAccess: boolean;
  projectId: string;
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
  executionMode: "agent",
  workspaceAccess: "none",
  webAccess: false,
  projectId: "",
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
  "ui.monday",
  "ui.tuesday",
  "ui.wednesday",
  "ui.thursday",
  "ui.friday",
  "ui.saturday",
  "ui.sunday",
] as const;
const weeklyLabel = (value: {
  weekdays?: number[];
  localTime?: string;
  timezone?: string;
}) =>
  `${(value.weekdays ?? []).map((day) => (days[day] ? translate(days[day]).slice(0, 3) : "")).join(", ")} · ${value.localTime ?? "09:00"} · ${value.timezone ?? "UTC"}`;
const dateLabel = (value: number | null) =>
  value
    ? new Intl.DateTimeFormat(getLocale(), {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(value)
    : translate("ui.no_date");
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : translate("ui.the_operation_could_not_be_completed");
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/tasks${path}`, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(
      typeof payload?.detail === "string"
        ? payload.detail
        : `${translate("ui.the_operation_could_not_be_completed")} (HTTP ${response.status}).`,
    );
  }
  return response.json();
}

export function AutomationsPage() {
  const uiT = useUiT();

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
  const navigate = useNavigate();
  const [projects, setProjects] = useState<
    {
      id: string;
      name: string;
      archived?: boolean;
      connectedFolderPath?: string | null;
      sandboxPath?: string | null;
    }[]
  >([]);
  const [destination, setDestination] = useState<{
    accountId: string | null;
    botUsername?: string;
  } | null>(null);
  useEffect(() => {
    let stopped = false;
    void request<{ accountId: string | null; botUsername?: string }>(
      "/delivery-destination",
    )
      .then((next) => {
        if (!stopped) setDestination(next);
      })
      .catch(() => undefined);
    return () => {
      stopped = true;
    };
  }, []);
  useEffect(() => {
    let stopped = false;
    void authFetch("/api/chat/projects")
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (!stopped)
          setProjects(
            (data.projects ?? []).filter(
              (project: { archived?: boolean }) => !project.archived,
            ),
          );
      })
      .catch(() => undefined);
    return () => {
      stopped = true;
    };
  }, []);
  const selectedId = selected?.id;
  useEffect(() => {
    if (!selectedId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      let delay = 10000;
      try {
        const next = await request<Task>(`/${selectedId}`);
        delay = next.runs?.some((run) => run.status === "running") ? 2000 : 10000;
        if (!stopped)
          setSelected((current) =>
            current?.id === selectedId ? next : current,
          );
      } catch {
        /* Keep the latest checkpoint while offline. */
      } finally {
        if (!stopped) timer = setTimeout(() => void poll(), document.hidden ? 30000 : delay);
      }
    }
    timer = setTimeout(() => void poll(), 2000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [selectedId]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editor, setEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [scheduleNow, setScheduleNow] = useState(() => Date.now());
  useEffect(() => {
    if (!editor || draft.scheduleType !== "once") return;
    const timer = setInterval(() => setScheduleNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [editor, draft.scheduleType]);
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
    const frame = requestAnimationFrame(() => void refresh());
    return () => {
      cancelAnimationFrame(frame);
      listSequence.current++;
      detailSequence.current++;
    };
  }, [refresh]);
  function create() {
    setScheduleNow(Date.now());
    setEditingId(null);
    setDraft(blank);
    setStep(0);
    setEditor(true);
    setError(null);
  }
  function edit(task: Task) {
    setScheduleNow(Date.now());
    const date = task.runAt ? new Date(task.runAt) : null;
    setEditingId(task.id);
    setDraft({
      executionMode: task.executionMode ?? "text",
      workspaceAccess: task.workspaceAccess ?? "none",
      webAccess: task.webAccess ?? false,
      projectId: task.projectId ?? "",
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
        : Boolean(draft.date) && new Date(draft.date).getTime() > scheduleNow;
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
          executionMode: draft.executionMode,
          workspaceAccess: draft.workspaceAccess,
          webAccess: draft.webAccess,
          projectId: draft.projectId || null,
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
          ...(editingId ? {} : { enabled: false }),
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
      const next = await request<Task>(
        `/${taskId}/${selected.executionMode === "agent" ? "agent-test" : "preview"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providerId, model }),
        },
      );
      if (sequence === detailSequence.current) setSelected(next);
      if (selected.notify !== false)
        toast.success(
          uiT("ui.test_completed_value0", { value0: selected.title }),
        );
    } catch (cause) {
      if (sequence === detailSequence.current) {
        if (selected.notify !== false)
          toast.error(uiT("ui.test_failed_value0", { value0: selected.title }));
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
      <AlertTitle>{uiT("ui.the_operation_could_not_be_completed")}</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-5 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{uiT("ui.automations")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {uiT(
              "ui.organize_the_work_you_want_to_delegate_and_review_each_result",
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || busy}
            onClick={() => void refresh()}
          >
            {uiT("update.update")}
          </Button>
          <Button size="sm" onClick={create}>
            {uiT("ui.new_automation")}
          </Button>
        </div>
      </header>
      <Alert>
        <AlertTitle>{uiT("ui.runs_while_the_application_is_open")}</AlertTitle>
        <AlertDescription>
          {uiT(
            "ui.save_a_draft_choose_a_provider_and_model_and_confirm_activation_i",
          )}
        </AlertDescription>
      </Alert>
      {errorAlert}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all">{uiT("ui.all")}</TabsTrigger>
            <TabsTrigger value="enabled">
              {uiT("ui.enabled_automations")}
            </TabsTrigger>
            <TabsTrigger value="paused">{uiT("ui.drafts")}</TabsTrigger>
            <TabsTrigger value="attention">{uiT("ui.with_errors")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          aria-label={uiT("ui.search_automations")}
          placeholder={uiT("ui.search_automations_")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-xs"
        />
      </div>
      {loading ? (
        <div
          className="flex flex-col gap-3"
          role="status"
          aria-label={uiT("ui.loading_automations")}
        >
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : visible.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>
              {tasks.length
                ? uiT("ui.no_matches")
                : uiT("ui.your_first_automation")}
            </EmptyTitle>
            <EmptyDescription>
              {tasks.length
                ? uiT("ui.try_a_different_filter_or_search")
                : uiT(
                    "ui.set_instructions_and_a_schedule_it_will_be_saved_as_a_draft",
                  )}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={create}>
              {uiT("ui.create_draft")}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <section
          aria-label={uiT("ui.saved_automations")}
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
                      ? uiT("ui.once_value0", { value0: dateLabel(task.runAt) })
                      : task.scheduleType === "weekly"
                        ? weeklyLabel(task)
                        : uiT("ui.every_value0_min", {
                            value0: (task.intervalSeconds ?? 0) / 60,
                          })}
                  </p>
                </div>
                <Badge variant={task.lastError ? "destructive" : "secondary"}>
                  {task.lastError
                    ? uiT("ui.needs_attention_")
                    : task.enabled
                      ? uiT("ui.active_")
                      : uiT("ui.draft")}
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
            <SheetTitle>{selected?.title ?? uiT("ui.automation")}</SheetTitle>
            <SheetDescription>
              {uiT("ui.instructions_schedule_and_records_available")}
            </SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="flex flex-col gap-5 px-4 pb-6">
              {errorAlert}
              <section>
                <h2 className="text-sm font-medium">
                  {uiT("ui.instructions")}
                </h2>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                  {selected.prompt}
                </p>
              </section>
              <Separator />
              <p className="text-sm text-muted-foreground">
                {uiT("ui.next_run")} {dateLabel(selected.nextRunAt)}
                {uiT(
                  "ui.requires_the_backend_to_be_open_text_only_no_files_or_commands",
                )}
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
                  {uiT("chat.actions.edit")}
                </Button>
                {selected.enabled && (
                  <Button
                    variant="outline"
                    disabled={busy || detailLoading}
                    onClick={() => void pause(selected)}
                  >
                    {uiT("apiPage.pause")}
                  </Button>
                )}
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => setDeleting(selected)}
                >
                  {uiT("chat.menu.delete")}
                </Button>
              </div>
              <Separator />
              <FieldGroup>
                <Field data-disabled={busy}>
                  <FieldLabel htmlFor="preview-provider">
                    {uiT("ui.test_provider")}
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
                      <SelectValue
                        placeholder={uiT("ui.choose_api_provider")}
                      />
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
                    {uiT(
                      "ui.if_none_appear_configure_an_api_connection_in_settings",
                    )}
                  </FieldDescription>
                </Field>
                <Field data-disabled={busy || !provider}>
                  <FieldLabel htmlFor="preview-model">
                    {uiT("studio.progress.model")}
                  </FieldLabel>
                  <Select
                    value={model}
                    disabled={busy || !provider}
                    onValueChange={setModel}
                  >
                    <SelectTrigger id="preview-model">
                      <SelectValue placeholder={uiT("ui.choose_model")} />
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
                    {uiT(
                      selected.executionMode === "agent"
                        ? "ui.automation_agent_consent"
                        : "ui.sends_only_these_instructions_to_the_chosen_provider_and_may_incu",
                    )}
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
                  {busy
                    ? uiT("ui.processing")
                    : uiT(
                        selected.executionMode === "agent"
                          ? "ui.automation_agent_test"
                          : "ui.send_test_to_provider",
                      )}
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
                    {uiT("ui.activate_schedule")}
                  </Button>
                )}
              </FieldGroup>
              <Separator />
              <h2 className="text-sm font-medium">
                {uiT("studio.history.title")}
              </h2>
              {detailLoading ? (
                <Skeleton className="h-16" />
              ) : selected.runs?.length ? (
                selected.runs.map((run) => (
                  <section key={run.id} className="flex flex-col gap-2">
                    {run.deliveries?.map((delivery) => (
                      <p
                        key={delivery.event}
                        className="text-xs text-muted-foreground"
                      >
                        Telegram ·{" "}
                        {uiT(`ui.automation_delivery_${delivery.event}`)} ·{" "}
                        {uiT(`ui.automation_delivery_${delivery.status}`)}
                      </p>
                    ))}
                    {run.threadId && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="self-start"
                        onClick={() => {
                          setSelected(null);
                          void navigate({
                            to: "/chat",
                            search: {
                              thread: run.threadId!,
                              project: selected.projectId ?? undefined,
                            },
                          });
                        }}
                      >
                        {uiT("ui.open_chat")}
                      </Button>
                    )}
                    {run.status === "running" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="self-start"
                        onClick={() => {
                          void request(`/runs/${run.id}/cancel`, {
                            method: "POST",
                          })
                            .then(() => detail(selected))
                            .catch((cause) => setError(message(cause)));
                        }}
                      >
                        {uiT("ui.automation_cancel_run")}
                      </Button>
                    )}
                    <p className="text-sm">
                      {dateLabel(run.startedAt)} ·{" "}
                      {WORK_STATUS_LABELS[run.status as WorkStatus] ??
                        run.status}
                    </p>
                    <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {run.error || run.output || uiT("ui.no_recorded_result")}
                    </p>
                  </section>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  {uiT("ui.no_recorded_runs")}
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
              {editingId ? uiT("ui.edit_automation") : uiT("ui.new_automation")}
            </SheetTitle>
            <SheetDescription>
              {uiT("ui.step")} {step + 1} {uiT("ui.of_3")} {timezone}
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
            <p className="text-sm text-muted-foreground">
              {destination?.accountId
                ? uiT("ui.automation_channel_destination", {
                    bot: destination.botUsername || "Telegram",
                  })
                : uiT("ui.automation_channel_unavailable")}
            </p>
            <FieldGroup>
              {step === 0 && (
                <>
                  <Field>
                    <FieldLabel>{uiT("ui.project")}</FieldLabel>
                    <Select
                      value={draft.projectId || "none"}
                      onValueChange={(value) =>
                        setDraft({
                          ...draft,
                          projectId: value === "none" ? "" : value,
                          workspaceAccess: "none",
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="none">
                            {uiT("ui.no_project")}
                          </SelectItem>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      {uiT("ui.automation_project_scope")}
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel>
                      {uiT("ui.automation_execution_mode")}
                    </FieldLabel>
                    <Select
                      value={draft.executionMode}
                      onValueChange={(value) =>
                        setDraft({
                          ...draft,
                          executionMode: value as Draft["executionMode"],
                          workspaceAccess: "none",
                          webAccess: false,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="agent">
                            {uiT("ui.automation_agent_mode")}
                          </SelectItem>
                          <SelectItem value="text">
                            {uiT("ui.automation_text_mode")}
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      {uiT("ui.automation_capability_changes")}
                    </FieldDescription>
                  </Field>
                  {draft.executionMode === "agent" && (
                    <>
                      <Field>
                        <FieldLabel>
                          {uiT("ui.automation_folder_access")}
                        </FieldLabel>
                        <Select
                          disabled={!draft.projectId}
                          value={draft.workspaceAccess}
                          onValueChange={(value) =>
                            setDraft({
                              ...draft,
                              workspaceAccess:
                                value as Draft["workspaceAccess"],
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="none">
                                {uiT("ui.automation_no_files")}
                              </SelectItem>
                              <SelectItem value="read">
                                {uiT("ui.automation_read_files")}
                              </SelectItem>
                              <SelectItem value="write">
                                {uiT("ui.automation_create_files")}
                              </SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <FieldDescription>
                          {uiT("ui.automation_file_limits")}
                        </FieldDescription>
                      </Field>
                      <Field orientation="horizontal">
                        <FieldLabel htmlFor="automation-web">
                          {uiT("ui.automation_public_web")}
                        </FieldLabel>
                        <Switch
                          id="automation-web"
                          checked={draft.webAccess}
                          onCheckedChange={(webAccess) =>
                            setDraft({ ...draft, webAccess })
                          }
                        />
                      </Field>
                    </>
                  )}
                  <Field>
                    <FieldLabel htmlFor="task-title">
                      {uiT("projectsPage.colName")}
                    </FieldLabel>
                    <Input
                      id="task-title"
                      value={draft.title}
                      maxLength={300}
                      required
                      onChange={(event) =>
                        setDraft({ ...draft, title: event.target.value })
                      }
                      placeholder={uiT("ui.project_summary")}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="task-prompt">
                      {uiT("ui.what_should_the_agent_do")}
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
                      placeholder={uiT(
                        "ui.describe_the_goal_and_expected_result",
                      )}
                    />
                    <FieldDescription>
                      {uiT("ui.do_not_include_api_keys_or_passwords")}
                    </FieldDescription>
                  </Field>
                </>
              )}
              {step === 1 && (
                <>
                  <Field>
                    <FieldLabel>{uiT("ui.frequency")}</FieldLabel>
                    <Select
                      value={draft.scheduleType}
                      onValueChange={(value) =>
                        setDraft({
                          ...draft,
                          scheduleType: value as Draft["scheduleType"],
                        })
                      }
                    >
                      <SelectTrigger aria-label={uiT("ui.frequency")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="interval">
                            {uiT("ui.at_intervals")}
                          </SelectItem>
                          <SelectItem value="once">{uiT("ui.once")}</SelectItem>
                          <SelectItem value="weekly">
                            {uiT("ui.days_of_the_week")}
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  {draft.scheduleType === "interval" ? (
                    <Field data-invalid={!validSchedule}>
                      <FieldLabel htmlFor="task-minutes">
                        {uiT("ui.interval_in_minutes")}
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
                          {uiT("ui.run_days")}
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
                              aria-label={uiT(day)}
                            >
                              {uiT(day).slice(0, 3)}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                        {!draft.weekdays.length && (
                          <FieldDescription>
                            {uiT("ui.select_at_least_one_day")}
                          </FieldDescription>
                        )}
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="task-time">
                          {uiT("ui.time")}
                        </FieldLabel>
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
                          {uiT("ui.saved_time_zone")} {draft.timezone}
                          {uiT(
                            "ui.schedule_ready_runs_only_while_the_application_is_open",
                          )}
                        </FieldDescription>
                      </Field>
                    </>
                  ) : (
                    <Field data-invalid={!validSchedule}>
                      <FieldLabel htmlFor="task-date">
                        {uiT("ui.local_date_and_time")}
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
                        {uiT("ui.choose_a_future_date_time_zone")} {timezone}.
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
                      {uiT("ui.automation_notify_start_finish")}
                    </FieldLabel>
                  </Field>
                  <FieldDescription>
                    {uiT(
                      "ui.currently_notifies_when_a_manual_test_finishes_on_this_screen_sys",
                    )}
                  </FieldDescription>
                </>
              )}
              {step === 2 && (
                <>
                  <Field>
                    <FieldLabel>{uiT("ui.review_draft")}</FieldLabel>
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
                    <AlertTitle>{uiT("ui.will_be_saved_paused")}</AlertTitle>
                    <AlertDescription>
                      {uiT(
                        "ui.does_not_grant_folder_access_or_run_actions_project_provider_and_",
                      )}
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
                {step ? uiT("tour.back") : uiT("chat.workspace.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={busy || (step === 0 ? !validText : !validSchedule)}
              >
                {busy
                  ? uiT("ui.saving")
                  : step === 2
                    ? uiT("ui.save_draft")
                    : uiT("chat.actions.continue")}
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
            <AlertDialogTitle>
              {uiT("ui.activate_this_schedule")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {uiT("ui.authorizes_sending_the_saved_instructions_to")}{" "}
              {provider?.name} {uiT("ui.using")} {model}{" "}
              {uiT(
                "ui.on_each_scheduled_run_may_incur_costs_does_not_access_files_or_ru",
              )}{" "}
              {uiT(
                selected?.executionMode === "agent"
                  ? "ui.automation_agent_consent"
                  : "ui.automation_text_mode",
              )}
              {selected?.executionMode === "agent" && (
                <span className="block">
                  {uiT("ui.automation_folder_access")}:{" "}
                  {uiT(
                    selected.workspaceAccess === "write"
                      ? "ui.automation_create_files"
                      : selected.workspaceAccess === "read"
                        ? "ui.automation_read_files"
                        : "ui.automation_no_files",
                  )}{" "}
                  · {uiT("ui.automation_public_web")}:{" "}
                  {selected.webAccess
                    ? uiT("ui.active")
                    : uiT("ui.automation_no_files")}
                </span>
              )}
              {selected?.workspaceAccess &&
                selected.workspaceAccess !== "none" && (
                  <span className="block break-all">
                    {projects.find(
                      (project) => project.id === selected.projectId,
                    )?.connectedFolderPath ||
                      projects.find(
                        (project) => project.id === selected.projectId,
                      )?.sandboxPath}
                  </span>
                )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {errorAlert}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {uiT("chat.workspace.cancel")}
            </AlertDialogCancel>
            <Button disabled={busy} onClick={() => void activate()}>
              {busy ? uiT("ui.activating") : uiT("ui.confirm_activation")}
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
            <AlertDialogTitle>
              {uiT("ui.delete_this_automation")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {uiT("ui.this_will_delete")}
              {deleting?.title}
              {uiT("ui.and_its_history_your_project_files_will_not_be_deleted")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {errorAlert}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {uiT("chat.workspace.cancel")}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? uiT("ui.deleting") : uiT("chat.menu.delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
