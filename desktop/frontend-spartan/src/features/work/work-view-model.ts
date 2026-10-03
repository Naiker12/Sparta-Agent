import type { WorkRun, WorkStatus } from "./types";

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  queued: "Pendiente", running: "En curso", paused: "Pausada", completed: "Completada",
  failed: "Con error", cancelled: "Cancelada", needs_review: "Requiere revisión",
};

export type WorkFilter = "all" | "pending" | "active" | "review" | "finished";
export const WORK_FILTERS: Array<{ value: WorkFilter; label: string }> = [
  { value: "all", label: "Todo" }, { value: "pending", label: "Pendientes" },
  { value: "active", label: "En curso" }, { value: "review", label: "Por revisar" },
  { value: "finished", label: "Finalizados" },
];

export function workTitle(run: WorkRun): string {
  return run.request.promptPreview || run.request.prompt || "Solicitud de trabajo";
}

export function visibleWork(runs: WorkRun[], filter: WorkFilter, query: string): WorkRun[] {
  const needle = query.trim().toLocaleLowerCase();
  return runs.filter((run) => {
    const matches = filter === "all" ||
      filter === "pending" && (run.status === "queued" || run.status === "paused") ||
      filter === "active" && run.status === "running" ||
      filter === "review" && (run.status === "needs_review" || run.status === "failed") ||
      filter === "finished" && (run.status === "completed" || run.status === "cancelled");
    return matches && (!needle || [workTitle(run), run.thread_title, run.project_name, run.result?.summary]
      .filter(Boolean).join(" ").toLocaleLowerCase().includes(needle));
  });
}

export function workExplanation(run: WorkRun): string {
  if (run.source_kind === "manual" && run.status === "queued") return "Solicitud guardada. Todavía no tiene un ejecutor conectado.";
  if (run.status === "needs_review") return "No hay confirmación de una respuesta completa. Revisa el chat antes de continuar.";
  if (run.status === "failed") return "La respuesta terminó con un error. El contenido parcial permanece en el chat.";
  if (run.status === "cancelled") return "El mensaje fue descartado antes del envío o el chat confirmó su cancelación.";
  if (run.status === "running") return "El envío está registrado y la aplicación sigue comunicando su estado.";
  if (run.status === "queued") return "Este mensaje espera su turno. Puedes retomarlo desde el chat correspondiente.";
  if (run.status === "paused") return "La solicitud está pausada.";
  if (run.source_kind === "manual") return "El ejecutor registró la finalización de esta solicitud.";
  return "El runtime del chat registró una respuesta completa. Abre el chat para revisar el resultado.";
}
