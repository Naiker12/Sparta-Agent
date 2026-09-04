/**
 * Sparta Agent – Model Selector Badges & Chips
 *
 * Componentes visuales atómicos para filas de modelos:
 * - ListLabel: Etiqueta de encabezado de sección con soporte de colapso y dividers.
 * - FormatTag: Indicador visual en punto de color para formato de modelo (GGUF, MLX, Safetensors, Adapter).
 * - CapabilityIcons: Íconos de capacidades (video, imagen, audio).
 * - VisionBadge: Distintivo de soporte para procesamiento de imágenes.
 * - ParamChip: Chip de conteo de parámetros (ej. 7B, 27B).
 * - DownloadedBadge: Indicador de modelo ya descargado en disco.
 * - VramBadge: Estado de ajuste de VRAM (OOM o TIGHT).
 * - QuantChip: Chip mono con la cuantización del modelo.
 * - SizeText: Formato mono legible para tamaño de archivo.
 * - formatBytes: Función pura de conversión de bytes a unidades decimales.
 */

import { useContext, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AudioWave01Icon,
  Download01Icon,
  FlimSlateIcon,
  HelpCircleIcon,
  Image03Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import type { FormatTone } from "./row-meta";
import type { VramFitStatus } from "@/lib/vram";
import type { ModelCapabilities } from "./model-capabilities";
import { createContext } from "react";

export function ListLabel({
  children,
  icon,
  action,
  collapsed,
  onToggle,
  divider,
}: {
  children: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  collapsed?: boolean;
  onToggle?: () => void;
  divider?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-1 px-2.5 pb-1",
        divider ? "mt-3 border-t border-border/50 pt-3" : "pt-3",
      )}
    >
      <span className="flex items-center gap-1.5 text-ui-10 font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {children}
      </span>
      {(action || onToggle) && (
        <div className="flex items-center gap-0.5">
          {action}
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              aria-label={collapsed ? "Expand section" : "Collapse section"}
              className="shrink-0 rounded p-1 text-muted-foreground/60 transition-colors hover:text-foreground"
            >
              {collapsed ? (
                <ChevronRightIcon className="size-3" />
              ) : (
                <ChevronDownIcon className="size-3" />
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let value = bytes;
  while (value >= 1000 && i < units.length - 1) {
    value /= 1000;
    i += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)}${units[i]}`;
}

export const CAPABILITY_BADGES: {
  key: keyof ModelCapabilities;
  title: string;
  Glyph: (props: { className: string }) => ReactNode;
}[] = [
  {
    key: "videoGen",
    title: "Generates video",
    Glyph: (props) => (
      <HugeiconsIcon icon={FlimSlateIcon} strokeWidth={1.8} {...props} />
    ),
  },
  {
    key: "imageGen",
    title: "Generates images",
    Glyph: (props) => (
      <HugeiconsIcon icon={Image03Icon} strokeWidth={1.8} {...props} />
    ),
  },
  {
    key: "audio",
    title: "Audio",
    Glyph: (props) => (
      <HugeiconsIcon icon={AudioWave01Icon} strokeWidth={1.8} {...props} />
    ),
  },
];

export const CapabilityScope = createContext<
  readonly (keyof ModelCapabilities)[] | null
>(null);

export const MAX_CAPABILITY_BADGES = 3;

export function visibleCapabilityBadges(
  caps: ModelCapabilities,
  scope: readonly (keyof ModelCapabilities)[] | null,
) {
  return CAPABILITY_BADGES.filter(
    (b) => caps[b.key] && (scope?.includes(b.key) ?? true),
  ).slice(0, MAX_CAPABILITY_BADGES);
}

export function CapabilityIcons({ caps }: { caps: ModelCapabilities }) {
  const scope = useContext(CapabilityScope);
  return (
    <>
      {visibleCapabilityBadges(caps, scope).map(({ key, title, Glyph }) => (
        <span
          key={key}
          title={title}
          aria-label={title}
          className="flex size-[18px] shrink-0 items-center justify-center rounded-md border border-border/60 text-muted-foreground"
        >
          <Glyph className="size-3" />
        </span>
      ))}
    </>
  );
}

export function VisionBadge() {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild={true}>
        <span
          aria-label="Vision"
          className="flex h-[18px] shrink-0 items-center justify-center rounded-md border border-border/60 px-1.5 text-indigo-700 dark:text-indigo-300"
        >
          <HugeiconsIcon icon={ViewIcon} className="size-3" strokeWidth={1.8} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="tooltip-compact">
        This model can process image inputs
      </TooltipContent>
    </Tooltip>
  );
}

export function ParamChip({ label }: { label: string }) {
  return (
    <span className="whitespace-nowrap rounded-md border border-border/60 px-1.5 py-px text-ui-10 font-medium text-muted-foreground tabular-nums">
      {label}
    </span>
  );
}

export const FORMAT_TONE_DOT: Record<FormatTone, string> = {
  gguf: "bg-format-gguf",
  mlx: "bg-format-mlx",
  checkpoint: "bg-format-checkpoint",
  adapter: "bg-format-adapter",
};

export function FormatTag({ tone, label }: { tone: FormatTone; label: string }) {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild={true}>
        <span
          aria-label={label}
          className="flex size-[14px] shrink-0 items-center justify-center"
        >
          <span
            aria-hidden="true"
            className={cn("size-[5px] rounded-full", FORMAT_TONE_DOT[tone])}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="tooltip-compact">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function DownloadedBadge() {
  return (
    <span
      title="Already downloaded"
      aria-label="Already downloaded"
      className="flex h-[18px] shrink-0 items-center justify-center text-status-success"
    >
      <HugeiconsIcon
        icon={Download01Icon}
        className="size-3"
        strokeWidth={1.8}
      />
    </span>
  );
}

export function VramBadge({ status }: { status?: VramFitStatus | null }) {
  if (status === "exceeds") {
    return (
      <span className="whitespace-nowrap text-ui-9 font-medium !text-red-700 !bg-red-50 dark:!text-red-300 dark:!bg-red-500/15 px-1.5 py-0.5 rounded">
        OOM
      </span>
    );
  }
  if (status === "tight") {
    return (
      <span className="whitespace-nowrap text-ui-9 font-medium !text-amber-400">
        TIGHT
      </span>
    );
  }
  return null;
}

export const SIZE_PARTS_RE = /^(~?)([\d.]+)\s*([A-Za-z]+)$/;

export function SizeText({ value }: { value: string }) {
  const parts = SIZE_PARTS_RE.exec(value);
  if (!parts) {
    return <>{value}</>;
  }
  const [, approx, digits, unit] = parts;
  const [whole, fraction] = digits.split(".");
  return (
    <>
      {approx}
      {whole}
      {fraction === undefined ? null : (
        <>
          <span className="mx-[-0.1em]">.</span>
          {fraction}
        </>
      )}
      <span className="ml-[0.14em]">{unit}</span>
    </>
  );
}

export function QuantChip({ label }: { label: string }) {
  return (
    <span className="inline-flex h-[18px] max-w-full items-center overflow-hidden rounded-md bg-black/[0.06] px-1 font-mono text-ui-9 text-muted-foreground dark:bg-white/[0.1]">
      {label}
    </span>
  );
}
