/**
 * Sparta Agent - Hooks de Acciones de Mensajes (message-action-hooks)
 * Maneja operaciones sobre mensajes individuales: bifurcación (fork), conteo de ramas,
 * detección de deep research activo, accesibilidad de foco y exportación a markdown.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAui, useAuiState } from "@assistant-ui/react";
import { toast } from "sonner";
import { researchReplyOwners } from "@/components/assistant-ui/research-reply-owners";
import {
  settleThreadScopedSettingsForCopy,
  useChatRuntimeStore,
} from "@/features/chat/stores/chat-runtime-store";
import { forkChatThread } from "@/features/chat/api/chat-api";
import {
  forkCountFor,
  subscribeForkCounts,
} from "@/features/chat/utils/fork-count-store";
import { useResearchRunStore } from "@/features/chat/stores/research-run-store";
import { downloadFile, isDownloadCancelled } from "@/lib/native-files";

export const getResearchRunId = (metadata: unknown): string | null => {
  const custom = (
    metadata as
      | {
          custom?: {
            researchRunId?: unknown;
            researchRun?: { id?: unknown };
          };
        }
      | undefined
  )?.custom;
  const runId = custom?.researchRunId ?? custom?.researchRun?.id;
  return typeof runId === "string" ? runId : null;
};

export const useResearchMessageRunId = () => {
  return useAuiState(({ message }) => getResearchRunId(message.metadata));
};

export const hasResearchRunId = (metadata: unknown): boolean =>
  Boolean(getResearchRunId(metadata));

export const useOwnsResearchMessage = () => {
  const aui = useAui();
  const messageId = useAuiState(({ message }) => message.id);
  return useAuiState(({ thread }) => {
    if (thread.messages.length === 0) {
      return false;
    }
    return researchReplyOwners(
      thread.messages,
      () => aui.thread().export().messages,
      hasResearchRunId,
    ).has(messageId);
  });
};

export const useThreadResearchActive = (): boolean => {
  const activeThreadId = useChatRuntimeStore((s) => s.activeThreadId);
  return useResearchRunStore((state) => {
    const runId = activeThreadId
      ? state.latestRunByThreadId[activeThreadId]
      : undefined;
    const run = runId ? state.sessions[runId]?.run : undefined;
    return Boolean(
      run && !["completed", "failed", "cancelled"].includes(run.status),
    );
  });
};

export const useThreadForkCounts = (): void => {
  const remoteId =
    useAuiState(({ threadListItem }) => threadListItem.remoteId) ?? null;
  useEffect(() => {
    if (!remoteId) return;
    return subscribeForkCounts(remoteId, () => {});
  }, [remoteId]);
};

export const useForkMessageAction = () => {
  const aui = useAui();
  const navigate = useNavigate();
  const messageId = useAuiState(({ message }) => message.id);
  const isRunning = useAuiState(({ thread }) => thread.isRunning);
  const [pending, setPending] = useState(false);

  const handleFork = async () => {
    const remoteId = aui.threadListItem().getState().remoteId;
    if (!remoteId) {
      toast.error("Cannot fork an unsaved chat");
      return;
    }
    setPending(true);
    try {
      try {
        await settleThreadScopedSettingsForCopy(remoteId);
      } catch {
        toast.error("Could not fork this chat", {
          description:
            "Its settings could not be saved, so the fork would not match. Please retry.",
        });
        return;
      }
      const result = await forkChatThread(remoteId, {
        messageId,
        newThreadId: crypto.randomUUID(),
        createdAt: Date.now(),
      });
      useChatRuntimeStore.getState().setActiveThreadId(result.thread.id);
      navigate({
        to: "/chat",
        search: { thread: result.thread.id },
        replace: false,
      });
      if (result.containerSnapshotWarning) {
        toast.info("Fork created", {
          description: result.containerSnapshotWarning,
        });
      } else {
        toast.success("Fork created");
      }
    } catch (error) {
      console.error("Failed to fork", error);
      toast.error("Failed to fork", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setPending(false);
    }
  };

  return {
    forkMessage: handleFork,
    forkDisabled: isRunning || pending,
  };
};

export async function exportMessageMarkdown(content: string): Promise<void> {
  try {
    await downloadFile(content, `message-${Date.now()}.md`, "text/markdown");
  } catch (error) {
    if (!isDownloadCancelled(error)) {
      toast.error("Could not save Markdown export.", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export function useActionBarFocusReveal() {
  const aui = useAui();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const focusWithinRef = useRef(false);
  const clearFrameRef = useRef<number | null>(null);

  const openPopupTrigger = useCallback(
    () =>
      rootRef.current?.querySelector(
        '.aui-assistant-action-bar-root [aria-expanded="true"]',
      ) ?? null,
    [],
  );

  const isEngaged = useCallback(() => {
    const el = rootRef.current;
    if (!el) return false;
    const active = document.activeElement;
    if (active && el.contains(active)) return true;
    return openPopupTrigger() !== null;
  }, [openPopupTrigger]);

  const cancelPendingClear = useCallback(() => {
    if (clearFrameRef.current !== null) {
      cancelAnimationFrame(clearFrameRef.current);
      clearFrameRef.current = null;
    }
  }, []);

  const scheduleClear = useCallback(
    (restart: boolean) => {
      if (clearFrameRef.current !== null) {
        if (!restart) return;
        cancelAnimationFrame(clearFrameRef.current);
      }
      const decide = () => {
        clearFrameRef.current = null;
        const el = rootRef.current;
        if (!el || !focusWithinRef.current) return;
        const active = document.activeElement;
        if (active && el.contains(active)) return;
        if (openPopupTrigger()) {
          clearFrameRef.current = requestAnimationFrame(decide);
          return;
        }
        focusWithinRef.current = false;
        if (!el.matches(":hover")) {
          aui.message().setIsHovering(false);
        }
      };
      clearFrameRef.current = requestAnimationFrame(decide);
    },
    [aui, openPopupTrigger],
  );

  const handleFocus = useCallback(
    (event: ReactFocusEvent<HTMLDivElement>) => {
      const el = rootRef.current;
      const target = event.target as Node | null;
      if (el && target && !el.contains(target)) {
        scheduleClear(false);
        return;
      }
      cancelPendingClear();
      if (focusWithinRef.current) return;
      focusWithinRef.current = true;
      aui.message().setIsHovering(true);
    },
    [aui, cancelPendingClear, scheduleClear],
  );

  const handleBlur = useCallback(() => {
    if (!focusWithinRef.current) return;
    scheduleClear(true);
  }, [scheduleClear]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const reassert = () => {
      if (focusWithinRef.current && isEngaged()) {
        aui.message().setIsHovering(true);
      }
    };
    el.addEventListener("mouseleave", reassert);
    return () => {
      el.removeEventListener("mouseleave", reassert);
      cancelPendingClear();
    };
  }, [aui, isEngaged, cancelPendingClear]);

  return { ref: rootRef, onFocus: handleFocus, onBlur: handleBlur };
}
