/**
 * Sparta Agent - Controles Derechos del Composer (ComposerRightControls)
 * Gestiona los botones de envío, dictado por voz, parada de generación,
 * control de cola de mensajes y selección de esfuerzo de pensamiento.
 */

import {
  useEffect,
  useRef,
  useState,
  type FC,
} from "react";
import { ArrowUpIcon, MicIcon, SquareIcon } from "lucide-react";
import {
  AuiIf,
  ComposerPrimitive,
  useAui,
} from "@assistant-ui/react";
import { toast } from "sonner";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  isStudioDictationAvailable,
  notifyStudioDictationUnavailable,
} from "@/features/chat";
import { cancelResearchRun } from "@/features/chat/api/research-api";
import { useChatRuntimeStore } from "@/features/chat/stores/chat-runtime-store";
import { usePromptQueueUI } from "@/features/chat/stores/prompt-queue-ui-store";
import {
  ingestResearchUpdate,
  useResearchRunStore,
} from "@/features/chat/stores/research-run-store";
import { useT } from "@/i18n";
import { findPromptQueueEntry } from "./prompt-queue-manager";
import { ReasoningToggle } from "./reasoning-toggle";

export interface ComposerRightControlsProps {
  disabled?: boolean;
  queueDisabled?: boolean;
  onQueueClick?: () => void;
  onSendClick?: (event: { preventDefault: () => void }) => void;
  onStopClick?: () => void;
  pendingSend?: boolean;
  menuSide?: "top" | "bottom";
  queueThreadIds: string[];
}

