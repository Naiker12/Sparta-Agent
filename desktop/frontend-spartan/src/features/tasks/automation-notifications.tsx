import { translate as uiTranslate } from "@/i18n";
import { useEffect } from "react";
import { authFetch } from "@/features/auth";
import { notifyNative } from "@/lib/native-notifications";
import { toast } from "@/lib/toast";
import { notifyChatHistoryUpdated } from "@/features/chat";
import { notificationLedger } from "./notification-ledger";
import { notificationPollDelay } from "./notification-poll-delay";
import { useNavigate } from "@tanstack/react-router";

/** Poll across all app routes, without exposing task prompts/results on the lock screen. */
export function AutomationNotifications() {
  const navigate = useNavigate();
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const startup = Date.now();
    let subject: string | null = null;
    let cursor = startup;
    let ledger: ReturnType<typeof notificationLedger> | null = null;
    let busy = false;
    let failures = 0;
    let delay = 2000;
    async function poll() {
      if (stopped || busy) return;
      busy = true;
      try {
        const response = await authFetch(
          `/api/tasks/notifications?since=${Math.max(0, cursor - 1)}`,
        );
        if (!response.ok) throw new Error(`Notifications: ${response.status}`);
        const data: {
          subject: string;
          active?: boolean;
          events: {
            id: string;
            status: string;
            finishedAt: number;
            notify: boolean;
            threadId?: string | null;
            projectId?: string | null;
          }[];
        } = await response.json();
        if (stopped) return;
        failures = 0;
        delay = notificationPollDelay(data.active, data.events.length, 0);
        if (subject !== data.subject) {
          subject = data.subject;
          ledger = notificationLedger(localStorage, subject, startup);
          cursor = ledger.cursor;
          delay = 2000;
          return;
        }
        for (const event of data.events) {
          if (stopped) return;
          if (!ledger?.consume(event.id, event.finishedAt)) continue;
          cursor = ledger.cursor;
          notifyChatHistoryUpdated();
          const openChat = () => {
            if (!event.threadId) return;
            void navigate({
              to: "/chat",
              search: { thread: event.threadId, project: event.projectId ?? undefined },
            });
          };
          // Open newly started research while the app is visible. Historical
          // notifications after reconnect must not repeatedly change the chat.
          if (event.threadId && event.status === "started" && !document.hidden &&
              event.finishedAt >= startup && Date.now() - event.finishedAt < 30000) {
            openChat();
          }
          if (event.notify) {
            const title =
              event.status === "started"
                ? uiTranslate("ui.automation_started")
                : event.status === "completed"
                ? uiTranslate("ui.automation_completed")
                : uiTranslate("ui.the_automation_needs_attention");
            toast(title, {
              action: event.threadId ? { label: uiTranslate("ui.open_chat"), onClick: openChat } : undefined,
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
      } catch {
        delay = notificationPollDelay(undefined, 0, ++failures);
      } finally {
        busy = false;
        if (!stopped) timer = setTimeout(() => void poll(), delay);
      }
    }
    const wake = () => {
      if (document.hidden || stopped || busy) return;
      clearTimeout(timer);
      void poll();
    };
    document.addEventListener("visibilitychange", wake);
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [navigate]);
  return null;
}
