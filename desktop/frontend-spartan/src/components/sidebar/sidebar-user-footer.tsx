/**
 * Sparta Agent – Sidebar Footer Component
 *
 * Renderiza el pie de página de la barra lateral:
 * - Indicador de gradiente superior con fade dinámico para scroll.
 * - Tarjeta de actualización pendiente de versión (WebUpdateCheck).
 * - Perfil de usuario con avatar, nombre Spartan Agent y menú de configuración.
 * - Botón de acceso directo a Ajustes / Settings cog.
 */

import type { ReactElement } from "react";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight02Icon,
  BadgeInfoIcon,
  CursorInfo02Icon,
  Globe02Icon,
  HelpCircleIcon,
  PowerIcon,
  Settings02Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";
import { Moon } from "lucide-react";
import { UserAvatar } from "@/features/profile";
import { useSettingsDialogStore } from "@/features/settings";
import { TOUR_OPEN_EVENT } from "@/features/tour";
import { NavItem } from "./sidebar-nav-items";
import {
  SETTINGS_TAB_MENU_ITEMS,
  getTourId,
} from "./sidebar-types-and-constants";

export interface SidebarUserFooterProps {
  rowPadding: string;
  showUpdateCard: boolean;
  canScrollDown: boolean;
  updateVersion?: string | null;
  displayTitle: string;
  avatarDataUrl?: string | null;
  settingsShortcutLabel?: string | null;
  sidebarMenu: Array<{ id: string; visible: boolean }>;
  pathname: string;
  isDark: boolean;
  toggleTheme: () => void;
  anchorRef: React.Ref<any>;
  isTauri: boolean;
  closeMobileIfOpen: () => void;
  onOpenShutdown: () => void;
}

