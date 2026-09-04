/**
 * Sparta Agent - Barras de Acción y Bifurcación de Mensajes (assistant-action-bar)
 * Componentes de acciones flotantes para mensajes de usuario y asistente:
 * copiar, editar, bifurcar (fork), reintentar, síntesis de voz (TTS) y selector de ramas.
 */

import {
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
  type FC,
} from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  GitBranchIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";
import {
  BookOpen01Icon,
  Copy01Icon,
  Delete02Icon,
  Download01Icon,
  Edit03Icon,
  HelpCircleIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ActionBarMorePrimitive,
  ActionBarPrimitive,
  BranchPickerPrimitive,
  MessagePrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react";
import { toast } from "sonner";
import { attachmentsPastedText } from "@/features/chat/utils/pasted-text";
import { MessageResponseDetailsSheet } from "@/components/assistant-ui/message-response-details-sheet";
import { MessageTiming } from "@/components/assistant-ui/message-timing";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { replySourceMarkdown } from "@/features/chat/utils/reply-source-markdown";
import { saveMarkdownAsProjectSource } from "@/features/rag";
import { toolResultModelText } from "@/features/chat/api/chat-adapter";
import { getStoredChatThread } from "@/features/chat/utils/chat-history-storage";
import { useChatRuntimeStore } from "@/features/chat/stores/chat-runtime-store";
import { deleteThreadMessage } from "@/features/chat/utils/delete-thread-message";
import {
  forkCountFor,
  subscribeForkCounts,
} from "@/features/chat/utils/fork-count-store";
import { useVoiceSettingsStore } from "@/features/settings/stores/voice-settings-store";
import { copyToClipboard } from "@/lib/copy-to-clipboard";
import { cn } from "@/lib/utils";
import {
  exportMessageMarkdown,
  useForkMessageAction,
  useOwnsResearchMessage,
  useResearchMessageRunId,
  useThreadResearchActive,
} from "./message-action-hooks";

export const COPY_RESET_MS = 2000;

export const ForkCountBadge: FC = () => {
  const remoteId =
    useAuiState(({ threadListItem }) => threadListItem.remoteId) ?? null;
  const messageId = useAuiState(({ message }) => message.id);
  const subscribe = useCallback(
    (onChange: () => void) =>
      remoteId ? subscribeForkCounts(remoteId, onChange) : () => {},
    [remoteId],
  );
  const getSnapshot = useCallback(
    () => (remoteId ? forkCountFor(remoteId, messageId) : 0),
    [remoteId, messageId],
  );
  const count = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  if (count <= 0) return null;
  return (
    <span
      className="mx-1 inline-flex items-center gap-1 rounded-sm bg-primary/10 px-1.5 py-0.5 text-ui-10 font-medium text-primary"
      title={`${count} fork${count === 1 ? "" : "s"} from this message`}
    >
      <GitBranchIcon strokeWidth={1.75} className="size-3" />
      {count}
    </span>
  );
};

export const ForkMessageButton: FC = () => {
  const { forkMessage, forkDisabled } = useForkMessageAction();

  return (
    <TooltipIconButton
      tooltip="Fork from here"
      disabled={forkDisabled}
      onClick={forkMessage}
    >
      <GitBranchIcon strokeWidth={1.75} className="size-icon" />
    </TooltipIconButton>
  );
};

export const DeleteMessageButton: FC = () => {
  const aui = useAui();
  const messageId = useAuiState(({ message }) => message.id);
  const isRunning = useAuiState(({ thread }) => thread.isRunning);
  const researchRunId = useResearchMessageRunId();
  const ownsResearchMessage = useOwnsResearchMessage();

  const handleDelete = async () => {
    const thread = aui.thread();
    const speakingId = thread.getState().speech?.messageId;
    if (speakingId) {
      const { messages } = thread.export();
      const target = messages.find(({ message }) => message.id === messageId);
      const removed = new Set<string>([messageId]);
      if (target?.message.role === "user") {
        for (const { parentId, message } of messages) {
          if (parentId === messageId && message.role === "assistant") {
            removed.add(message.id);
          }
        }
      }
      if (removed.has(speakingId)) {
        try {
          thread.stopSpeaking();
        } catch {}
      }
    }

    const remoteId = aui.threadListItem().getState().remoteId;
    try {
      await deleteThreadMessage({
        thread: {
          export: () => thread.export(),
          import: (data) => thread.import(data),
        },
        messageId,
        remoteId,
      });
    } catch (error) {
      console.error("Failed to delete message", error);
      toast.error("Failed to delete message");
    }
  };

  if (researchRunId || ownsResearchMessage) {
    return null;
  }

  return (
    <TooltipIconButton
      tooltip="Delete message"
      disabled={isRunning}
      onClick={handleDelete}
      className="text-chat-icon-fg hover:text-destructive"
    >
      <HugeiconsIcon
        icon={Delete02Icon}
        strokeWidth={1.75}
        className="size-icon"
      />
    </TooltipIconButton>
  );
};

export const CopyButton: FC = () => {
  const aui = useAui();
  const [copied, setCopied] = useState(false);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = async () => {
    const pasted = attachmentsPastedText(aui.message().getState().attachments);
    const text = [aui.message().getCopyText(), pasted]
      .filter((part) => part.length > 0)
      .join("\n\n");
    if (await copyToClipboard(text)) {
      setCopied(true);
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
      resetTimeoutRef.current = setTimeout(() => {
        setCopied(false);
        resetTimeoutRef.current = null;
      }, COPY_RESET_MS);
    }
  };

  return (
    <TooltipIconButton tooltip="Copy" onClick={handleCopy}>
      <HugeiconsIcon
        icon={copied ? Tick02Icon : Copy01Icon}
        strokeWidth={1.75}
        className="size-icon"
      />
    </TooltipIconButton>
  );
};

export const EditAssistantMessageButton: FC = () => {
  const messageId = useAuiState(({ message }) => message.id);
  const researchRunId = useResearchMessageRunId();
  const isRunning = useAuiState(({ thread }) => thread.isRunning);
  const researchActive = useThreadResearchActive();
  const setEditingId = useChatRuntimeStore((s) => s.setEditingMessageId);

  if (researchRunId) return null;

  return (
    <TooltipIconButton
      tooltip="Edit response"
      disabled={isRunning || researchActive}
      onClick={() => setEditingId(messageId)}
    >
      <HugeiconsIcon
        icon={Edit03Icon}
        strokeWidth={1.75}
        className="size-icon"
      />
    </TooltipIconButton>
  );
};

export const AssistantActionBar: FC = () => {
  const aui = useAui();
  const { forkMessage, forkDisabled } = useForkMessageAction();
  const researchRunId = useResearchMessageRunId();
  const researchActive = useThreadResearchActive();
  const activeProjectId = useChatRuntimeStore((s) => s.activeProjectId);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const ttsEnabled = useVoiceSettingsStore((s) => s.ttsEnabled);
  const speaking = useAuiState(({ message }) => message.speech != null);

  return (
    <>
      <ActionBarPrimitive.Root
        hideWhenRunning={!speaking}
        autohide={speaking ? "never" : "not-last"}
        className="aui-assistant-action-bar-root col-start-3 row-start-2 flex items-center gap-1 text-chat-icon-fg [&_button:not([data-slot=message-timing-trigger])]:size-8 [&_button]:!rounded-full [&_button:hover]:bg-chat-icon-bg-hover [&_button:hover]:text-chat-icon-fg-hover"
      >
        <CopyButton />
        <EditAssistantMessageButton />
        {!researchRunId && !researchActive && (
          <ActionBarPrimitive.Reload asChild={true}>
            <TooltipIconButton tooltip="Refresh">
              <RefreshCwIcon strokeWidth={1.75} className="size-icon" />
            </TooltipIconButton>
          </ActionBarPrimitive.Reload>
        )}
        <ForkCountBadge />
        <DeleteMessageButton />
        {ttsEnabled && (
          <MessagePrimitive.If speaking={false}>
            <ActionBarPrimitive.Speak asChild={true}>
              <TooltipIconButton tooltip="Read aloud" aria-label="Read aloud">
                <Volume2Icon strokeWidth={1.75} className="size-icon" />
              </TooltipIconButton>
            </ActionBarPrimitive.Speak>
          </MessagePrimitive.If>
        )}
        <MessagePrimitive.If speaking={true}>
          <ActionBarPrimitive.StopSpeaking asChild={true}>
            <TooltipIconButton
              tooltip="Stop reading"
              aria-label="Stop reading"
              className="text-destructive"
            >
              <VolumeXIcon strokeWidth={1.75} className="size-icon" />
            </TooltipIconButton>
          </ActionBarPrimitive.StopSpeaking>
        </MessagePrimitive.If>
        <ActionBarMorePrimitive.Root modal={false}>
          <ActionBarMorePrimitive.Trigger asChild={true}>
            <TooltipIconButton
              tooltip="More"
              className="data-[state=open]:bg-accent"
            >
              <MoreHorizontalIcon strokeWidth={1.75} className="size-icon" />
            </TooltipIconButton>
          </ActionBarMorePrimitive.Trigger>
          <ActionBarMorePrimitive.Content
            side="bottom"
            align="start"
            onCloseAutoFocus={(e) => e.preventDefault()}
            className="aui-action-bar-more-content z-50 min-w-32 overflow-hidden rounded-[21px] bg-popover px-[9px] py-2 text-popover-foreground shadow-[0_2px_8px_-2px_rgba(0,0,0,0.16)] dark:shadow-none"
          >
            <ActionBarMorePrimitive.Item
              disabled={forkDisabled}
              onSelect={() => void forkMessage()}
              className="aui-action-bar-more-item flex cursor-pointer select-none items-center gap-2 rounded-[12px] px-3 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
            >
              <GitBranchIcon strokeWidth={1.75} className="size-icon" />
              Fork in new chat
            </ActionBarMorePrimitive.Item>
            <ActionBarPrimitive.ExportMarkdown
              asChild={true}
              onExport={exportMessageMarkdown}
            >
              <ActionBarMorePrimitive.Item className="aui-action-bar-more-item flex cursor-pointer select-none items-center gap-2 rounded-[12px] px-3 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
                <HugeiconsIcon
                  icon={Download01Icon}
                  strokeWidth={1.75}
                  className="size-icon"
                />
                Export as markdown
              </ActionBarMorePrimitive.Item>
            </ActionBarPrimitive.ExportMarkdown>
            {activeProjectId && (
              <ActionBarMorePrimitive.Item
                onSelect={() => {
                  const text = replySourceMarkdown(
                    aui.message().getState().content,
                    toolResultModelText,
                  );
                  if (!text.trim()) {
                    toast.info("No content to save.");
                    return;
                  }
                  const state = aui.threadListItem().getState();
                  const title = state.title
                    ? `${state.title} - reply`
                    : "reply";
                  const remoteId =
                    state.remoteId ||
                    useChatRuntimeStore.getState().activeThreadId;
                  void (async () => {
                    const thread = remoteId
                      ? await getStoredChatThread(remoteId).catch(() => null)
                      : null;
                    if (!thread?.projectId) {
                      toast.info("This chat isn't in a project.");
                      return;
                    }
                    await saveMarkdownAsProjectSource(
                      thread.projectId,
                      text,
                      title,
                    );
                  })();
                }}
                className="aui-action-bar-more-item flex cursor-pointer select-none items-center gap-2 rounded-[12px] px-3 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
              >
                <HugeiconsIcon
                  icon={BookOpen01Icon}
                  strokeWidth={1.75}
                  className="size-icon"
                />
                Save to project sources
              </ActionBarMorePrimitive.Item>
            )}
            <ActionBarMorePrimitive.Item
              onSelect={() => setDetailsOpen(true)}
              className="aui-action-bar-more-item flex cursor-pointer select-none items-center gap-2 rounded-[12px] px-3 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
            >
              <HugeiconsIcon
                icon={HelpCircleIcon}
                strokeWidth={1.75}
                className="size-icon"
              />
              See response details
            </ActionBarMorePrimitive.Item>
          </ActionBarMorePrimitive.Content>
        </ActionBarMorePrimitive.Root>
        <MessageTiming side="top" className="h-8 px-2" />
      </ActionBarPrimitive.Root>
      <MessageResponseDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </>
  );
};

export const UserActionBar: FC = () => {
  const ownsResearchMessage = useOwnsResearchMessage();
  const researchActive = useThreadResearchActive();
  return (
    <ActionBarPrimitive.Root
      autohide="always"
      className="aui-user-action-bar-root flex gap-1 text-chat-icon-fg [&_button]:size-8 [&_button]:!rounded-full [&_button:hover]:bg-chat-icon-bg-hover [&_button:hover]:text-chat-icon-fg-hover"
    >
      <CopyButton />
      {!ownsResearchMessage && !researchActive && (
        <ActionBarPrimitive.Edit asChild={true}>
          <TooltipIconButton tooltip="Edit" className="aui-user-action-edit">
            <HugeiconsIcon
              icon={Edit03Icon}
              strokeWidth={1.75}
              className="size-icon"
            />
          </TooltipIconButton>
        </ActionBarPrimitive.Edit>
      )}
      <ForkCountBadge />
      <ForkMessageButton />
      <DeleteMessageButton />
    </ActionBarPrimitive.Root>
  );
};

export const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch={true}
      className={cn(
        "aui-branch-picker-root inline-flex items-center text-chat-icon-fg text-ui-13",
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild={true}>
        <button
          type="button"
          aria-label="Previous"
          className="aui-branch-chevron-btn"
        >
          <ChevronLeftIcon strokeWidth={1.25} className="size-[36px]" />
        </button>
      </BranchPickerPrimitive.Previous>
      <span className="aui-branch-picker-state font-mono text-ui-13 tabular-nums">
        <BranchPickerPrimitive.Number />/<BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild={true}>
        <button
          type="button"
          aria-label="Next"
          className="aui-branch-chevron-btn"
        >
          <ChevronRightIcon strokeWidth={1.25} className="size-[36px]" />
        </button>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};
