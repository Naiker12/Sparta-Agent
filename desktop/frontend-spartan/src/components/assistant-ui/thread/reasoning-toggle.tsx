import { translate as uiTranslate } from "@/i18n";
import { useT as useUiT } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { parseExternalModelId } from "@/features/chat/external-providers";
import { getExternalReasoningCapabilities } from "@/features/chat/provider-capabilities";
import { useChatRuntimeStore } from "@/features/chat/stores/chat-runtime-store";
import type { ReasoningEffort } from "@/features/chat/stores/chat-runtime-store/types";
import { useExternalProvidersStore } from "@/features/chat/stores/external-providers-store";
import { applyQwenThinkingParams } from "@/features/chat/utils/qwen-params";
import { ChevronDown, Lightbulb, RotateCcw, X, Zap } from "lucide-react";
import type { FC, ReactNode } from "react";
import { useId } from "react";

export const ThinkIcon: FC = () => <Lightbulb className="size-3.5" />;
export const PillGlyph: FC<{ children: ReactNode }> = ({ children }) => (
  <span className="composer-pill-glyph">
    {children}
    <X className="composer-pill-x" />
  </span>
);
const labels: Record<ReasoningEffort, string> = {
  get none() { return uiTranslate("settings.chat.pastedTextThresholdOff"); },
  get minimal() { return uiTranslate("ui.minimal"); },
  get low() { return uiTranslate("ui.light"); },
  get medium() { return uiTranslate("ui.balanced"); },
  get high() { return uiTranslate("ui.high"); },
  get xhigh() { return uiTranslate("ui.very_high"); },
  get max() { return uiTranslate("runSettings.max"); },
};

export const ReasoningToggle: FC<{ side?: "top" | "bottom" }> = ({
  side = "top",
}) => {
  const uiT = useUiT();

  const state = useChatRuntimeStore();
  const providers = useExternalProvidersStore((s) => s.providers);
  const selection = parseExternalModelId(state.params.checkpoint);
  const provider = providers.find((p) => p.id === selection?.providerId);
  const model =
    provider?.providerType === "openrouter" &&
    selection?.modelId === "openrouter/free" &&
    state.lastOpenRouterChosenModel
      ? state.lastOpenRouterChosenModel
      : selection?.modelId;
  const caps = selection
    ? getExternalReasoningCapabilities(provider?.providerType, model, {
        isReasoningProvider: provider?.isReasoningModel,
        baseUrl: provider?.baseUrl,
      })
    : null;
  const supported = caps?.supportsReasoning ?? state.supportsReasoning;
  const locked =
    (caps?.reasoningAlwaysOn ?? state.reasoningAlwaysOn) ||
    !(caps?.supportsReasoningOff ?? state.supportsReasoningOff);
  const style = caps?.reasoningStyle ?? state.reasoningStyle;
  const effort =
    style === "reasoning_effort" || style === "enable_thinking_effort";
  const allowed = caps?.reasoningEffortLevels ?? state.reasoningEffortLevels;
  const levels: ReasoningEffort[] = effort
    ? [
        ...(!locked ? ["none" as const] : []),
        ...allowed.filter((l) => l !== "none"),
      ]
    : [];
  const enabled = locked || state.reasoningEnabled;
  const effective = enabled
    ? levels.includes(state.reasoningEffort)
      ? state.reasoningEffort
      : (levels.find((l) => l !== "none") ?? "medium")
    : "none";
  const index = Math.max(0, levels.indexOf(effective));
  const label = effort
    ? labels[effective]
    : enabled
      ? uiTranslate("settings.appearance.custom.reduceMotion.on")
      : uiTranslate("settings.chat.pastedTextThresholdOff");
  const disabled = !state.params.checkpoint || state.modelLoading;
  const id = useId();
  if (!supported) return null;
  function choose(level: ReasoningEffort) {
    state.setReasoningEffort(level);
    state.setReasoningEnabled(level !== "none");
    applyQwenThinkingParams(level !== "none");
    if (level === "none") state.setPreserveThinking(false);
    if (
      provider?.providerType === "kimi" &&
      level !== "none" &&
      state.toolsEnabled
    )
      state.setToolsEnabled(false, { persist: false });
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          aria-label={uiT("ui.reasoning_effort_value0", {
            value0: String(label),
          })}
          title={uiT("ui.reasoning_effort_value0", { value0: String(label) })}
          className="composer-reasoning-selector shrink-0 rounded-full"
        >
          <Zap className="composer-reasoning-glyph hidden" />
          <span>{label}</span>
          <ChevronDown data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="end"
        sideOffset={8}
        className="w-[280px] rounded-2xl border shadow-xl"
      >
        <div className="flex items-center justify-between gap-3">
          <Zap className="size-4 text-muted-foreground" />
          <div className="min-w-0 flex-1 text-center">
            <p className="font-medium text-primary">{label}</p>
            <p className="truncate text-xs text-muted-foreground" title={model}>
              {model ?? uiT("hub.filters.reasoning")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={uiT("ui.reset_effort")}
            onClick={() =>
              choose(
                levels.includes("medium")
                  ? "medium"
                  : (levels.find((l) => l !== "none") ?? "medium"),
              )
            }
          >
            <RotateCcw />
          </Button>
        </div>
        {levels.length > 1 ? (
          <>
            <Slider
              min={0}
              max={levels.length - 1}
              step={1}
              value={[index]}
              onValueChange={([i]) => choose(levels[i])}
              aria-label={uiT("ui.reasoning_effort")}
              aria-valuetext={label}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{labels[levels[0]]}</span>
              <span>{labels[levels[levels.length - 1]]}</span>
            </div>
          </>
        ) : !locked ? (
          <label
            htmlFor={id}
            className="flex items-center justify-between gap-3"
          >
            {uiT("hub.filters.reasoning")}
            <Switch
              id={id}
              checked={enabled}
              onCheckedChange={(next) => choose(next ? "medium" : "none")}
            />
          </label>
        ) : null}
        <p className="text-xs leading-5 text-muted-foreground">
          {locked
            ? uiT("ui.this_model_requires_reasoning")
            : uiT(
                "ui.more_effort_may_improve_complex_tasks_and_increase_response_time",
              )}
        </p>
        {state.supportsPreserveThinking && (
          <label className="flex items-center justify-between gap-3">
            {uiT("ui.keep_reasoning")}
            <Switch
              checked={state.preserveThinking}
              disabled={!enabled}
              onCheckedChange={state.setPreserveThinking}
            />
          </label>
        )}
      </PopoverContent>
    </Popover>
  );
};
