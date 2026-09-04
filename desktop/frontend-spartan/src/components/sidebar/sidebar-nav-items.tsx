/**
 * Sparta Agent – Sidebar Navigation Items
 *
 * Componentes especializados para renderizar ítems de la barra lateral:
 * - NavBadge (pill indicador "New" o badge genérico)
 * - NavItem (botón con soporte para tooltip, spinner, tours e interactividad)
 * - MoreMenuItem (versión desplegable en menú secundario "More")
 * - OpenChatFolderUnavailableItem (botón de abrir carpeta de chats bloqueado en web)
 * - WorkflowChoice, ImagesNavDisclosure, ImagesWorkflowList (submenú desplegable de flujos de imágenes)
 */

import {
  useState,
  type ReactNode,
} from "react";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChevronDown } from "lucide-react";
import {
  FolderOpenIcon,
  type ZapIcon,
} from "@hugeicons/core-free-icons";

/* eslint-disable no-restricted-imports */
import {
  isWorkflowEnabled,
  useImageWorkflowStore,
} from "@/features/images/stores/image-workflow-store";
import { WORKFLOW_TABS, type WorkflowId } from "@/features/images/workflows";
/* eslint-enable no-restricted-imports */

export function NavBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "nav-badge inline-flex shrink-0 items-center justify-center rounded-full border border-nav-beta-border px-[5px] pt-[3px] pb-[2px] text-[calc(0.5rem*var(--ui-font-scale,1))] font-medium uppercase leading-none tracking-[0.04em] text-nav-fg-muted antialiased subpixel-antialiased shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)]",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function NavItem({
  icon,
  label,
  active,
  disabled,
  onClick,
  children,
  dataTour,
  className,
  spinner,
  tooltip,
  alwaysTooltip,
  onIntent,
  badge,
  overlay,
  testId,
}: {
  icon: typeof ZapIcon;
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children?: ReactNode;
  dataTour?: string;
  className?: string;
  spinner?: boolean;
  onIntent?: () => void;
  testId?: string;
  tooltip?: string;
  alwaysTooltip?: boolean;
  badge?: string;
  overlay?: ReactNode;
}) {
  return (
    <SidebarMenuItem className={className}>
      <div className="relative">
        <SidebarMenuButton
          tooltip={tooltip ?? label}
          alwaysTooltip={alwaysTooltip && Boolean(tooltip)}
          disabled={disabled}
          onClick={onClick}
          onPointerEnter={disabled ? undefined : onIntent}
          onFocus={disabled ? undefined : onIntent}
          isActive={active}
          data-tour={dataTour}
          data-testid={testId}
          data-spinner={spinner ? "true" : undefined}
          className="sidebar-nav-btn h-[33px] rounded-full gap-[8.5px] pl-3 pr-2.5 font-medium group-data-[collapsible=icon]:px-2.5 group-data-[collapsible=icon]:!w-[32px] group-data-[collapsible=icon]:mx-auto"
        >
          <HugeiconsIcon
            icon={icon}
            strokeWidth={1.9}
            className="size-icon! shrink-0 translate-x-0.5 text-primary group-hover/menu-button:animate-icon-pop"
          />
          <span className="text-ui-14p5 leading-ui-19 tracking-nav">
            {label}
          </span>
          {badge && (
            <NavBadge
              label={badge}
              className="ml-auto group-data-[collapsible=icon]:hidden"
            />
          )}
          {spinner && (
            <Spinner className="ml-auto mr-1.5 size-3.5 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
          )}
        </SidebarMenuButton>
        {spinner && (
          <Spinner className="pointer-events-none absolute right-1 top-1 hidden size-2.5 text-muted-foreground group-data-[collapsible=icon]:block" />
        )}
        {overlay}
      </div>
      {children}
    </SidebarMenuItem>
  );
}

