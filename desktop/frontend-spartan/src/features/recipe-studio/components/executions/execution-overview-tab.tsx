import { useT as useUiT } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Database01Icon,
  Database02Icon,
  Flag02Icon,
  GithubIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactElement, RefObject, UIEvent } from "react";
import type { RecipeExecutionRecord } from "../../execution-types";
import { isExecutionInProgress } from "../../executions/execution-helpers";
import type { ModelUsageRow } from "./executions-view-helpers";
import { formatMetricValue } from "./executions-view-helpers";

function formatSourceResource(value: string | null | undefined): string {
  if (value === "pulls") {
    return "PRs";
  }
  return value ?? "--";
}

function formatSourceMessage(execution: RecipeExecutionRecord): string {
  const source = execution.source_progress;
  if (!source) {
    return "No source progress captured.";
  }
  if (source.status === "rate_limited") {
    const wait =
      typeof source.retry_after_sec === "number" && source.retry_after_sec > 0
        ? ` Waiting ~${formatMetricValue(source.retry_after_sec)}s.`
        : "";
    return `Waiting for GitHub rate limit. Unsloth will resume automatically.${wait}`;
  }
  return source.message ?? "Crawling GitHub source.";
}

type ExecutionOverviewTabProps = {
  execution: RecipeExecutionRecord;
  showSummaryCards: boolean;
  recordsMetric: number | null;
  totalMetric: number | null;
  runDuration: string;
  columnCount: number;
  llmColumnCount: number;
  nullRate: number | null;
  sideEffects: string[];
  lowUniquenessColumns: string[];
  modelUsageRows: ModelUsageRow[];
  terminalLines: string[];
  terminalRef: RefObject<HTMLDivElement | null>;
  onTerminalScroll: (event: UIEvent<HTMLDivElement>) => void;
  canPublish: boolean;
  onOpenPublish: () => void;
};

