export type AutomationProposal = {
  title: string;
  prompt: string;
  scheduleType?: "interval" | "once" | "weekly";
  intervalSeconds?: number | null;
  runAt?: number | null;
  weekdays?: number[];
  localTime?: string;
  timezone?: string;
  webAccess?: boolean;
  notify?: boolean;
};
export function readAutomationProposal(
  result: unknown,
): AutomationProposal | null {
  try {
    const value = typeof result === "string" ? JSON.parse(result) : result;
    if (!value || typeof value !== "object") return null;
    const envelope = value as { kind?: string; plan?: AutomationProposal };
    if (
      envelope.kind !== "automation_proposal" ||
      typeof envelope.plan?.title !== "string" ||
      typeof envelope.plan?.prompt !== "string"
    )
      return null;
    const plan = envelope.plan;
    if (
      plan.scheduleType !== undefined &&
      !["interval", "once", "weekly"].includes(plan.scheduleType)
    )
      return null;
    if (
      plan.weekdays !== undefined &&
      (!Array.isArray(plan.weekdays) ||
        plan.weekdays.some(
          (day) => !Number.isInteger(day) || day < 0 || day > 6,
        ))
    )
      return null;
    if (
      plan.intervalSeconds != null &&
      (!Number.isFinite(plan.intervalSeconds) || plan.intervalSeconds < 60)
    )
      return null;
    if (plan.runAt != null && (!Number.isFinite(plan.runAt) || plan.runAt <= 0))
      return null;
    if (
      plan.localTime !== undefined &&
      (typeof plan.localTime !== "string" ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(plan.localTime))
    )
      return null;
    if (plan.timezone !== undefined) {
      if (typeof plan.timezone !== "string") return null;
      new Intl.DateTimeFormat("en", { timeZone: plan.timezone });
    }
    return {
      title: plan.title,
      prompt: plan.prompt,
      scheduleType: plan.scheduleType,
      intervalSeconds: plan.intervalSeconds,
      runAt: plan.runAt,
      weekdays: plan.weekdays,
      localTime: plan.localTime,
      timezone: plan.timezone,
      webAccess: plan.webAccess === true,
      notify: plan.notify !== false,
    };
  } catch {
    return null;
  }
}
