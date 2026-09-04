/**
 * Sparta Agent – Shared Composer Tools Menu
 *
 * Menú "+" desplegable del SharedComposer (modo compare).
 * Centraliza las acciones para adjuntar archivos/audio, toggles de búsqueda web,
 * ejecución de código, generación de imágenes, y submenús (MCP, prompts, proyectos, exportar).
 */

import {
  PLUS_MENU_ORDER,
  type PlusMenuItemId,
  usePlusMenuPrefsStore,
} from "@/features/chat/stores/plus-menu-prefs-store";
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
  exportConversationShareGPT,
  exportConversationRawJsonl,
  exportConversationCsv,
  exportConversationMarkdown,
} from "@/features/chat/prompt-storage/prompt-storage-dialog";
import { CONVERSATION_MARKDOWN_LABEL } from "@/features/chat/utils/conversation-markdown";
import { isDownloadCancelled } from "@/lib/native-files";
import { toast } from "@/lib/toast";
import { useT } from "@/i18n";
import { HugeiconsIcon } from "@hugeicons/react";
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
} from "@hugeicons/core-free-icons";
import { Columns2Icon, GlobeIcon, HeadphonesIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { Tick02Icon } from "@/lib/tick-icon";
import { BypassPermissionsMenuItem } from "@/features/chat/bypass-permissions-menu-item";
import type { PromptEntry } from "@/features/chat/api/prompts-api";
import { Fragment, type FC, type ReactNode, type RefObject } from "react";

export interface SharedComposerToolsMenuProps {
  onOpenPlusMenu: () => void;
  onSelectImageFiles: () => void;
  onSelectAudioFiles: () => void;
  hasAudioInput: boolean;
  searchDisabled: boolean;
  toolsEnabled: boolean;
  onToggleSearch: () => void;
  codeDisabled: boolean;
  codeToolsEnabled: boolean;
  onToggleCode: () => void;
  showImagePill: boolean;
  imageDisabled: boolean;
  imageToolsEnabled: boolean;
  onToggleImages: () => void;
  supportsTools: boolean;
  mcpEnabledForChat: boolean;
  setMcpEnabledForChat: (enabled: boolean) => void;
  recentPrompts: PromptEntry[];
  setText: (text: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  setPromptStorageOpen: (open: boolean) => void;
  handleExitCompare: () => void;
  exportThreadIds: string[];
  showCanvasMenuItem: boolean;
  artifactsEnabled: boolean;
  setArtifactsEnabled: (enabled: boolean) => void;
  setNewProjectOpen: (open: boolean) => void;
  recentProjects: Array<{ id: string; name: string }>;
  openProject: (id: string) => void;
}

export const SharedComposerToolsMenu: FC<SharedComposerToolsMenuProps> = ({
  onOpenPlusMenu,
  onSelectImageFiles,
  onSelectAudioFiles,
  hasAudioInput,
  searchDisabled,
  toolsEnabled,
  onToggleSearch,
  codeDisabled,
  codeToolsEnabled,
  onToggleCode,
  showImagePill,
  imageDisabled,
  imageToolsEnabled,
  onToggleImages,
  supportsTools,
  mcpEnabledForChat,
  setMcpEnabledForChat,
  recentPrompts,
  setText,
  textareaRef,
  setPromptStorageOpen,
  handleExitCompare,
  exportThreadIds,
  showCanvasMenuItem,
  artifactsEnabled,
  setArtifactsEnabled,
  setNewProjectOpen,
  recentProjects,
  openProject,
}) => {
  const t = useT();
  const plusPins = usePlusMenuPrefsStore((s) => s.pins);

  const plusMenuNodes: Record<PlusMenuItemId, ReactNode> = {
    mcp: (
      <DropdownMenuItem
        disabled={!supportsTools}
        className={mcpEnabledForChat ? "text-primary font-medium" : undefined}
        onSelect={() => setMcpEnabledForChat(!mcpEnabledForChat)}
      >
        <HugeiconsIcon icon={McpServerIcon} strokeWidth={2} />
        {t("chat.composer.mcp")}
        {mcpEnabledForChat ? (
          <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="ml-auto" />
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
              onSelect={() => {
                setText(p.text);
                requestAnimationFrame(() => textareaRef.current?.focus());
              }}
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
      <DropdownMenuItem
        className="text-primary font-medium"
        onSelect={handleExitCompare}
      >
        <Columns2Icon />
        {t("chat.composer.compareChat")}
        <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="ml-auto" />
      </DropdownMenuItem>
    ),
    exportChat: (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger disabled={exportThreadIds.length === 0}>
          <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />
          {t("chat.composer.exportChat")}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent
          collisionPadding={16}
          className="unsloth-plus-menu w-[208px]"
        >
          {[
            { label: "Raw JSONL", fn: exportConversationRawJsonl },
            { label: "CSV", fn: exportConversationCsv },
            { label: "ShareGPT JSONL", fn: exportConversationShareGPT },
            {
              label: CONVERSATION_MARKDOWN_LABEL,
              fn: exportConversationMarkdown,
            },
          ].map(({ label, fn }) => (
            <DropdownMenuItem
              key={label}
              disabled={exportThreadIds.length === 0}
              onSelect={() => {
                if (!exportThreadIds.length) {
                  toast.error("No conversation to export yet.");
                  return;
                }
                (async () => {
                  for (const id of exportThreadIds) {
                    await fn(id);
                  }
                })().catch((error) => {
                  if (!isDownloadCancelled(error)) toast.error("Export failed.");
                });
              }}
            >
              {label}
            </DropdownMenuItem>
          ))}
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
          <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="ml-auto" />
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
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) onOpenPlusMenu();
      }}
    >
      <DropdownMenuTrigger asChild={true}>
        <button
          type="button"
          aria-label="Tools and attachments"
          className="unsloth-composer-plus"
        >
          <PlusIcon className="size-[22px] stroke-[1.75px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={0}
        avoidCollisions={true}
        className="unsloth-plus-menu w-[244px]"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DropdownMenuItem onSelect={onSelectImageFiles}>
          <HugeiconsIcon icon={AttachmentIcon} strokeWidth={2} />
          {t("chat.composer.addPhotosAndFiles")}
        </DropdownMenuItem>
        {hasAudioInput && (
          <DropdownMenuItem onSelect={onSelectAudioFiles}>
            <HeadphonesIcon />
            Upload audio
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          disabled={searchDisabled}
          className={
            toolsEnabled && !searchDisabled
              ? "text-primary font-medium"
              : undefined
          }
          onSelect={onToggleSearch}
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
          onSelect={onToggleCode}
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
        {showImagePill && (
          <DropdownMenuItem
            disabled={imageDisabled}
            className={
              imageToolsEnabled && !imageDisabled
                ? "text-primary font-medium"
                : undefined
            }
            onSelect={onToggleImages}
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
  );
};