export const ComposerRightControls: FC<ComposerRightControlsProps> = ({
  disabled,
  queueDisabled,
  onQueueClick,
  onSendClick,
  onStopClick,
  pendingSend,
  menuSide,
  queueThreadIds,
}) => {
  const queueEntry = usePromptQueueUI((s) =>
    findPromptQueueEntry(s, queueThreadIds),
  );
  const isQueueRunning = Boolean(queueEntry);
  const activeThreadId = useChatRuntimeStore((state) => state.activeThreadId);
  const activeResearchRunId = useResearchRunStore((state) =>
    activeThreadId ? state.latestRunByThreadId[activeThreadId] : undefined,
  );
  const activeResearchRunStatus = useResearchRunStore((state) => {
    const runId = activeThreadId
      ? state.latestRunByThreadId[activeThreadId]
      : undefined;
    return runId ? state.sessions[runId]?.run.status : undefined;
  });
  const isResearchActive = Boolean(
    activeResearchRunStatus &&
      !["completed", "failed", "cancelled"].includes(activeResearchRunStatus),
  );
  const [stoppingResearchRunId, setStoppingResearchRunId] = useState<
    string | null
  >(null);
  const stoppingResearchRunIdRef = useRef<string | null>(null);
  const researchStopping = Boolean(
    activeResearchRunStatus &&
      (activeResearchRunStatus === "cancelling" ||
        (activeResearchRunId !== undefined &&
          stoppingResearchRunId === activeResearchRunId)),
  );

  useEffect(() => {
    if (
      !isResearchActive ||
      (stoppingResearchRunIdRef.current &&
        stoppingResearchRunIdRef.current !== activeResearchRunId)
    ) {
      stoppingResearchRunIdRef.current = null;
      setStoppingResearchRunId(null);
    }
  }, [activeResearchRunId, isResearchActive]);

  const stop = () => {
    if (isResearchActive && activeResearchRunId) {
      if (
        activeResearchRunStatus === "cancelling" ||
        stoppingResearchRunIdRef.current === activeResearchRunId
      ) {
        return;
      }
      if (isQueueRunning) onStopClick?.();
      stoppingResearchRunIdRef.current = activeResearchRunId;
      setStoppingResearchRunId(activeResearchRunId);
      void cancelResearchRun(activeResearchRunId)
        .then((run) => ingestResearchUpdate(run))
        .catch((error) => {
          stoppingResearchRunIdRef.current = null;
          setStoppingResearchRunId(null);
          toast.error("Could not stop research", {
            description: error instanceof Error ? error.message : undefined,
          });
        });
      return;
    }
    if (isQueueRunning) onStopClick?.();
  };

  const aui = useAui();
  const startDictation = () => {
    if (!isStudioDictationAvailable()) {
      notifyStudioDictationUnavailable();
      return;
    }
    try {
      aui.composer().startDictation();
    } catch {
      notifyStudioDictationUnavailable();
    }
  };

  const t = useT();

  return (
    <div className="aui-composer-action-wrapper flex shrink-0 items-center gap-1.5">
      <ReasoningToggle side={menuSide} />
      <ComposerPrimitive.If dictation={false}>
        <TooltipIconButton
          tooltip={t("chat.composer.dictate")}
          aria-label={t("chat.composer.dictate")}
          type="button"
          variant="ghost"
          className="size-7.5 rounded-full text-foreground"
          onClick={startDictation}
        >
          <MicIcon className="unsloth-dictate-icon size-[17px]" />
        </TooltipIconButton>
      </ComposerPrimitive.If>
      <AuiIf
        condition={({ thread }) =>
          !thread.isRunning && !isQueueRunning && !isResearchActive
        }
      >
        <ComposerPrimitive.Send asChild={true}>
          <TooltipIconButton
            tooltip={pendingSend ? t("chat.composer.waitingDocs") : t("chat.composer.sendMessage")}
            side="bottom"
            type="submit"
            variant="default"
            size="icon"
            disabled={disabled || pendingSend}
            onClick={(event) => onSendClick?.(event)}
            className="aui-composer-send ml-1 size-7.5 rounded-full"
            aria-label={t("chat.composer.sendMessage")}
          >
            {pendingSend ? (
              <Spinner className="size-3.5" />
            ) : (
              <ArrowUpIcon className="unsloth-send-icon aui-composer-send-icon size-4 stroke-2" />
            )}
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      </AuiIf>
      {isQueueRunning && !isResearchActive ? (
        <AuiIf condition={({ thread }) => !thread.isRunning}>
          {queueEntry?.dispatched ? (
            <Button
              type="button"
              variant="default"
              size="icon"
              className="aui-composer-cancel ml-1 size-7.5 rounded-full"
              aria-label={t("chat.composer.stopQueued")}
              onClick={stop}
            >
              <SquareIcon className="aui-composer-cancel-icon size-2.5 fill-current" />
            </Button>
          ) : (
            <TooltipIconButton
              tooltip={t("chat.composer.queueMessage")}
              side="bottom"
              type="button"
              variant="default"
              size="icon"
              disabled={disabled || queueDisabled}
              onClick={onQueueClick}
              className="aui-composer-send ml-1 size-7.5 rounded-full"
              aria-label={t("chat.composer.queueMessage")}
            >
              <ArrowUpIcon className="unsloth-send-icon aui-composer-send-icon size-4 stroke-2" />
            </TooltipIconButton>
          )}
        </AuiIf>
      ) : null}
      {isResearchActive ? (
        <Button
          type="button"
          variant="default"
          size="icon"
          className="aui-composer-cancel ml-1 size-7.5 rounded-full"
          aria-label={researchStopping ? t("chat.composer.stoppingResearch") : t("chat.composer.stopResearch")}
          disabled={researchStopping}
          onClick={stop}
        >
          {researchStopping ? (
            <Spinner className="size-3.5" />
          ) : (
            <SquareIcon className="aui-composer-cancel-icon size-2.5 fill-current" />
          )}
        </Button>
      ) : (
        <AuiIf condition={({ thread }) => thread.isRunning}>
          <div className="ml-1 flex items-center">
            {queueDisabled ? (
              <ComposerPrimitive.Cancel asChild={true}>
                <Button
                  type="button"
                  variant="default"
                  size="icon"
                  className="aui-composer-cancel size-7.5 rounded-full"
                  aria-label={t("chat.composer.stopGenerating")}
                  onClick={stop}
                >
                  <SquareIcon className="aui-composer-cancel-icon size-2.5 fill-current" />
                </Button>
              </ComposerPrimitive.Cancel>
            ) : (
              <TooltipIconButton
                tooltip={t("chat.composer.queueMessage")}
                side="bottom"
                type="button"
                variant="default"
                size="icon"
                disabled={queueDisabled}
                onClick={onQueueClick}
                className="aui-composer-send size-7.5 rounded-full"
                aria-label={t("chat.composer.queueMessage")}
              >
                <ArrowUpIcon className="unsloth-send-icon aui-composer-send-icon size-4 stroke-2" />
              </TooltipIconButton>
            )}
          </div>
        </AuiIf>
      )}
    </div>
  );
};
