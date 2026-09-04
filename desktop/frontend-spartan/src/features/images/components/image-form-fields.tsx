import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { InfoHint } from "@/components/ui/info-hint";
import { ParamSlider } from "@/features/chat";
import { cn } from "@/lib/utils";
import { resolvedBadge } from "@/lib/resolved-precision";
import type { DiffusionStatus } from "../api";
import { DIM_OPTIONS, snapDim } from "./image-constants";

/** Compact size control: type a value, or pick one of the usual sizes from the menu. */
export function DimensionSelect({
  icon,
  label,
  value,
  open,
  onOpenChange,
  onChange,
}: {
  icon: IconSvgElement;
  label: string;
  value: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(String(value));
  }
  const commit = () => {
    const typed = Number(draft);
    const next = snapDim(Number.isFinite(typed) && typed > 0 ? typed : value);
    setDraft(String(next));
    setLastValue(next);
    if (next !== value) onChange(next);
  };
  const pick = (n: number) => {
    setDraft(String(n));
    setLastValue(n);
    onChange(n);
  };
  return (
    <div className="flex h-9 flex-1 items-center gap-2 rounded-full border border-border bg-background px-3.5 transition-colors focus-within:border-ring dark:border-transparent dark:bg-white/[0.06] dark:focus-within:bg-white/[0.12]">
      <HugeiconsIcon
        icon={icon}
        strokeWidth={1.75}
        className="size-4 shrink-0 text-muted-foreground"
      />
      <input
        aria-label={label}
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        className="w-full min-w-0 bg-transparent text-sm tabular-nums outline-none"
      />
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger
          aria-label={`${label} presets`}
          className="-mr-1 shrink-0 cursor-pointer rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
          {DIM_OPTIONS.map((n) => (
            <DropdownMenuItem key={n} onSelect={() => pick(n)}>
              <span className="tabular-nums">{n}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** One row: label, track, value. The Images sliders are Chat ParamSlider. */
export function SliderField({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint?: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <ParamSlider
      inline={true}
      label={label}
      info={hint}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={onChange}
    />
  );
}

/** Matches the field-label style used across Studio (export/chat settings). */
export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-1">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        {hint && <InfoHint>{hint}</InfoHint>}
      </div>
      {children}
    </div>
  );
}

/** The badge for one Advanced control. */
export function ResolvedBadge({
  status,
  controlKey,
}: {
  status: DiffusionStatus | null;
  controlKey: string;
}) {
  const info = resolvedBadge(controlKey, status?.resolved?.[controlKey]);
  if (!info) return null;
  const badge = (
    <span
      className={cn(
        "shrink-0 rounded-sm px-1 py-px text-ui-9 font-medium uppercase tracking-wider",
        info.tone === "warn"
          ? "bg-destructive/15 text-destructive"
          : "bg-muted text-muted-foreground",
      )}
    >
      {info.label}
    </span>
  );
  if (!info.tooltip) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild={true}>{badge}</TooltipTrigger>
      <TooltipContent>{info.tooltip}</TooltipContent>
    </Tooltip>
  );
}

/** A compact labeled Select row for the Advanced Options panel. */
export function AdvancedSelect({
  label,
  hint,
  badge,
  desc,
  value,
  onValueChange,
  options,
}: {
  label: string;
  hint?: ReactNode;
  badge?: ReactNode;
  desc?: string;
  value: string;
  onValueChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium text-muted-foreground">
          {label}
          {hint && <InfoHint>{hint}</InfoHint>}
          {badge}
        </span>
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map(([v, l]) => (
              <SelectItem key={v} value={v} className="text-xs">
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {desc && <p className="text-ui-11 leading-snug text-muted-foreground/70">{desc}</p>}
    </div>
  );
}
