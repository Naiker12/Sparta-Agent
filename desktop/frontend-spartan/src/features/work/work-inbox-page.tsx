import { useT as useUiT } from "@/i18n";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { useWorkOverview } from "./hooks/use-work-overview";
import {
  WORK_FILTERS,
  WORK_STATUS_LABELS,
  visibleWork,
  workExplanation,
  workTitle,
  type WorkFilter,
} from "./work-view-model";

export function WorkInboxPage() {
  const uiT = useUiT();

  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<WorkFilter>("all");
  const [query, setQuery] = useState("");
  const { runs, hasMore, loading, error, refresh } = useWorkOverview(offset);
  const visible = visibleWork(runs, filter, query);
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-5 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{uiT("ui.work_inbox")}</h1>
          <p className="text-muted-foreground">
            {uiT("ui.pending_messages_responses_and_work_that_needs_review")}
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          {uiT("update.update")}
        </Button>
      </header>
      <label className="flex flex-col gap-2 text-sm">
        {uiT("ui.search_this_page")}
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={uiT("ui.message_chat_project_or_result")}
        />
      </label>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={uiT("ui.filter_work")}
      >
        {WORK_FILTERS.map((option) => (
          <Button
            key={option.value}
            variant={filter === option.value ? "default" : "outline"}
            aria-pressed={filter === option.value}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {error && (
        <div role="alert" className="rounded-lg border p-4 text-destructive">
          {error}
          <Button variant="ghost" onClick={refresh}>
            {uiT("update.tryAgain")}
          </Button>
        </div>
      )}
      {loading ? (
        <p role="status">{uiT("ui.checking_work")}</p>
      ) : visible.length === 0 ? (
        <section className="rounded-xl border border-dashed p-8 text-center">
          <h2 className="font-semibold">
            {runs.length
              ? uiT("ui.no_matches_found")
              : uiT("ui.no_recorded_work_yet")}
          </h2>
          <p className="text-muted-foreground">
            {runs.length
              ? uiT("ui.try_a_different_filter_or_search_term")
              : uiT(
                  "ui.queued_messages_will_appear_here_when_you_save_them_from_a_chat",
                )}
          </p>
        </section>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map((run) => (
            <Card key={run.id}>
              <CardHeader>
                {run.source_kind === "telegram" && (
                  <Badge variant="secondary">Telegram</Badge>
                )}
                <CardTitle className="break-words text-base">
                  {workTitle(run)}
                </CardTitle>
                <CardDescription>
                  {run.source_kind === "telegram"
                    ? run.request.channelName
                    : `${run.project_name || uiT("ui.no_project")} · ${run.thread_title || uiT("ui.standalone_request")}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm font-medium">
                  {WORK_STATUS_LABELS[run.status]}
                </p>
                <p className="text-sm text-muted-foreground">
                  {workExplanation(run)}
                </p>
                {run.result?.summary && (
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {run.result.summary}
                  </p>
                )}
              </CardContent>
              <CardFooter className="flex flex-wrap justify-between gap-3">
                <time
                  className="text-xs text-muted-foreground"
                  dateTime={new Date(run.updated_at).toISOString()}
                >
                  {new Date(run.updated_at).toLocaleString()}
                </time>
                {run.source_thread_id && (
                  <Button variant="outline" asChild>
                    <Link to="/chat" search={{ thread: run.source_thread_id }}>
                      {uiT("ui.open_chat")}
                    </Link>
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
      <nav
        className="flex items-center justify-between"
        aria-label={uiT("ui.work_pages")}
      >
        <Button
          variant="outline"
          disabled={loading || offset === 0}
          onClick={() => setOffset(Math.max(0, offset - 100))}
        >
          {uiT("chat.actions.previousBranch")}
        </Button>
        <span className="text-sm text-muted-foreground">
          {uiT("ui.page")} {offset / 100 + 1}{" "}
          {uiT("ui.filters_apply_to_this_page")}
        </span>
        <Button
          variant="outline"
          disabled={loading || !hasMore}
          onClick={() => setOffset(offset + 100)}
        >
          {uiT("tour.next")}
        </Button>
      </nav>
    </main>
  );
}
