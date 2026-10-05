import { translate as uiTranslate } from "@/i18n";
import type { WorkRun, WorkStatus } from "./types";

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  get queued() {
    return uiTranslate("ui.queued");
  },
  get running() {
    return uiTranslate("apiPage.filterInFlight");
  },
  get paused() {
    return uiTranslate("ui.paused");
  },
  get completed() {
    return uiTranslate("ui.completed");
  },
  get failed() {
    return uiTranslate("ui.failed_");
  },
  get cancelled() {
    return uiTranslate("ui.cancelled");
  },
  get needs_review() {
    return uiTranslate("ui.needs_review");
  },
};

export type WorkFilter = "all" | "pending" | "active" | "review" | "finished";
export const WORK_FILTERS: Array<{ value: WorkFilter; label: string }> = [
  {
    value: "all",
    get label() {
      return uiTranslate("studio.charts.all");
    },
  },
  {
    value: "pending",
    get label() {
      return uiTranslate("ui.pending");
    },
  },
  {
    value: "active",
    get label() {
      return uiTranslate("apiPage.filterInFlight");
    },
  },
  {
    value: "review",
    get label() {
      return uiTranslate("ui.needs_review");
    },
  },
  {
    value: "finished",
    get label() {
      return uiTranslate("ui.completed");
    },
  },
];

export function workTitle(run: WorkRun): string {
  return (
    run.request.promptPreview ||
    run.request.prompt ||
    uiTranslate("ui.work_request")
  );
}

export function visibleWork(
  runs: WorkRun[],
  filter: WorkFilter,
  query: string,
): WorkRun[] {
  const needle = query.trim().toLocaleLowerCase();
  return runs.filter((run) => {
    const matches =
      filter === "all" ||
      (filter === "pending" &&
        (run.status === "queued" || run.status === "paused")) ||
      (filter === "active" && run.status === "running") ||
      (filter === "review" &&
        (run.status === "needs_review" || run.status === "failed")) ||
      (filter === "finished" &&
        (run.status === "completed" || run.status === "cancelled"));
    return (
      matches &&
      (!needle ||
        [
          workTitle(run),
          run.thread_title,
          run.project_name,
          run.result?.summary,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase()
          .includes(needle))
    );
  });
}

export function workExplanation(run: WorkRun): string {
  if (run.source_kind === "manual" && run.status === "queued")
    return uiTranslate("ui.request_saved_no_executor_is_connected_yet");
  if (run.status === "needs_review")
    return uiTranslate(
      "ui.a_complete_response_has_not_been_confirmed_review_the_chat_before",
    );
  if (run.status === "failed")
    return uiTranslate(
      "ui.the_response_ended_with_an_error_partial_content_remains_in_the_c",
    );
  if (run.status === "cancelled")
    return uiTranslate(
      "ui.the_message_was_discarded_before_sending_or_the_chat_confirmed_ca",
    );
  if (run.status === "running")
    return uiTranslate(
      "ui.the_send_is_recorded_and_the_application_is_still_reporting_its_s",
    );
  if (run.status === "queued")
    return uiTranslate(
      "ui.this_message_is_waiting_its_turn_resume_it_from_the_corresponding",
    );
  if (run.status === "paused") return uiTranslate("ui.the_request_is_paused");
  if (run.source_kind === "manual")
    return uiTranslate("ui.the_executor_recorded_completion_of_this_request");
  return uiTranslate(
    "ui.the_chat_runtime_recorded_a_complete_response_open_the_chat_to_re",
  );
}
