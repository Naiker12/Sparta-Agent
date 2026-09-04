/**
 * Sparta Agent – Model Selector Model Row Component
 *
 * Componente que renderiza una fila de modelo (`ModelRow`):
 * - Metadatos de alineación de columnas fijas (`META_COLUMN`).
 * - Distintivos de capacidades (audio, video, imagen, vision).
 * - Indicador de VRAM/OOM, etiqueta de parámetros y tamaño de archivo.
 * - Tooltip dinámico con detalles de memoria, dirección Hugging Face y formato.
 */

import { useContext, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { VramFitStatus } from "@/lib/vram";
import { DotTag } from "@/features/hub";
import {
  detectCapabilities,
  type ModelCapabilities,
} from "./model-capabilities";
import { extractParamLabel } from "@/lib/model-size";
import {
  isUnslothOwner,
  parseMetaTokens,
  splitRepoLabel,
} from "./row-meta";
import {
  CapabilityIcons,
  CapabilityScope,
  DownloadedBadge,
  FormatTag,
  ParamChip,
  QuantChip,
  SizeText,
  VisionBadge,
  VramBadge,
  visibleCapabilityBadges,
} from "./model-badges-and-chips";

export type ModelRowOptionProps = {
  id: string;
  tabIndex: number;
  onFocus: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  "data-model-picker-option": true;
  "data-model-picker-active-option"?: "true";
  "aria-current"?: "true";
};

export const META_COLUMN = {
  quant: "min-[560px]:w-[7.2em]",
  badge: "min-w-min min-[560px]:w-[24px]",
  badgeMid: "min-w-min min-[560px]:w-[34px]",
  badgeWide: "min-w-min min-[560px]:w-[68px]",
  vram: "min-w-min min-[560px]:w-[4em]",
  param: "min-w-min min-[560px]:w-[3.6em]",
  paramWide: "min-w-min min-[560px]:w-[5.2em]",
  size: "min-w-min min-[560px]:w-[4.2em]",
  format: "min-[560px]:w-[14px]",
} as const;

export const ROW_ACTIONS_CLASS =
  "mr-0.5 flex w-[38px] shrink-0 items-center justify-end -space-x-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 has-[[data-state=open]]:opacity-100 [@media(hover:none)]:opacity-100";

export function ModelRow({
  label,
  meta,
  selected,
  loaded = false,
  onClick,
  vramStatus,
  vramEst,
  gpuGb,
  tooltipText,
  hubUrl,
  optionProps,
  onArrowDownIntoChildren,
  capabilities,
  hideOwner,
  downloaded,
  showVision,
  quantChip,
  tags,
  alignMeta,
  showSize,
  className,
}: {
  label: string;
  meta?: string | null;
  selected?: boolean;
  loaded?: boolean;
  onClick: () => void;
  vramStatus?: VramFitStatus | null;
  vramEst?: number;
  gpuGb?: number;
  tooltipText?: ReactNode;
  hubUrl?: string;
  optionProps?: ModelRowOptionProps;
  onArrowDownIntoChildren?: () => boolean;
  capabilities?: ModelCapabilities;
  hideOwner?: boolean;
  downloaded?: boolean;
  showVision?: boolean;
  quantChip?: string | null;
  tags?: string[];
  alignMeta?: "device" | "hub";
  showSize?: boolean;
  className?: string;
}) {
  const exceeds = vramStatus === "exceeds";
  const showVramTooltip =
    vramEst != null && vramEst > 0 && gpuGb != null && gpuGb > 0;
  const vramTooltipText =
    showVramTooltip && vramStatus
      ? exceeds
        ? `Needs ~${vramEst}GB VRAM (GPU: ${gpuGb}GB)`
        : vramStatus === "tight"
          ? `~${vramEst}GB VRAM (tight fit on ${gpuGb}GB)`
          : `~${vramEst}GB VRAM`
      : null;

  const { owner, name } = splitRepoLabel(label);
  const showOwner = !!owner && !hideOwner && !isUnslothOwner(owner);
  const parsed = parseMetaTokens(meta);
  const paramLabel = parsed.param ?? extractParamLabel(name) ?? null;
  const caps = capabilities ?? detectCapabilities({ id: label });
  const capabilityScope = useContext(CapabilityScope);
  const capabilityBadges = visibleCapabilityBadges(caps, capabilityScope);
  const showCaps = capabilityBadges.length > 0;
  const badgeColumn =
    capabilityScope === null || capabilityScope.length > 1
      ? META_COLUMN.badgeWide
      : capabilityScope.length === 1
        ? META_COLUMN.badgeMid
        : META_COLUMN.badge;
  const aligned = alignMeta !== undefined;
  const formatDot = parsed.formats[0]
    ? {
        tone: parsed.formats[0].tone,
        label: parsed.formats.map((f) => f.label).join(" · "),
      }
    : null;

  const content = (
    <button
      type="button"
      {...optionProps}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" && onArrowDownIntoChildren?.()) {
          event.preventDefault();
          return;
        }
        optionProps?.onKeyDown(event);
      }}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-full px-2 py-1.5 text-left text-sm transition-colors hover:bg-[#ececec] focus-visible:bg-[#ececec] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:hover:bg-[var(--sidebar-accent)] dark:focus-visible:bg-[var(--sidebar-accent)]",
        selected && "bg-[#ececec] dark:bg-[var(--sidebar-accent)]",
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 items-baseline">
        {aligned ? (
          <span
            className={cn(
              "mr-1 flex shrink-0 items-center self-center",
              META_COLUMN.format,
            )}
          >
            {formatDot ? <FormatTag {...formatDot} /> : null}
          </span>
        ) : formatDot ? (
          <span className="mr-1 flex shrink-0 items-center self-center">
            <FormatTag {...formatDot} />
          </span>
        ) : null}
        {showOwner ? (
          <span className="inline-flex min-w-0 max-w-[45%] shrink items-baseline text-ui-13 text-muted-foreground/90">
            <span className="truncate">{owner}</span>
            <span className="shrink-0 text-muted-foreground/45">/</span>
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {aligned && loaded && (
          <DotTag
            tone="success"
            label="Loaded"
            className="ml-2 h-[18px] shrink-0 gap-1 rounded-md px-1.5"
            dotClassName="size-[5px]"
          />
        )}
        {alignMeta === "device" ? (
          <span
            className={cn(
              "ml-1.5 flex shrink-0 items-center self-center text-ui-9",
              META_COLUMN.quant,
            )}
          >
            {quantChip ? <QuantChip label={quantChip} /> : null}
          </span>
        ) : quantChip ? (
          <span className="ml-2 shrink-0 rounded-md bg-black/[0.06] px-1.5 py-px font-mono text-ui-10 text-muted-foreground dark:bg-white/[0.1]">
            {quantChip}
          </span>
        ) : null}
        {tags && tags.length > 0 ? (
          <span className="ml-1.5 flex shrink-0 items-center gap-1 self-center">
            {tags.map((tag) => (
              <QuantChip key={tag} label={tag} />
            ))}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "ml-auto flex shrink-0 items-center",
          aligned ? "gap-1" : "gap-1.5",
        )}
      >
        {aligned ? (
          <span
            className={cn(
              "flex shrink-0 items-center justify-center gap-1 text-ui-10",
              badgeColumn,
            )}
          >
            {showCaps && <CapabilityIcons caps={caps} />}
            {showVision && <VisionBadge />}
            {downloaded && !loaded ? <DownloadedBadge /> : null}
          </span>
        ) : (
          <>
            {showCaps && <CapabilityIcons caps={caps} />}
            {showVision && <VisionBadge />}
            {loaded && (
              <DotTag
                tone="success"
                label="Loaded"
                className="h-[18px] gap-1 rounded-md px-1.5"
                dotClassName="size-[5px]"
              />
            )}
            {downloaded && !loaded ? <DownloadedBadge /> : null}
          </>
        )}
        {alignMeta === "hub" ? (
          <span
            className={cn(
              "flex shrink-0 items-center justify-end text-ui-9",
              META_COLUMN.vram,
            )}
          >
            <VramBadge status={vramStatus} />
          </span>
        ) : (
          <VramBadge status={vramStatus} />
        )}
        {aligned ? (
          <span
            className={cn(
              "flex shrink-0 justify-end text-ui-10",
              alignMeta === "hub" ? META_COLUMN.paramWide : META_COLUMN.param,
            )}
          >
            {paramLabel ? <ParamChip label={paramLabel} /> : null}
          </span>
        ) : paramLabel ? (
          <ParamChip label={paramLabel} />
        ) : null}
        {parsed.texts.map((text) => (
          <span key={text} className="text-ui-10 text-muted-foreground">
            {text}
          </span>
        ))}
        {alignMeta === "device" || showSize ? (
          <span
            className={cn(
              "shrink-0 whitespace-nowrap text-right font-mono text-ui-10 text-muted-foreground tabular-nums",
              META_COLUMN.size,
            )}
          >
            {parsed.size === undefined ? null : (
              <SizeText value={parsed.size} />
            )}
          </span>
        ) : aligned ? null : parsed.size !== undefined ? (
          <span className="font-mono text-ui-10 text-muted-foreground tabular-nums">
            <SizeText value={parsed.size} />
          </span>
        ) : null}
      </span>
    </button>
  );

  const hubUrlLine = hubUrl ? (
    <span className="block mt-1 text-ui-10 text-muted-foreground break-all">
      {hubUrl}
    </span>
  ) : null;

  const formatLine = formatDot ? (
    <span className="block text-ui-10 mt-1">{formatDot.label}</span>
  ) : null;

  const tooltipBody = vramTooltipText ? (
    <>
      {label}
      <span className="block text-ui-10 mt-1">{vramTooltipText}</span>
      {formatLine}
      {hubUrlLine}
    </>
  ) : tooltipText ? (
    <>
      {tooltipText}
      {formatLine}
      {hubUrlLine}
    </>
  ) : hubUrl ? (
    <>
      <span className="block break-words">{label}</span>
      {formatLine}
      {hubUrlLine}
    </>
  ) : formatLine ? (
    <>
      <span className="block break-words">{label}</span>
      {formatLine}
    </>
  ) : null;

  if (tooltipBody) {
    return (
      <Tooltip delayDuration={700}>
        <TooltipTrigger asChild={true}>{content}</TooltipTrigger>
        <TooltipContent
          side="left"
          className="tooltip-compact max-w-xs break-all"
        >
          {tooltipBody}
        </TooltipContent>
      </Tooltip>
    );
  }
  return content;
}
