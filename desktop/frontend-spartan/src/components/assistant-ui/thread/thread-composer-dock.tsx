/**
 * Sparta Agent - Dock Inferior del Composer (ThreadComposerDock)
 * Contenedor flotante fijado a la parte inferior del hilo con gradiente de desvanecimiento,
 * chip de audio pendiente, nota de descargo del modelo y reporte de altura al viewport.
 */

import {
  useEffect,
  useRef,
  type FC,
  type ReactNode,
} from "react";
import { HeadphonesIcon, XIcon } from "lucide-react";
import { useAuiState } from "@assistant-ui/react";
import { useGeneratedImageOverlay } from "@/components/assistant-ui/generated-image-overlay-context";
import { useChatPreferencesStore } from "@/features/chat/stores/chat-preferences-store";
import { useChatRuntimeStore } from "@/features/chat/stores/chat-runtime-store";
import { usePromptQueueUI } from "@/features/chat/stores/prompt-queue-ui-store";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { compactIds, findPromptQueueEntry } from "./prompt-queue-manager";

export const COMPOSER_SCROLL_GAP_PX = 24;
export const FOOTER_GAP_BELOW_SPACER_PX = 10;
export const RUN_SHRINK_WINDOW_MS = 1000;

export const PendingAudioChip: FC = () => {
  const audioName = useChatRuntimeStore((s) => s.pendingAudioName);
  const clearPendingAudio = useChatRuntimeStore((s) => s.clearPendingAudio);
  if (!audioName) {
    return null;
  }
  return (
    <div className="mb-2 flex w-full flex-row items-center gap-2 px-1.5 pt-0.5 pb-1">
      <div className="flex items-center gap-2 rounded-lg border border-foreground/20 bg-muted px-3 py-1.5 text-xs">
        <HeadphonesIcon className="size-3.5 text-muted-foreground" />
        <span className="max-w-48 truncate">{audioName}</span>
        <button
          type="button"
          onClick={clearPendingAudio}
          className="flex size-4 items-center justify-center rounded-full hover:bg-destructive hover:text-destructive-foreground"
          aria-label="Remove audio"
        >
          <XIcon className="size-3" />
        </button>
      </div>
    </div>
  );
};

export interface ThreadComposerDockProps {
  disabled?: boolean;
  threadId?: string | null;
  onHeightChange?: (height: number | null) => void;
  children?: ReactNode;
}

export const ThreadComposerDock: FC<ThreadComposerDockProps> = ({
  threadId,
  onHeightChange,
  children,
}) => {
  const { overlay } = useGeneratedImageOverlay();
  const activeThreadId = useChatRuntimeStore((s) => s.activeThreadId);
  const threadListItemId = useAuiState(
    ({ threadListItem }) => threadListItem.id,
  );
  const threadListItemRemoteId = useAuiState(
    ({ threadListItem }) => threadListItem.remoteId,
  );
  const promptQueueThreadIds = compactIds([
    threadListItemId,
    threadListItemRemoteId,
    threadId,
    activeThreadId,
  ]);
  const queueVisible = usePromptQueueUI((s) => {
    const entry = findPromptQueueEntry(s, promptQueueThreadIds);
    return Boolean(entry && s.items.some((item) => item.runId === entry.runId));
  });
  const t = useT();
  const showModelDisclaimer = useChatPreferencesStore(
    (s) => s.showModelDisclaimer,
  );

  const dockRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = dockRef.current;
    if (!el || !onHeightChange) return;
    const measure = () => onHeightChange(el.offsetHeight);
    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(el);
    return () => {
      resizeObserver.disconnect();
      onHeightChange(null);
    };
  }, [onHeightChange]);

  return (
    <div
      ref={dockRef}
      className={cn(
        "aui-thread-composer-dock pointer-events-none absolute bottom-0 left-0 right-0 md:right-[10px]",
        overlay ? "z-40" : "z-20",
      )}
    >
      <div
        aria-hidden={true}
        className={cn(
          "thread-bottom-fade absolute inset-x-0 bottom-0 bg-gradient-to-t from-background from-[calc(100%_-_28px)] to-[rgb(from_var(--background)_r_g_b/0)]",
          queueVisible
            ? "h-32 backdrop-blur-[1px] [mask-image:linear-gradient(to_top,black_0%,black_58%,transparent_100%)]"
            : "top-[10px]",
        )}
      />
      <div className="relative px-5 pb-2">
        <div className="pointer-events-auto mx-auto w-full max-w-(--thread-max-width)">
          {children}
        </div>
        {showModelDisclaimer && (
          <p className="composer-footer-note">
            {t("chat.composer.disclaimer")}
          </p>
        )}
      </div>
    </div>
  );
};
