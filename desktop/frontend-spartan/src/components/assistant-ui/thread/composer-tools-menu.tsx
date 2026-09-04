/**
 * Sparta Agent - Menú de Herramientas y Acciones del Composer (ComposerToolsMenu)
 * Provee el menú desplegable "+" para adjuntar archivos, activar Web Search, Code,
 * Deep Research, Images, MCP, proyectos recientes, prompts guardados y exportación.
 */

import {
  Fragment,
  useCallback,
  useContext,
  useState,
  type FC,
  type ReactNode,
} from "react";
import { Columns2Icon, GlobeIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import {
  AttachmentIcon,
  Bookmark02Icon,
  CodeIcon,
  Download01Icon,
  Folder01Icon,
  FolderAddIcon,
  Image03Icon,
  McpServerIcon,
  PencilRulerIcon,
  Telescope02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useAui, useAuiState } from "@assistant-ui/react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CONVERSATION_MARKDOWN_LABEL,
  PLUS_MENU_ORDER,
  usePlusMenuPrefsStore,
  type PlusMenuItemId,
} from "@/features/chat";
import {
  listPromptEntries,
  type PromptEntry,
} from "@/features/chat/api/prompts-api";
import { BypassPermissionsMenuItem } from "@/features/chat/bypass-permissions-menu-item";
import { NewProjectDialog } from "@/features/chat/components/new-project-dialog";
import {
  parseExternalModelId,
  providerModelSupportsStudioTools,
} from "@/features/chat/external-providers";
import { useChatProjects } from "@/features/chat/hooks/use-chat-projects";
import { useRagToolDisabled } from "@/features/chat/hooks/use-rag-tool-disabled";
import {
  PromptStorageDialog,
  exportConversationCsv,
  exportConversationMarkdown,
  exportConversationRawJsonl,
  exportConversationShareGPT,
} from "@/features/chat/prompt-storage/prompt-storage-dialog";
import { useChatRuntimeStore } from "@/features/chat/stores/chat-runtime-store";
import { useExternalProvidersStore } from "@/features/chat/stores/external-providers-store";
import { isDownloadCancelled } from "@/lib/native-files";
import { applyQwenThinkingParams } from "@/features/chat/utils/qwen-params";
import { useT } from "@/i18n";
import { PromptQueueContext } from "./prompt-queue-manager";

export const AUDIO_ACCEPT_TOKEN_RE =
  /^(audio\/|\.(?:wav|mp3|m4a|ogg|oga|flac)$)/i;

export function attachmentAcceptForPicker(
  accept: string,
  audioEnabled: boolean,
): string {
  if (audioEnabled || accept === "*") {
    return accept;
  }
  const filtered = accept
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token && !AUDIO_ACCEPT_TOKEN_RE.test(token))
    .join(",");
  return filtered || accept;
}

export interface ComposerToolsMenuProps {
  side?: "top" | "bottom";
  researchAvailable: boolean;
}

