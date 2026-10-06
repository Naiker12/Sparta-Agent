import { translate as uiTranslate } from "@/i18n";
import { useEffect } from "react";
import { listSavedPromptQueues, savePromptQueue } from "@/features/chat/api/prompt-queues-api";
import { AUTH_SESSION_CLEARED_EVENT, getAuthSessionEpoch } from "@/features/auth";
import type { QueuedChatRunSettings } from "@/features/chat/utils/queued-chat-run-settings";
import { toast } from "@/lib/toast";
import { findPromptQueueRunByThreadIds, restorePromptQueue } from "./prompt-queue-manager";
import type { PromptQueueTarget } from "./prompt-queue-types";

export function usePromptQueueRecovery(
  threadId: string | null,
  createTarget: (settings?: QueuedChatRunSettings) => Promise<PromptQueueTarget | null>,
): void {
  useEffect(() => {
    if (!threadId) return;
    let disposed = false;
    const toastIds: Array<string | number> = [];
    const epoch = getAuthSessionEpoch();
    const dismiss = () => {
      disposed = true;
      for (const id of toastIds) toast.dismiss(id);
    };
    window.addEventListener(AUTH_SESSION_CLEARED_EVENT, dismiss);
    void listSavedPromptQueues(threadId).then((queues) => {
      if (disposed || epoch !== getAuthSessionEpoch() || findPromptQueueRunByThreadIds([threadId])) return;
      for (const saved of queues) {
        const pending = saved.checkpoint.items.filter((item) => !item.dispatched);
        const interrupted = saved.checkpoint.items.some((item) => item.dispatched);
        const discard = () => {
          void savePromptQueue(saved.id, { ...saved.checkpoint, items: [] }, saved.revision, epoch)
            .catch(() => toast.error(uiTranslate("ui.could_not_discard_the_saved_queue")));
        };
        toastIds.push(toast.info(uiTranslate("ui.queue_saved_in_this_chat"), {
          duration: Infinity,
          description: interrupted
            ? `${pending.length} mensajes pendientes. Revisa la última respuesta: el mensaje enviado no se repetirá.`
            : `${pending.length} mensajes pendientes con su modelo y configuración originales.`,
          action: pending.length ? {
            get label() { return uiTranslate("ui.resume_pending_messages"); },
            onClick: () => {
              void (async () => {
                if (disposed || epoch !== getAuthSessionEpoch()) return;
                const targets = await Promise.all(pending.map((item) => createTarget(item.settings)));
                if (disposed || epoch !== getAuthSessionEpoch()) return;
                if (targets.some((target) => !target)) {
                  toast.error(uiTranslate("ui.reopen_this_chat_to_recover_its_pending_messages"));
                  return;
                }
                if (!restorePromptQueue(saved, targets as PromptQueueTarget[])) {
                  toast.error(uiTranslate("ui.this_chat_already_has_an_active_queue"));
                }
              })().catch(() => toast.error(uiTranslate("ui.could_not_recover_the_queue")));
            },
          } : undefined,
          cancel: { get label() { return uiTranslate("ui.dismiss"); }, onClick: discard },
        }));
      }
    }).catch(() => {
      if (!disposed && epoch === getAuthSessionEpoch()) {
        toast.error(uiTranslate("ui.could_not_check_the_saved_queue"), {
          get description() { return uiTranslate("ui.reopen_the_chat_when_the_server_is_available"); },
        });
      }
    });
    return () => {
      dismiss();
      window.removeEventListener(AUTH_SESSION_CLEARED_EVENT, dismiss);
    };
  }, [threadId, createTarget]);
}
