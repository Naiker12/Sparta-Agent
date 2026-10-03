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
            .catch(() => toast.error("No se pudo descartar la cola guardada"));
        };
        toastIds.push(toast.info("Cola guardada en este chat", {
          duration: Infinity,
          description: interrupted
            ? `${pending.length} mensajes pendientes. Revisa la última respuesta: el mensaje enviado no se repetirá.`
            : `${pending.length} mensajes pendientes con su modelo y configuración originales.`,
          action: pending.length ? {
            label: "Retomar pendientes",
            onClick: () => {
              void (async () => {
                if (disposed || epoch !== getAuthSessionEpoch()) return;
                const targets = await Promise.all(pending.map((item) => createTarget(item.settings)));
                if (disposed || epoch !== getAuthSessionEpoch()) return;
                if (targets.some((target) => !target)) {
                  toast.error("Vuelve a abrir este chat para recuperar sus pendientes");
                  return;
                }
                if (!restorePromptQueue(saved, targets as PromptQueueTarget[])) {
                  toast.error("Este chat ya tiene una cola activa");
                }
              })().catch(() => toast.error("No se pudo recuperar la cola"));
            },
          } : undefined,
          cancel: { label: "Descartar", onClick: discard },
        }));
      }
    }).catch(() => {
      if (!disposed && epoch === getAuthSessionEpoch()) {
        toast.error("No se pudo comprobar la cola guardada", {
          description: "Vuelve a abrir el chat cuando el servidor esté disponible.",
        });
      }
    });
    return () => {
      dismiss();
      window.removeEventListener(AUTH_SESSION_CLEARED_EVENT, dismiss);
    };
  }, [threadId, createTarget]);
}