export const ComposerToolsMenu: FC<ComposerToolsMenuProps> = ({
  side = "bottom",
  researchAvailable,
}) => {
  const navigate = useNavigate();
  const toolsEnabled = useChatRuntimeStore((s) => s.toolsEnabled);
  const setToolsEnabled = useChatRuntimeStore((s) => s.setToolsEnabled);
  const codeToolsEnabled = useChatRuntimeStore((s) => s.codeToolsEnabled);
  const setCodeToolsEnabled = useChatRuntimeStore((s) => s.setCodeToolsEnabled);
  const artifactsEnabled = useChatRuntimeStore((s) => s.artifactsEnabled);
  const setArtifactsEnabled = useChatRuntimeStore((s) => s.setArtifactsEnabled);
  const showCanvasMenuItem = useChatRuntimeStore((s) => s.showCanvasMenuItem);
  const mcpEnabledForChat = useChatRuntimeStore((s) => s.mcpEnabledForChat);
  const setMcpEnabledForChat = useChatRuntimeStore(
    (s) => s.setMcpEnabledForChat,
  );
  const deepResearchEnabled = useChatRuntimeStore((s) => s.deepResearchEnabled);
  const setDeepResearchEnabled = useChatRuntimeStore(
    (s) => s.setDeepResearchEnabled,
  );
  const incognito = useChatRuntimeStore((s) => s.incognito);
  const modelLoaded = useChatRuntimeStore(
    (s) => !!s.params.checkpoint && !s.modelLoading,
  );
  const audioAttachmentsEnabled = useChatRuntimeStore((s) => {
    const activeCheckpoint = s.params.checkpoint;
    if (!activeCheckpoint || s.modelLoading) {
      return false;
    }
    const activeModel = s.models.find((m) => m.id === activeCheckpoint);
    return Boolean(activeModel?.hasAudioInput);
  });
  const checkpoint = useChatRuntimeStore((s) => s.params.checkpoint);
  const supportsTools = useChatRuntimeStore((s) => s.supportsTools);
  const supportsBuiltinWebSearch = useChatRuntimeStore(
    (s) => s.supportsBuiltinWebSearch,
  );
  const supportsBuiltinCodeExecution = useChatRuntimeStore(
    (s) => s.supportsBuiltinCodeExecution,
  );
  const supportsBuiltinImageGeneration = useChatRuntimeStore(
    (s) => s.supportsBuiltinImageGeneration,
  );
  const imageToolsEnabled = useChatRuntimeStore((s) => s.imageToolsEnabled);
  const setImageToolsEnabled = useChatRuntimeStore(
    (s) => s.setImageToolsEnabled,
  );
  const setReasoningEnabled = useChatRuntimeStore((s) => s.setReasoningEnabled);
  const connectionsEnabled = useExternalProvidersStore(
    (s) => s.connectionsEnabled,
  );
  const externalProvidersAll = useExternalProvidersStore((s) => s.providers);
  const externalProviders = connectionsEnabled ? externalProvidersAll : [];
  const externalSelection = parseExternalModelId(checkpoint);
  const selectedExternalProvider =
    externalSelection != null
      ? externalProviders.find((p) => p.id === externalSelection.providerId)
      : undefined;
  const isKimiExternal = selectedExternalProvider?.providerType === "kimi";

  const searchDisabled =
    modelLoaded && !(supportsTools || supportsBuiltinWebSearch);
  const codeDisabled =
    modelLoaded && !(supportsTools || supportsBuiltinCodeExecution);
  const imageDisabled = !modelLoaded;
  const mcpDisabled = modelLoaded && !supportsTools;
  const researchDisabled =
    !researchAvailable ||
    (Boolean(externalSelection) &&
      providerModelSupportsStudioTools(
        selectedExternalProvider?.providerType,
        externalSelection?.modelId,
      ) !== true) ||
    incognito;

  const { projects } = useChatProjects();
  const recentProjects = [...projects]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 3);
  const openProject = (projectId: string) => {
    useChatRuntimeStore.getState().setActiveProjectId(projectId);
    navigate({ to: "/chat", search: { project: projectId } });
  };

  const startCompare = useCallback(() => {
    const store = useChatRuntimeStore.getState();
    store.setActiveThreadId(null);
    store.setContextUsage(null);
    const compareId =
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    navigate({ to: "/chat", search: { compare: compareId } });
  }, [navigate]);

  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [promptStorageOpen, setPromptStorageOpen] = useState(false);
  const activeThreadId = useChatRuntimeStore((s) => s.activeThreadId);
  const aui = useAui();
  const composerCanAddAttachments = useAuiState(
    ({ composer }) => composer.isEditing,
  );

  const pickAttachment = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.hidden = true;

    const attachmentAccept = attachmentAcceptForPicker(
      aui.composer().getState().attachmentAccept,
      audioAttachmentsEnabled,
    );
    if (attachmentAccept !== "*") {
      input.accept = attachmentAccept;
    }

    document.body.appendChild(input);
    input.onchange = (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (files) {
        for (const file of files) {
          void aui.composer().addAttachment(file);
        }
      }
      document.body.removeChild(input);
    };
    input.oncancel = () => {
      if (!input.files || input.files.length === 0) {
        document.body.removeChild(input);
      }
    };
    input.click();
  }, [aui, audioAttachmentsEnabled]);

  const messageCount = useAuiState(({ thread }) => thread.messages.length);
  const exportDisabled = incognito || !activeThreadId || messageCount === 0;
  const { startQueue } = useContext(PromptQueueContext);

  const plusPins = usePlusMenuPrefsStore((s) => s.pins);

  const [recentPrompts, setRecentPrompts] = useState<PromptEntry[]>([]);
  const refreshRecentPrompts = useCallback(async () => {
    try {
      const rows = await listPromptEntries();
      const byRecent = [...rows].sort((a, b) => b.updatedAt - a.updatedAt);
      const pinnedIds = usePlusMenuPrefsStore.getState().pinnedPromptIds;
      const pinned = byRecent.filter((p) => pinnedIds.includes(p.id));
      setRecentPrompts(pinned.length > 0 ? pinned : byRecent.slice(0, 3));
    } catch {}
  }, []);

  const t = useT();

  const plusMenuNodes: Record<PlusMenuItemId, ReactNode> = {
    mcp: (
      <DropdownMenuItem
        disabled={mcpDisabled}
        className={
          mcpEnabledForChat && !mcpDisabled
            ? "text-primary font-medium"
            : undefined
        }
        onSelect={() => setMcpEnabledForChat(!mcpEnabledForChat)}
      >
        <HugeiconsIcon icon={McpServerIcon} strokeWidth={2} />
        {t("chat.composer.mcp")}
        {mcpEnabledForChat && !mcpDisabled ? (
          <HugeiconsIcon
            icon={Tick02Icon}
            strokeWidth={2}
            className="ml-auto"
          />
        ) : null}
      </DropdownMenuItem>
    ),
    savedPrompts: (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <HugeiconsIcon icon={Bookmark02Icon} strokeWidth={2} />
          {t("chat.composer.savedPrompts")}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent
          collisionPadding={16}
          className="unsloth-plus-menu w-[208px]"
        >
          {recentPrompts.map((p) => (
            <DropdownMenuItem
              key={p.id}
              onSelect={() => aui.composer().setText(p.text)}
            >
              <span className="truncate">{p.name}</span>
            </DropdownMenuItem>
          ))}
          {recentPrompts.length > 0 ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem onSelect={() => setPromptStorageOpen(true)}>
            {t("chat.composer.allSavedPrompts")}
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    ),
    compareChat: (
      <DropdownMenuItem onSelect={() => startCompare()}>
        <Columns2Icon />
        {t("chat.composer.compareChat")}
      </DropdownMenuItem>
    ),
    exportChat: (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger disabled={exportDisabled}>
          <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />
          {t("chat.composer.exportChat")}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent
          collisionPadding={16}
          className="unsloth-plus-menu w-[208px]"
        >
          <DropdownMenuItem
            onSelect={() => {
              if (!activeThreadId) return;
              exportConversationRawJsonl(activeThreadId).catch((error) => {
                if (!isDownloadCancelled(error)) toast.error("Export failed.");
              });
            }}
          >
            Raw JSONL
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              if (!activeThreadId) return;
              exportConversationCsv(activeThreadId).catch((error) => {
                if (!isDownloadCancelled(error)) toast.error("Export failed.");
              });
            }}
          >
            CSV
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              if (!activeThreadId) return;
              exportConversationShareGPT(activeThreadId).catch((error) => {
                if (!isDownloadCancelled(error)) toast.error("Export failed.");
              });
            }}
          >
            ShareGPT JSONL
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              if (!activeThreadId) return;
              exportConversationMarkdown(activeThreadId).catch((error) => {
                if (!isDownloadCancelled(error)) toast.error("Export failed.");
              });
            }}
          >
            {CONVERSATION_MARKDOWN_LABEL}
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    ),
    canvas: showCanvasMenuItem ? (
      <DropdownMenuItem
        className={artifactsEnabled ? "text-primary font-medium" : undefined}
        onSelect={() => setArtifactsEnabled(!artifactsEnabled)}
      >
        <HugeiconsIcon icon={PencilRulerIcon} strokeWidth={2} />
        {t("chat.composer.canvas")}
        {artifactsEnabled ? (
          <HugeiconsIcon
            icon={Tick02Icon}
            strokeWidth={2}
            className="ml-auto"
          />
        ) : null}
      </DropdownMenuItem>
    ) : null,
    bypassPermissions: <BypassPermissionsMenuItem />,
    projects: (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />
          {t("chat.composer.projects")}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="unsloth-plus-menu w-[232px]">
          <DropdownMenuItem onSelect={() => setNewProjectOpen(true)}>
            <HugeiconsIcon icon={FolderAddIcon} strokeWidth={2} />
            {t("chat.composer.newProject")}
          </DropdownMenuItem>
          <DropdownMenuLabel>{t("chat.composer.recents")}</DropdownMenuLabel>
          {recentProjects.length > 0 ? (
            recentProjects.map((project) => (
              <DropdownMenuItem
                key={project.id}
                onSelect={() => openProject(project.id)}
              >
                <HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />
                <span className="truncate">{project.name}</span>
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled={true}>
              {t("chat.composer.noRecentProjects")}
            </DropdownMenuItem>
          )}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    ),
  };

  const pinnedPlusItems = PLUS_MENU_ORDER.filter((id) => plusPins[id]);
  const overflowPlusItems = PLUS_MENU_ORDER.filter((id) => !plusPins[id]);

  return (
    <>
      <PromptStorageDialog
        open={promptStorageOpen}
        onOpenChange={setPromptStorageOpen}
        onUse={(text) => {
          aui.composer().setText(text);
        }}
        onRunList={(items) => {
          const started = startQueue(items, undefined, () => {
            setPromptStorageOpen(true);
            toast.info("Saved list was not queued", {
              description:
                "The chat changed before the queue was ready. Try again.",
            });
          });
          if (started) {
            setPromptStorageOpen(false);
          }
        }}
      />
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) void refreshRecentPrompts();
        }}
      >
        <DropdownMenuTrigger asChild={true}>
          <button
            type="button"
            aria-label="Tools and attachments"
            className="unsloth-composer-plus"
            data-tour="chat-plus-menu"
          >
            <PlusIcon className="size-[22px] stroke-[1.75px]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={side}
          align="start"
          sideOffset={0}
          avoidCollisions={true}
          className="unsloth-plus-menu w-[244px]"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <DropdownMenuItem
            disabled={!composerCanAddAttachments}
            onSelect={() => pickAttachment()}
          >
            <HugeiconsIcon icon={AttachmentIcon} strokeWidth={2} />
            {t("chat.composer.addPhotosAndFiles")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={searchDisabled}
            className={
              toolsEnabled && !searchDisabled
                ? "text-primary font-medium"
                : undefined
            }
            onSelect={() => {
              const next = !toolsEnabled;
              setToolsEnabled(next);
              if (isKimiExternal) {
                setReasoningEnabled(!next, { persist: false });
                applyQwenThinkingParams(!next);
              }
            }}
          >
            <GlobeIcon />
            {t("chat.composer.webSearch")}
            {toolsEnabled && !searchDisabled ? (
              <HugeiconsIcon
                icon={Tick02Icon}
                strokeWidth={2}
                className="ml-auto"
              />
            ) : null}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={codeDisabled}
            className={
              codeToolsEnabled && !codeDisabled
                ? "text-primary font-medium"
                : undefined
            }
            onSelect={() => setCodeToolsEnabled(!codeToolsEnabled)}
          >
            <HugeiconsIcon
              icon={CodeIcon}
              strokeWidth={2}
              className="scale-[1.12]"
            />
            {t("chat.composer.code")}
            {codeToolsEnabled && !codeDisabled ? (
              <HugeiconsIcon
                icon={Tick02Icon}
                strokeWidth={2}
                className="ml-auto"
              />
            ) : null}
          </DropdownMenuItem>
          {researchAvailable ? (
            <DropdownMenuItem
              disabled={researchDisabled && !deepResearchEnabled}
              className={
                deepResearchEnabled && !researchDisabled
                  ? "text-primary font-medium"
                  : undefined
              }
              onSelect={() => setDeepResearchEnabled(!deepResearchEnabled)}
            >
              <HugeiconsIcon icon={Telescope02Icon} strokeWidth={2} />
              {t("chat.composer.deepResearch")}
              {deepResearchEnabled && !researchDisabled ? (
                <HugeiconsIcon
                  icon={Tick02Icon}
                  strokeWidth={2}
                  className="ml-auto"
                />
              ) : null}
            </DropdownMenuItem>
          ) : null}
          {supportsBuiltinImageGeneration && (
            <DropdownMenuItem
              disabled={imageDisabled}
              className={
                imageToolsEnabled && !imageDisabled
                  ? "text-primary font-medium"
                  : undefined
              }
              onSelect={() => setImageToolsEnabled(!imageToolsEnabled)}
            >
              <HugeiconsIcon icon={Image03Icon} strokeWidth={2} />
              Images
              {imageToolsEnabled && !imageDisabled ? (
                <HugeiconsIcon
                  icon={Tick02Icon}
                  strokeWidth={2}
                  className="ml-auto"
                />
              ) : null}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {pinnedPlusItems.map((id) => (
            <Fragment key={id}>{plusMenuNodes[id]}</Fragment>
          ))}
          {overflowPlusItems.length > 0 ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <MoreHorizontalIcon className="size-4" />
                {t("chat.composer.more")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="unsloth-plus-menu w-[248px]">
                {overflowPlusItems.map((id) => (
                  <Fragment key={id}>{plusMenuNodes[id]}</Fragment>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <NewProjectDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
      />
    </>
  );
};
