/**
 * Sparta Agent – Sidebar Context Menus
 *
 * Componentes de menú contextual para la barra lateral:
 * - SidebarHeaderMenu: Menú desplegable "..." de cabecera para listas y proyectos (ordenar por prioridad, fecha o manual; organizar en lista o proyectos).
 * - ProjectContextMenu: Menú contextual para acciones en lote sobre proyectos seleccionados (fijar, desfijar, borrar).
 * - ChatContextMenu: Menú contextual para acciones en lote sobre chats seleccionados (fijar, archivar, marcar no leído, borrar).
 */

import type { ReactElement } from "react";
import { useT } from "@/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Archive03Icon,
  BubbleChatIcon,
  Delete02Icon,
  MoreHorizontalIcon,
  PinIcon,
  PinOffIcon,
} from "@hugeicons/core-free-icons";
import type {
  SidebarChatSort,
  SidebarOrganizeBy,
} from "@/features/chat";
import {
  CHAT_SORT_OPTIONS,
  ORGANIZE_OPTIONS,
  menuRadioItemClass,
} from "./sidebar-types-and-constants";

export function SidebarHeaderMenu({
  ariaLabel,
  sortLabel,
  sortValue,
  onSortChange,
  includeOrganize,
  organizeBy,
  onOrganizeByChange,
  onManageChats,
  onClearAllChats,
}: {
  ariaLabel: string;
  sortLabel: string;
  sortValue: SidebarChatSort;
  onSortChange: (next: SidebarChatSort) => void;
  includeOrganize?: boolean;
  organizeBy?: SidebarOrganizeBy;
  onOrganizeByChange?: (next: SidebarOrganizeBy) => void;
  onManageChats?: () => void;
  onClearAllChats?: () => void;
}): ReactElement {
  const t = useT();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className="sidebar-header-action"
        >
          <HugeiconsIcon
            icon={MoreHorizontalIcon}
            strokeWidth={1.75}
            className="size-icon"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="end"
        sideOffset={2}
        className="unsloth-plus-menu w-56"
      >
        {includeOrganize && organizeBy && onOrganizeByChange && (
          <>
            <DropdownMenuLabel>
              {t("shell.organize.sidebarHeading")}
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={organizeBy}
              onValueChange={(value) =>
                onOrganizeByChange(value as SidebarOrganizeBy)
              }
            >
              {ORGANIZE_OPTIONS.map((option) => (
                <DropdownMenuRadioItem
                  key={option.value}
                  value={option.value}
                  className={menuRadioItemClass}
                >
                  {t(option.key)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
        <DropdownMenuLabel>{sortLabel}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sortValue}
          onValueChange={(value) =>
            onSortChange(value as SidebarChatSort)
          }
        >
          {CHAT_SORT_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className={menuRadioItemClass}
            >
              {t(option.key)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {(onManageChats || onClearAllChats) && (
          <>
            <DropdownMenuSeparator />
            {onManageChats && (
              <DropdownMenuItem onSelect={onManageChats}>
                {t("shell.organize.manageChats")}
              </DropdownMenuItem>
            )}
            {onClearAllChats && (
              <DropdownMenuItem
                onSelect={onClearAllChats}
                className="text-destructive focus:text-destructive"
              >
                {t("shell.organize.clearAllChats")}
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ProjectContextMenu({
  projectSelectionCount,
  allSelectedProjectsPinned,
  onPinSelectedProjects,
  onDeleteSelectedProjects,
}: {
  projectSelectionCount: number;
  allSelectedProjectsPinned: boolean;
  onPinSelectedProjects: (pinned: boolean) => void;
  onDeleteSelectedProjects: () => void;
}): ReactElement | null {
  const t = useT();
  if (projectSelectionCount === 0) return null;

  return (
    <ContextMenuContent className="unsloth-plus-menu menu-flat-destructive w-52">
      {projectSelectionCount > 1 && (
        <ContextMenuLabel>
          {t("shell.selection.countSelected", {
            count: projectSelectionCount,
          })}
        </ContextMenuLabel>
      )}
      <ContextMenuItem
        onSelect={() => onPinSelectedProjects(!allSelectedProjectsPinned)}
      >
        <HugeiconsIcon
          icon={allSelectedProjectsPinned ? PinOffIcon : PinIcon}
          strokeWidth={1.75}
          className="size-icon"
        />
        <span>
          {allSelectedProjectsPinned
            ? t("shell.selection.unpinProjects")
            : t("shell.selection.pinProjects")}
        </span>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        variant="destructive"
        onSelect={onDeleteSelectedProjects}
      >
        <HugeiconsIcon
          icon={Delete02Icon}
          strokeWidth={1.75}
          className="size-icon"
        />
        <span>{t("shell.selection.deleteProjects")}</span>
      </ContextMenuItem>
    </ContextMenuContent>
  );
}

export function ChatContextMenu({
  selectionCount,
  allSelectedPinned,
  onPinSelected,
  onArchiveSelected,
  onMarkSelectedUnread,
  onDeleteSelected,
}: {
  selectionCount: number;
  allSelectedPinned: boolean;
  onPinSelected: (pinned: boolean) => void;
  onArchiveSelected: () => void | Promise<void>;
  onMarkSelectedUnread: () => void;
  onDeleteSelected: () => void;
}): ReactElement | null {
  const t = useT();
  if (selectionCount === 0) return null;

  return (
    <ContextMenuContent className="unsloth-plus-menu menu-flat-destructive w-52">
      {selectionCount > 1 && (
        <ContextMenuLabel>
          {t("shell.selection.countSelected", { count: selectionCount })}
        </ContextMenuLabel>
      )}
      <ContextMenuItem onSelect={() => onPinSelected(!allSelectedPinned)}>
        <HugeiconsIcon
          icon={allSelectedPinned ? PinOffIcon : PinIcon}
          strokeWidth={1.75}
          className="size-icon"
        />
        <span>
          {allSelectedPinned
            ? t("shell.selection.unpinChats")
            : t("shell.selection.pinChats")}
        </span>
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => void onArchiveSelected()}>
        <HugeiconsIcon
          icon={Archive03Icon}
          strokeWidth={1.75}
          className="size-icon"
        />
        <span>{t("shell.selection.archiveChats")}</span>
      </ContextMenuItem>
      <ContextMenuItem onSelect={onMarkSelectedUnread}>
        <HugeiconsIcon
          icon={BubbleChatIcon}
          strokeWidth={1.75}
          className="size-icon"
        />
        <span>{t("shell.selection.markUnread")}</span>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        variant="destructive"
        onSelect={onDeleteSelected}
      >
        <HugeiconsIcon
          icon={Delete02Icon}
          strokeWidth={1.75}
          className="size-icon"
        />
        <span>{t("shell.selection.deleteChats")}</span>
      </ContextMenuItem>
    </ContextMenuContent>
  );
}
