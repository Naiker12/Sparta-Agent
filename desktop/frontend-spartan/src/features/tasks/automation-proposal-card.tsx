import { lazy, Suspense, useState } from "react";
import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { CalendarClockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/i18n";
import {
  readAutomationProposal,
  type AutomationProposal,
} from "./automation-proposal";
const Editor = lazy(() =>
  import("./automations-page").then((module) => ({
    default: module.AutomationsPage,
  })),
);

export function AutomationSchedulingEditor({
  plan,
  onDismiss,
}: { plan: AutomationProposal; onDismiss: () => void }) {
  return (
    <Suspense fallback={<Spinner />}>
      <Editor initialProposal={plan} onDismiss={onDismiss} />
    </Suspense>
  );
}

export function AutomationProposalCard({ plan }: { plan: AutomationProposal }) {
  const t = useT();
  const [reviewing, setReviewing] = useState(false);
  const schedule =
    plan.scheduleType === "once" && plan.runAt
      ? new Date(plan.runAt).toLocaleString(undefined, {
          timeZone: plan.timezone,
        })
      : plan.scheduleType === "weekly"
        ? `${(plan.weekdays ?? []).map((day) => t((["ui.monday", "ui.tuesday", "ui.wednesday", "ui.thursday", "ui.friday", "ui.saturday", "ui.sunday"] as const)[day])).join(", ")} · ${plan.localTime}`
        : t("ui.automation_interval_seconds", {
            seconds: plan.intervalSeconds ?? 3600,
          });
  return (
    <section className="my-3 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CalendarClockIcon className="size-4" />
        {t("ui.automation_plan")}
      </div>
      <p className="mt-2 font-medium">{plan.title}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
        {plan.prompt}
      </p>
      <p className="mt-2 text-sm">
        {schedule} ·{" "}
        {plan.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {t("ui.automation_plan_requires_confirmation")}
      </p>
      <Button
        variant="outline"
        className="mt-3"
        onClick={() => setReviewing(true)}
      >
        {t("ui.automation_review_plan")}
      </Button>
      {reviewing && (
        <AutomationSchedulingEditor
          plan={plan}
          onDismiss={() => setReviewing(false)}
        />
      )}
    </section>
  );
}

export const AutomationProposalToolUI: ToolCallMessagePartComponent = ({
  result,
  status,
}) => {
  const t = useT();
  const plan = readAutomationProposal(result);
  if (status.type === "running")
    return (
      <p
        role="status"
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <Spinner className="size-4" />
        {t("ui.automation_preparing_plan")}
      </p>
    );
  return plan ? (
    <AutomationProposalCard plan={plan} />
  ) : (
    <p role="alert">{t("ui.automation_plan_invalid")}</p>
  );
};
