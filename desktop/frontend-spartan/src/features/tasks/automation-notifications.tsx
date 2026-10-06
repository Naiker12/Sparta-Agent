import { translate as uiTranslate } from "@/i18n";
import { useEffect } from "react";
import { authFetch } from "@/features/auth";
import { notifyNative } from "@/lib/native-notifications";
import { toast } from "@/lib/toast";

/** Poll across all app routes, without exposing task prompts/results on the lock screen. */
export function AutomationNotifications() {
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const startup = Date.now();
    let subject: string | null = null;
    let cursor = startup;
    const seen = new Set<string>();
    async function poll() {
      try {
        const response = await authFetch(
          `/api/tasks/notifications?since=${Math.max(0, cursor - 1)}`,
        );
        if (!response.ok) return;
        const data: {
          subject: string;
          events: {
            id: string;
            status: string;
            finishedAt: number;
            notify: boolean;
          }[];
        } = await response.json();
        if (stopped) return;
        if (subject !== data.subject) {
          subject = data.subject;
          seen.clear();
          cursor =
            Number(
              localStorage.getItem(
                `sparta.automation-notifications.${subject}`,
              ),
            ) || startup;
          return;
        }
        for (const event of data.events) {
          if (seen.has(event.id)) continue;
          seen.add(event.id);
          if (event.notify) {
            const title =
              event.status === "completed"
                ? uiTranslate("ui.automation_completed")
                : uiTranslate("ui.the_automation_needs_attention");
            toast(title, {
              get description() {
                return uiTranslate("ui.view_the_result_in_automations");
              },
            });
            await notifyNative({
              key: `automation-${event.id}`,
              title,
              body: uiTranslate("ui.view_the_result_in_automations"),
              requestPermission: false,
            });
          }
          cursor = Math.max(cursor, event.finishedAt);
        }
        localStorage.setItem(
          `sparta.automation-notifications.${subject}`,
          String(cursor),
        );
      } catch {
        /* Retry on the next tick; notifications never block the application. */
      } finally {
        if (!stopped) timer = setTimeout(() => void poll(), 10000);
      }
    }
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);
  return null;
}
