/**
 * Sparta Agent – Sidebar Header & Brand Component
 *
 * Renderiza el encabezado del Sidebar:
 * - Soporte para controles de ventana nativos de macOS (DesktopTitlebarNavigation).
 * - Logo Spartan Agent y enlace de navegación rápida a Chat.
 * - Botón de búsqueda (Ctrl+K / Cmd+K) y botón de fijar/desfijar sidebar.
 * - Botón de colapso en riel de iconos.
 */

import type { ReactElement } from "react";
import { Link } from "@tanstack/react-router";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  SidebarHeader,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  LayoutAlignLeftIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { DesktopTitlebarNavigation } from "@/components/tauri/window-titlebar";
import { useChatSearchStore } from "@/features/chat";

export function SidebarBrandHeader({
  showSidebarBrand,
  usesNativeMacTitlebar,
  usesDesktopTitlebar,
  isMobile,
  pinned,
  togglePinned,
  chatDisabled,
  openNewChat,
  closeMobileIfOpen,
  searchShortcutLabel,
}: {
  showSidebarBrand: boolean;
  usesNativeMacTitlebar: boolean;
  usesDesktopTitlebar: boolean;
  isMobile: boolean;
  pinned: boolean;
  togglePinned: () => void;
  chatDisabled: boolean;
  openNewChat: (projectId: string | null) => void;
  closeMobileIfOpen: () => void;
  searchShortcutLabel?: string | null;
}): ReactElement {
  const t = useT();

  return (
    <SidebarHeader
      className={cn(
        "relative",
        usesDesktopTitlebar
          ? "shrink-0 p-0 pt-[calc(var(--studio-desktop-titlebar-height,34px)+17px)]"
          : "pl-3 pr-3 pt-[14px] pb-[8px] group-data-[collapsible=icon]:px-0",
      )}
    >
      {showSidebarBrand && (
        <>
          {usesNativeMacTitlebar && !isMobile && (
            <div
              data-tauri-drag-region
              className="absolute inset-x-0 top-0 z-10 flex h-[var(--studio-desktop-titlebar-height,34px)] items-start pt-px pl-[calc(var(--studio-mac-traffic-light-inset,78px)+6px)] select-none group-data-[collapsible=icon]:hidden"
            >
              <DesktopTitlebarNavigation
                expanded={pinned}
                onToggleSidebar={togglePinned}
              />
            </div>
          )}
          <div
            data-tauri-drag-region={usesNativeMacTitlebar || undefined}
            className={cn(
              "relative z-10 flex items-center gap-[8.5px] group-data-[collapsible=icon]:hidden",
              usesDesktopTitlebar
                ? "justify-between pl-4 pr-3"
                : "justify-between",
            )}
          >
            <Link
              to="/chat"
              onClick={(event) => {
                event.preventDefault();
                if (chatDisabled) return;
                openNewChat(null);
              }}
              className={cn(
                "flex min-w-0 items-center gap-[6px] select-none transition-opacity",
                chatDisabled && "pointer-events-none",
              )}
              aria-label={t("shell.aria.home")}
              aria-disabled={chatDisabled}
              tabIndex={chatDisabled ? -1 : undefined}
            >
              <span
                aria-hidden="true"
                className="relative top-px h-[calc(24px+0.5rem*var(--ui-font-scale,1))] w-[calc(24px+0.5rem*var(--ui-font-scale,1))] shrink-0 bg-primary [mask-image:url('/spartan-logo.svg')] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
              />
              <span className="relative -top-px truncate font-heading text-[calc(10px+0.3rem*var(--ui-font-scale,1))] font-bold tracking-[0.04em] uppercase leading-tight text-nav-fg">
                SPARTAN AGENT
              </span>
            </Link>
            <div className="flex shrink-0 items-center gap-0.25">
              <Tooltip>
                <TooltipPrimitive.Trigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      useChatSearchStore.getState().open();
                      closeMobileIfOpen();
                    }}
                    className="inline-flex size-[30px] cursor-pointer items-center justify-center rounded-[10px] text-primary transition-colors hover:bg-nav-surface-hover hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    aria-label={t("shell.navigation.search")}
                  >
                    <HugeiconsIcon
                      icon={Search01Icon}
                      strokeWidth={1.75}
                      className="size-icon"
                    />
                  </button>
                </TooltipPrimitive.Trigger>
                <TooltipContent
                  side="bottom"
                  sideOffset={6}
                  className="tooltip-compact flex items-center gap-1.5"
                  hidden={isMobile}
                >
                  {t("shell.navigation.search")}
                  {searchShortcutLabel && (
                    <kbd className="rounded bg-black/10 px-1 py-px text-ui-10 font-medium leading-none dark:bg-white/15">
                      {searchShortcutLabel}
                    </kbd>
                  )}
                </TooltipContent>
              </Tooltip>
              {!isMobile && !usesDesktopTitlebar && (
                <Tooltip>
                  <TooltipPrimitive.Trigger asChild>
                    <button
                      type="button"
                      onClick={togglePinned}
                      className="inline-flex size-[30px] cursor-pointer items-center justify-center rounded-[10px] text-primary transition-colors hover:bg-nav-surface-hover hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      aria-label={t("shell.aria.closeSidebar")}
                    >
                      <HugeiconsIcon
                        icon={LayoutAlignLeftIcon}
                        strokeWidth={1.75}
                        className="size-icon"
                      />
                    </button>
                  </TooltipPrimitive.Trigger>
                  <TooltipContent
                    side="bottom"
                    sideOffset={6}
                    className="tooltip-compact"
                  >
                    {t("shell.aria.closeSidebar")}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
          {!isMobile && (!usesDesktopTitlebar || usesNativeMacTitlebar) && (
            <div className="relative z-10 hidden group-data-[collapsible=icon]:flex h-[33px] items-center justify-center w-full">
              <Tooltip>
                <TooltipPrimitive.Trigger asChild>
                  <button
                    type="button"
                    onClick={togglePinned}
                    className="inline-flex size-[30px] cursor-pointer items-center justify-center rounded-[10px] text-nav-fg transition-colors hover:bg-nav-surface-hover hover:text-black dark:hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    aria-label={t("shell.aria.openSidebar")}
                  >
                    <HugeiconsIcon
                      icon={LayoutAlignLeftIcon}
                      strokeWidth={1.75}
                      className="size-icon"
                    />
                  </button>
                </TooltipPrimitive.Trigger>
                <TooltipContent
                  side="right"
                  sideOffset={8}
                  className="tooltip-compact"
                >
                  {t("shell.aria.openSidebar")}
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </>
      )}
    </SidebarHeader>
  );
}