export function ExecutionOverviewTab({
  execution,
  showSummaryCards,
  recordsMetric,
  totalMetric,
  runDuration,
  columnCount,
  llmColumnCount,
  nullRate,
  sideEffects,
  lowUniquenessColumns,
  modelUsageRows,
  terminalLines,
  terminalRef,
  onTerminalScroll,
  canPublish,
  onOpenPublish,
}: ExecutionOverviewTabProps): ReactElement {
  const uiT = useUiT();

  const sourceProgress = execution.source_progress;

  return (
    <div className="mt-3 space-y-3">
      {showSummaryCards && (
        <div className="space-y-3">
          {canPublish && (
            <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/55 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{uiT("ui.next_step")}</p>
                <p className="text-xs text-muted-foreground">
                  {uiT("ui.this_run_is_complete_publish_the_generated_dataset_to_hugging_fac")}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenPublish}
              >
                {uiT("ui.publish_to_hugging_face")}</Button>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="h-full rounded-xl border border-border/60 bg-card/55 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{uiT("ui.run_summary")}</p>
                <HugeiconsIcon
                  icon={Database01Icon}
                  className="size-4 text-muted-foreground"
                />
              </div>
              <div className="space-y-1.5 text-xs">
                <p className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{uiT("ui.records")}</span>
                  <span className="font-semibold">
                    {formatMetricValue(recordsMetric)} /{" "}
                    {formatMetricValue(totalMetric)}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{uiT("apiPage.duration")}</span>
                  <span className="font-semibold">{runDuration}</span>
                </p>
                <p className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    {uiT("ui.columns_analyzed")}</span>
                  <span className="font-semibold">
                    {formatMetricValue(columnCount)}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{uiT("ui.final_stage")}</span>
                  <span className="truncate font-semibold">
                    {execution.stage ?? "--"}
                  </span>
                </p>
              </div>
            </div>
            <div className="h-full rounded-xl border border-border/60 bg-card/55 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{uiT("ui.insights")}</p>
                <HugeiconsIcon
                  icon={Database02Icon}
                  className="size-4 text-muted-foreground"
                />
              </div>
              <div className="space-y-1.5 text-xs">
                {llmColumnCount > 0 && (
                  <p className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{uiT("ui.llm_columns")}</span>
                    <span className="font-semibold">
                      {formatMetricValue(llmColumnCount)}
                    </span>
                  </p>
                )}
                <p className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{uiT("ui.null_rate")}</span>
                  <span className="font-semibold">
                    {nullRate?.toFixed(1) ?? "--"}%
                  </span>
                </p>
                <p className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    {uiT("ui.side_effect_columns")}</span>
                  <span className="font-semibold">
                    {formatMetricValue(sideEffects.length)}
                  </span>
                </p>
                {sideEffects.length > 0 && (
                  <div className="pt-0.5">
                    <div className="flex flex-wrap gap-1.5">
                      {sideEffects.map((name) => (
                        <Badge key={name} variant="outline">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <p className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    {uiT("ui.low_uniqueness_flags")}</span>
                  <span className="font-semibold">
                    {formatMetricValue(lowUniquenessColumns.length)}
                  </span>
                </p>
                {lowUniquenessColumns.length > 0 && (
                  <div className="pt-0.5">
                    <div className="flex flex-wrap gap-1.5">
                      {lowUniquenessColumns.slice(0, 3).map((name) => (
                        <Badge key={name} variant="outline">
                          {name}
                        </Badge>
                      ))}
                      {lowUniquenessColumns.length > 3 && (
                        <Badge variant="outline">
                          +{lowUniquenessColumns.length - 3} {" "}{uiT("ui.more")}</Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {(llmColumnCount > 0 || modelUsageRows.length > 0) && (
            <div className="rounded-xl border border-border/60 bg-card/55 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{uiT("ui.model_usage")}</p>
                <HugeiconsIcon
                  icon={Flag02Icon}
                  className="size-4 text-muted-foreground"
                />
              </div>
              {modelUsageRows.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {uiT("ui.no_model_usage_yet")}</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border/60 bg-card/50">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{uiT("studio.progress.model")}</TableHead>
                        <TableHead className="text-right">{uiT("ui.input")}</TableHead>
                        <TableHead className="text-right">{uiT("chat.timing.output")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modelUsageRows.map((usage) => (
                        <TableRow key={usage.model}>
                          <TableCell className="max-w-[320px] truncate">
                            {usage.model}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatMetricValue(usage.input)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatMetricValue(usage.output)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {sourceProgress?.source === "github" && (
        <div className="rounded-xl border border-border/60 bg-card/55 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{uiT("ui.source_data")}</p>
            <HugeiconsIcon
              icon={GithubIcon}
              className="size-4 text-muted-foreground"
            />
          </div>
          <p className="text-sm font-medium text-foreground">
            {sourceProgress.status === "completed"
              ? uiT("ui.github_source_complete")
              : uiT("ui.crawling_github_source")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatSourceMessage(execution)}
          </p>
          <div className="mt-2 grid gap-1.5 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <p className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{uiT("ui.repo")}</span>
              <span className="truncate font-semibold">
                {sourceProgress.repo ?? "--"}
              </span>
            </p>
            <p className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{uiT("ui.resource")}</span>
              <span className="font-semibold">
                {formatSourceResource(sourceProgress.resource)}
                {typeof sourceProgress.page === "number"
                  ? ` page ${sourceProgress.page}`
                  : ""}
              </span>
            </p>
            <p className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{uiT("ui.fetched")}</span>
              <span className="font-semibold">
                {formatMetricValue(sourceProgress.fetched_items)}
              </span>
            </p>
            <p className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{uiT("ui.rate_remaining")}</span>
              <span className="font-semibold">
                {formatMetricValue(sourceProgress.rate_remaining)}
              </span>
            </p>
          </div>
        </div>
      )}
      <div className="overflow-hidden rounded-xl corner-squircle border">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">{uiT("ui.terminal_output")}</p>
          <p className="text-xs text-muted-foreground">
            {terminalLines.length} {" "}{uiT("ui.lines")}</p>
        </div>
        <div
          ref={terminalRef}
          className="max-h-72 overflow-auto bg-zinc-900/80 px-3 py-2 font-mono text-xs text-zinc-200"
          onScroll={onTerminalScroll}
        >
          {terminalLines.length === 0 ? (
            <p className="text-zinc-400">
              {isExecutionInProgress(execution.status)
                ? uiT("ui.waiting_for_logs")
                : uiT("ui.no_logs_captured")}
            </p>
          ) : (
            terminalLines.map((line, index) => (
              <p
                key={`${index}-${line.slice(0, 24)}`}
                className="whitespace-pre-wrap break-words leading-relaxed"
              >
                {line}
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
