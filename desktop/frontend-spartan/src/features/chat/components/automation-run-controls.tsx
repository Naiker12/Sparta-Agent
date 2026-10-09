import { useEffect, useState } from "react";
import { authFetch } from "@/features/auth";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useT } from "@/i18n";
import { subscribeAutomationRun } from "@/features/tasks/automation-run-polling";

/** Background execution has its own cancellation, independent of chat generation. */
export function AutomationRunControls({
  threadId,
}: { threadId?: string | null }) {
  const t = useT();
  const [run, setRun] = useState<{ id: string; status: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    setRun(null);
    setError(false);
    if (!threadId?.startsWith("automation-")) return;
    return subscribeAutomationRun(threadId, (current) => {
      setRun((previous) => previous?.id === current.id && previous.status === current.status
        ? previous : { id: current.id, status: current.status });
    });
  }, [threadId]);
  if (!run || run.status !== "running") return null;
  async function cancel() {
    const runId = run!.id;
    setBusy(true);
    setError(false);
    try {
      const response = await authFetch(`/api/tasks/runs/${runId}/cancel`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Cancellation failed");
      setRun((current) =>
        current?.id === runId ? { ...current, status: "cancelled" } : current,
      );
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex shrink-0 flex-col gap-2 border-b px-4 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {t("ui.automation_started")}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void cancel()}
        >
          {t("ui.automation_cancel_run")}
        </Button>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {t("ui.the_operation_could_not_be_completed")}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