export function SidebarUserFooter({
  rowPadding,
  showUpdateCard,
  canScrollDown,
  updateVersion,
  displayTitle,
  avatarDataUrl,
  settingsShortcutLabel,
  sidebarMenu,
  pathname,
  isDark,
  toggleTheme,
  anchorRef,
  isTauri,
  closeMobileIfOpen,
  onOpenShutdown,
}: SidebarUserFooterProps): ReactElement {
  const t = useT();

  return (
    <SidebarFooter
      className={cn(
        "relative pb-[11px] group-data-[collapsible=icon]:px-0",
        rowPadding,
        showUpdateCard ? "pt-1" : "pt-[3px]",
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute start-0 end-[var(--sidebar-rail,0px)] bottom-full bg-gradient-to-t from-[var(--sidebar-surface)] from-[8px] to-[rgb(from_var(--sidebar-surface)_r_g_b/0)] transition-opacity duration-200",
          showUpdateCard ? "h-7" : "h-10",
          canScrollDown ? "opacity-100" : "opacity-0",
        )}
      />
      <SidebarMenu className="gap-3 group-data-[collapsible=icon]:gap-2.5">
        {showUpdateCard && (
          <SidebarMenuItem>
            <button
              type="button"
              aria-label={t("shell.updateAvailable")}
              onClick={() => {
                useSettingsDialogStore
                  .getState()
                  .openDialog("about", { scrollTarget: "about-updates" });
                closeMobileIfOpen();
              }}
              className="flex h-[44px] w-full items-center gap-[9px] rounded-[14px] border border-border/60 bg-transparent px-2 py-[3px] text-left transition-colors hover:bg-nav-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:h-[34px] group-data-[collapsible=icon]:w-[34px] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:p-0"
            >
              <span
                aria-hidden="true"
                className="flex size-[32px] shrink-0 items-center justify-center group-data-[collapsible=icon]:size-full"
              >
                <HugeiconsIcon
                  icon={BadgeInfoIcon}
                  strokeWidth={1.75}
                  className="size-[21px] text-nav-fg"
                />
              </span>
              <div className="flex min-w-0 flex-col gap-px leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-heading text-ui-13p5 font-semibold text-nav-fg">
                  {t("shell.updateAvailable")}
                </span>
                {updateVersion && (
                  <span className="truncate text-ui-11p5 text-muted-foreground">
                    v{updateVersion}
                  </span>
                )}
              </div>
              <span
                aria-hidden="true"
                className="ml-auto flex size-[32px] shrink-0 items-center justify-center text-muted-foreground group-data-[collapsible=icon]:hidden"
              >
                <HugeiconsIcon
                  icon={ArrowRight02Icon}
                  className="size-[17px]"
                  strokeWidth={1.75}
                />
              </span>
            </button>
          </SidebarMenuItem>
        )}
        <NavItem
          className="hidden group-data-[collapsible=icon]:block"
          icon={Settings02Icon}
          label={t("shell.navigation.settings")}
          active={false}
          onClick={() => {
            useSettingsDialogStore.getState().openDialog();
            closeMobileIfOpen();
          }}
        />
        <SidebarMenuItem className="relative">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t("shell.accountMenu", { name: displayTitle })}
                className="sidebar-nav-btn peer/menu-button flex w-full items-center !h-[44px] -my-[3px] gap-[9px] pl-2 pr-[45px] py-[3px] rounded-[14px] cursor-pointer select-none text-left outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent group-data-[collapsible=icon]:!size-[34px] group-data-[collapsible=icon]:!rounded-full group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center"
              >
                <div className="flex shrink-0 items-center pointer-events-none">
                  <UserAvatar
                    name={displayTitle}
                    imageUrl={avatarDataUrl ?? null}
                    size="sm"
                    className="!size-[32px] group-data-[collapsible=icon]:!rounded-full"
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-px leading-tight group-data-[collapsible=icon]:hidden pointer-events-none">
                  <span className="truncate font-heading text-ui-13p5 tracking-[0.025em] dark:tracking-[0.04em] font-semibold text-nav-fg">
                    {displayTitle}
                  </span>
                  <span className="truncate text-ui-11p5 tracking-nav text-muted-foreground">
                    Sparta Agent
                  </span>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              sideOffset={8}
              className="app-user-menu menu-soft-surface-up ring-0 !w-[16rem] min-w-[16rem] rounded-[20px] border border-transparent px-2.5 py-2.5 font-heading dark:border-white/[0.05] z-[100]"
            >
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onSelect={() =>
                    useSettingsDialogStore.getState().openDialog()
                  }
                >
                  <HugeiconsIcon
                    icon={Settings02Icon}
                    strokeWidth={1.75}
                    className="size-icon"
                  />
                  <span>{t("shell.navigation.settings")}</span>
                  {settingsShortcutLabel && (
                    <DropdownMenuShortcut>
                      {settingsShortcutLabel}
                    </DropdownMenuShortcut>
                  )}
                </DropdownMenuItem>
                {sidebarMenu.map((item) => {
                  if (!item.visible) return null;
                  if (item.id === "api") {
                    return (
                      <DropdownMenuItem
                        key={item.id}
                        onSelect={() =>
                          useSettingsDialogStore
                            .getState()
                            .openDialog("api-keys")
                        }
                      >
                        <HugeiconsIcon
                          icon={Globe02Icon}
                          strokeWidth={1.75}
                          className="size-[18px]"
                        />
                        <span>{t("shell.navigation.api")}</span>
                      </DropdownMenuItem>
                    );
                  }
                  if (item.id === "darkMode") {
                    return (
                      <DropdownMenuItem
                        key={item.id}
                        ref={anchorRef as React.Ref<HTMLDivElement>}
                        onSelect={(e) => {
                          e.preventDefault();
                          toggleTheme();
                        }}
                      >
                        {isDark ? (
                          <HugeiconsIcon
                            icon={Sun03Icon}
                            strokeWidth={1.75}
                            className="size-icon"
                          />
                        ) : (
                          <Moon strokeWidth={1.75} className="size-icon" />
                        )}
                        <span>
                          {isDark
                            ? t("shell.navigation.lightMode")
                            : t("shell.navigation.darkMode")}
                        </span>
                      </DropdownMenuItem>
                    );
                  }
                  if (item.id === "guidedTour") {
                    if (!getTourId(pathname)) return null;
                    return (
                      <DropdownMenuItem
                        key={item.id}
                        onSelect={() => {
                          const tourId = getTourId(pathname);
                          if (!tourId) return;
                          window.dispatchEvent(
                            new CustomEvent(TOUR_OPEN_EVENT, {
                              detail: { id: tourId },
                            }),
                          );
                        }}
                      >
                        <HugeiconsIcon
                          icon={CursorInfo02Icon}
                          strokeWidth={1.75}
                          className="size-icon"
                        />
                        <span>{t("shell.navigation.guidedTour")}</span>
                      </DropdownMenuItem>
                    );
                  }
                  const settingsTabId = item.id as keyof typeof SETTINGS_TAB_MENU_ITEMS;
                  const tab = SETTINGS_TAB_MENU_ITEMS[settingsTabId];
                  if (!tab) return null;
                  return (
                    <DropdownMenuItem
                      key={item.id}
                      onSelect={() =>
                        useSettingsDialogStore
                          .getState()
                          .openDialog(settingsTabId)
                      }
                    >
                      <HugeiconsIcon
                        icon={tab.icon}
                        strokeWidth={1.75}
                        className="size-icon"
                      />
                      <span>{t(tab.labelKey)}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="mx-1! my-2.5! h-0! border-t border-border/70 bg-transparent! dark:border-white/15" />
              <DropdownMenuItem
                onSelect={() =>
                  useSettingsDialogStore.getState().openDialog("about")
                }
              >
                <HugeiconsIcon
                  icon={HelpCircleIcon}
                  strokeWidth={1.75}
                  className="size-icon"
                />
                <span>{t("common.help")}</span>
              </DropdownMenuItem>
              {!isTauri && (
                <DropdownMenuItem onSelect={onOpenShutdown}>
                  <HugeiconsIcon
                    icon={PowerIcon}
                    strokeWidth={1.75}
                    className="size-icon"
                  />
                  <span>{t("common.shutdown")}</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            aria-label={t("shell.navigation.settings")}
            onClick={() => useSettingsDialogStore.getState().openDialog()}
            className="absolute right-2 top-1/2 flex size-[32px] -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/10 hover:text-foreground dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-data-[collapsible=icon]:hidden"
          >
            <HugeiconsIcon
              icon={Settings02Icon}
              strokeWidth={1.5}
              className="!size-[18px]"
            />
          </button>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
}
