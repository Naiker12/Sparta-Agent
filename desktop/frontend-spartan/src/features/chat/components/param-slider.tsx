import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import type { ReactNode } from "react";

/** A small, reusable numeric control for non-chat settings (for example audio). */
export function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  displayValue,
  info,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  displayValue?: string;
  info?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">
          {label} {info}
        </span>
        <Input
          type="number"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          value={value}
          aria-label={label}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
          }}
          className="h-8 w-20 text-right"
        />
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        disabled={disabled}
        onValueChange={([next]) => onChange(next)}
      />
      {displayValue ? <span className="sr-only">{displayValue}</span> : null}
    </div>
  );
}