export function MoreMenuItem({
  icon,
  label,
  active,
  disabled,
  tooltip,
  badge,
  spinner,
  onSelect,
  onIntent,
}: {
  icon: typeof ZapIcon;
  label: string;
  active: boolean;
  disabled?: boolean;
  tooltip?: string;
  badge?: string;
  spinner?: boolean;
  onSelect: () => void;
  onIntent?: () => void;
}) {
  return (
    <DropdownMenuItem
      disabled={disabled}
      title={tooltip}
      onSelect={onSelect}
      onPointerEnter={disabled ? undefined : onIntent}
      onFocus={disabled ? undefined : onIntent}
      className={cn(active && "bg-accent/60")}
    >
      <HugeiconsIcon icon={icon} strokeWidth={1.75} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge && <NavBadge label={badge} />}
      {spinner && (
        <Spinner className="size-3.5 shrink-0 text-muted-foreground" />
      )}
    </DropdownMenuItem>
  );
}

export function OpenChatFolderUnavailableItem() {
  const t = useT();
  const [hintOpen, setHintOpen] = useState(false);

  return (
    <DropdownMenuItem
      aria-disabled={true}
      title={t("chat.menu.openFolderUnavailable")}
      className="relative opacity-50"
      onSelect={(event) => {
        event.preventDefault();
        setHintOpen(true);
      }}
      onPointerEnter={() => setHintOpen(true)}
      onPointerLeave={() => setHintOpen(false)}
      onFocus={() => setHintOpen(true)}
      onBlur={() => setHintOpen(false)}
    >
      <HugeiconsIcon
        icon={FolderOpenIcon}
        strokeWidth={1.75}
        className="size-icon"
      />
      <span>{t("chat.menu.openFolder")}</span>
      <Tooltip open={hintOpen}>
        <TooltipTrigger asChild={true}>
          <span
            aria-hidden={true}
            className="pointer-events-none absolute inset-y-0 right-0 w-0"
          />
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[220px]">
          {t("chat.menu.openFolderUnavailable")}
        </TooltipContent>
      </Tooltip>
    </DropdownMenuItem>
  );
}

export function WorkflowChoice({
  tab,
  active,
  enabled,
  onSelect,
}: {
  tab: (typeof WORKFLOW_TABS)[number];
  active: boolean;
  enabled: boolean;
  onSelect: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      disabled={!enabled}
      title={enabled ? undefined : t("images.workflowUnavailable")}
      onClick={onSelect}
      className={cn(
        "flex h-[29px] w-full items-center gap-2 rounded-full pl-3 pr-2.5 text-left font-medium text-nav-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60",
        !enabled && "opacity-40 hover:bg-transparent",
      )}
    >
      <HugeiconsIcon
        icon={tab.icon}
        strokeWidth={1.75}
        className="size-4 shrink-0"
      />
      <span className="min-w-0 flex-1 truncate text-ui-13 tracking-nav">
        {t(tab.labelKey)}
      </span>
    </button>
  );
}

export function ImagesNavDisclosure() {
  const t = useT();
  const expanded = useImageWorkflowStore((s) => s.navExpanded);
  const setExpanded = useImageWorkflowStore((s) => s.setNavExpanded);
  return (
    <button
      type="button"
      aria-label={t(expanded ? "images.hideWorkflows" : "images.showWorkflows")}
      aria-expanded={expanded}
      onClick={(e) => {
        e.stopPropagation();
        setExpanded(!expanded);
      }}
      className={cn(
        "sidebar-row-action group-hover/images-item:opacity-100 group-hover/images-item:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto",
        expanded && "is-disclosure-open",
      )}
    >
      <span className="sidebar-row-action-glyph">
        <ChevronDown
          className={cn(
            "size-3.5 transition-transform duration-200",
            !expanded && "-rotate-90",
          )}
        />
      </span>
    </button>
  );
}

export function ImagesWorkflowList({
  active,
  collapsed,
  onPick,
}: {
  active: boolean;
  collapsed: boolean;
  onPick: (id: WorkflowId) => void;
}) {
  const workflow = useImageWorkflowStore((s) => s.workflow);
  const supported = useImageWorkflowStore((s) => s.supported);
  const expanded = useImageWorkflowStore((s) => s.navExpanded);
  if (collapsed) return null;
  if (!active && !expanded) return null;
  const current = active ? workflow : null;
  return (
    <div className="mt-0.5 flex flex-col gap-px pl-5">
      {WORKFLOW_TABS.map((tab) => (
        <WorkflowChoice
          key={tab.id}
          tab={tab}
          active={current === tab.id}
          enabled={isWorkflowEnabled(tab.id, supported)}
          onSelect={() => onPick(tab.id)}
        />
      ))}
    </div>
  );
}
