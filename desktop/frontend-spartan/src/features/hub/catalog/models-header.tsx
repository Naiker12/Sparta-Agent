
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSettingsDialogStore } from "@/features/settings";
import {
  ChipIcon,
  CpuIcon,
  Database02Icon,
  PackageIcon,
  RamMemoryIcon,
  RemoveCircleIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { HfTokenIndicator } from "../components/hf-token-indicator";
import { PageHeading } from "../components/page-heading";
import { TransportToggle } from "./transport-toggle";
import { useT } from "@/i18n";

function StatPill({
  icon,
  label,
  value,
}: {
  icon: IconSvgElement;
  label: string;
  value: string;
}) {
  return (
    <span className="hub-stat-pill">
      <HugeiconsIcon icon={icon} strokeWidth={1.75} className="size-3.5" />
      <span className="hub-stat-pill-value">{value}</span>
      <span>{label}</span>
    </span>
  );
}

export function ModelsHeader({
  cachedCount,
  localCount,
  isDataset,
  gpuLabel,
  ramLabel,
  coreLabel,
  activeCheckpoint,
  activeGgufVariant,
  onTitleClick,
  onEject,
}: {
  cachedCount: number;
  localCount: number;
  isDataset: boolean;
  gpuLabel: string;
  ramLabel: string;
  coreLabel: string;
  activeCheckpoint: string | null;
  activeGgufVariant: string | null;
  onTitleClick: () => void;
  onEject: () => void;
}) {
  const t = useT();
  const openSettings = useSettingsDialogStore((s) => s.openDialog);
  return (
    <header className="font-heading flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <PageHeading
        title={isDataset ? t("hub.datasetsTitle") : t("hub.title")}
        onTitleClick={onTitleClick}
        subtitle={
          isDataset
            ? t("hub.datasetsSubtitle")
            : t("hub.modelsSubtitle")
        }
      />

      <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:flex-1">
        <HfTokenIndicator onOpenSettings={() => openSettings("general")} />
        <TransportToggle />
        <StatPill
          icon={PackageIcon}
          label={t("hub.cache")}
          value={String(cachedCount)}
        />
        <StatPill
          icon={Database02Icon}
          label={t("hub.local")}
          value={String(localCount)}
        />
        <StatPill icon={ChipIcon} label={t("hub.vram")} value={gpuLabel} />
        <StatPill icon={RamMemoryIcon} label={t("hub.ram")} value={ramLabel} />
        <StatPill icon={CpuIcon} label={t("hub.cpu")} value={coreLabel} />

        {activeCheckpoint && (
          <div className="hub-tag-soft ml-1 inline-flex items-center gap-1.5 px-2 py-1 text-ui-11p5">
            <span
              className="size-1.5 rounded-full bg-emerald-500"
              aria-hidden="true"
            />
            <Tooltip>
              <TooltipTrigger asChild={true}>
                <span className="max-w-[120px] cursor-default truncate font-medium text-primary">
                  {activeCheckpoint}
                  {activeGgufVariant ? ` · ${activeGgufVariant}` : ""}
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                sideOffset={6}
                className="tooltip-compact"
              >
                {activeCheckpoint}
                {activeGgufVariant ? ` · ${activeGgufVariant}` : ""}
              </TooltipContent>
            </Tooltip>
            <button
              type="button"
              onClick={onEject}
              className="-mr-0.5 ml-0.5 inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 text-ui-11 text-muted-foreground transition-colors hover:text-foreground"
            >
              <HugeiconsIcon
                icon={RemoveCircleIcon}
                strokeWidth={1.75}
                className="size-3"
              />
              {t("hub.eject")}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
