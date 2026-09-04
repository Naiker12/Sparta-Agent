/**
 * Sparta Agent - Selector y Toggle de Razonamiento (ReasoningToggle)
 * Controla el nivel de esfuerzo de pensamiento ('none', 'low', 'medium', 'high', 'max')
 * y la persistencia de trazas de pensamiento para modelos compatibles.
 */

import { type FC, type ReactNode } from "react";
import {
  ArrowDownIcon as ArrowDownStandardIcon,
  LightbulbIcon as BulbIcon,
  XIcon,
} from "lucide-react";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { parseExternalModelId } from "@/features/chat/external-providers";
import { getExternalReasoningCapabilities } from "@/features/chat/provider-capabilities";
import { useChatRuntimeStore } from "@/features/chat/stores/chat-runtime-store";
import { useExternalProvidersStore } from "@/features/chat/stores/external-providers-store";
import { applyQwenThinkingParams } from "@/features/chat/utils/qwen-params";
import {
  thinkEffortAriaLabel,
  thinkToggleAriaLabel,
} from "../think-aria-label";
import { cn } from "@/lib/utils";

export const ThinkIcon: FC = () => <BulbIcon className="size-3.5" />;

export const PillGlyph: FC<{ children: ReactNode }> = ({ children }) => (
  <span className="composer-pill-glyph">
    {children}
    <XIcon className="composer-pill-x" />
  </span>
);

export interface ReasoningToggleProps {
  side?: "top" | "bottom";
}

export const ReasoningToggle: FC<ReasoningToggleProps> = ({ side = "bottom" }) => {
  const modelLoaded = useChatRuntimeStore(
    (s) => !!s.params.checkpoint && !s.modelLoading,
  );
  const checkpoint = useChatRuntimeStore((s) => s.params.checkpoint);
  const supportsReasoning = useChatRuntimeStore((s) => s.supportsReasoning);
  const reasoningAlwaysOn = useChatRuntimeStore((s) => s.reasoningAlwaysOn);
  const reasoningEnabled = useChatRuntimeStore((s) => s.reasoningEnabled);
  const setReasoningEnabled = useChatRuntimeStore((s) => s.setReasoningEnabled);
  const reasoningStyle = useChatRuntimeStore((s) => s.reasoningStyle);
  const reasoningEffort = useChatRuntimeStore((s) => s.reasoningEffort);
  const supportsReasoningOff = useChatRuntimeStore(
    (s) => s.supportsReasoningOff,
  );
  const reasoningEffortLevels = useChatRuntimeStore(
    (s) => s.reasoningEffortLevels,
  );
  const setReasoningEffort = useChatRuntimeStore((s) => s.setReasoningEffort);
  const lastOpenRouterChosenModel = useChatRuntimeStore(
    (s) => s.lastOpenRouterChosenModel,
  );
  const connectionsEnabled = useExternalProvidersStore(
    (s) => s.connectionsEnabled,
  );
  const externalProvidersAll = useExternalProvidersStore((s) => s.providers);
  const externalProviders = connectionsEnabled ? externalProvidersAll : [];
  const externalSelection = parseExternalModelId(checkpoint);
  const selectedExternalProvider =
    externalSelection != null
      ? externalProviders.find((p) => p.id === externalSelection.providerId)
      : undefined;
  const isKimiExternal = selectedExternalProvider?.providerType === "kimi";
  const toolsEnabled = useChatRuntimeStore((s) => s.toolsEnabled);
  const setToolsEnabled = useChatRuntimeStore((s) => s.setToolsEnabled);
  const supportsPreserveThinking = useChatRuntimeStore(
    (s) => s.supportsPreserveThinking,
  );
  const preserveThinking = useChatRuntimeStore((s) => s.preserveThinking);
  const setPreserveThinking = useChatRuntimeStore((s) => s.setPreserveThinking);
  const effectiveExternalModelId =
    selectedExternalProvider?.providerType === "openrouter" &&
    externalSelection?.modelId === "openrouter/free" &&
    lastOpenRouterChosenModel
      ? lastOpenRouterChosenModel
      : externalSelection?.modelId;
  const externalReasoningCaps =
    externalSelection != null
      ? getExternalReasoningCapabilities(
          selectedExternalProvider?.providerType,
          effectiveExternalModelId,
          {
            isReasoningProvider:
              selectedExternalProvider?.isReasoningModel === true,
            baseUrl: selectedExternalProvider?.baseUrl ?? null,
          },
        )
      : null;
  const effectiveReasoningStyle =
    externalReasoningCaps?.reasoningStyle ?? reasoningStyle;
  const effectiveReasoningAlwaysOn =
    externalReasoningCaps?.reasoningAlwaysOn ?? reasoningAlwaysOn;
  const effectiveSupportsReasoningOff =
    externalReasoningCaps?.supportsReasoningOff ?? supportsReasoningOff;
  const effectiveReasoningEffortLevels =
    externalReasoningCaps?.reasoningEffortLevels ?? reasoningEffortLevels;
  const effectiveSupportsReasoning =
    externalReasoningCaps?.supportsReasoning ?? supportsReasoning;
  const reasoningLockedOn =
    effectiveSupportsReasoning &&
    (effectiveReasoningAlwaysOn || !effectiveSupportsReasoningOff);
  const effectiveReasoningEnabled = reasoningLockedOn ? true : reasoningEnabled;
  const effectiveReasoningVisualEnabled =
    effectiveReasoningEnabled && reasoningEffort !== "none";
  const disabled = !(modelLoaded && effectiveSupportsReasoning);
  const formatEffortLabel = (level: typeof reasoningEffort): string => {
    if (level !== "xhigh")
      return level.charAt(0).toUpperCase() + level.slice(1);
    const normalized = externalSelection?.modelId?.trim().toLowerCase() ?? "";
    if (
      normalized.startsWith("claude-opus-4-6") ||
      normalized.startsWith("claude-sonnet-4-6")
    ) {
      return "Max";
    }
    return "Extra High";
  };
  const effortLabel = formatEffortLabel(reasoningEffort);

  if (!effectiveSupportsReasoning) {
    return null;
  }

  const isEffort =
    effectiveReasoningStyle === "reasoning_effort" ||
    effectiveReasoningStyle === "enable_thinking_effort";
  const useDropdown = isEffort || supportsPreserveThinking;
  const activeLook = isEffort
    ? reasoningLockedOn || (effectiveReasoningVisualEnabled && !disabled)
    : reasoningLockedOn || (effectiveReasoningEnabled && !disabled);

  if (useDropdown) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild={true}>
          <button
            type="button"
            disabled={disabled}
            className="unsloth-thinking-pill"
            data-pill-label="Thinking settings"
            data-active={activeLook ? "true" : "false"}
            aria-label={thinkEffortAriaLabel({
              modelLoaded,
              reasoningDisabled: disabled,
              reasoningEffort,
            })}
          >
            <ThinkIcon />
            {activeLook ? (
              <span className="unsloth-thinking-label">
                {isEffort ? `Thinking · ${effortLabel}` : "Thinking"}
              </span>
            ) : null}
            <ArrowDownStandardIcon className="unsloth-thinking-caret size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={side}
          align="end"
          avoidCollisions={true}
          className="unsloth-plus-menu unsloth-thinking-menu min-w-0 w-[176px]"
        >
          {isEffort ? (
            <>
              {effectiveSupportsReasoningOff && (
                <DropdownMenuItem
                  onSelect={() => {
                    setReasoningEnabled(false);
                    applyQwenThinkingParams(false);
                    setPreserveThinking(false);
                  }}
                >
                  <HugeiconsIcon
                    icon={Tick02Icon}
                    strokeWidth={2}
                    className={cn(
                      "unsloth-tick size-4",
                      effectiveReasoningVisualEnabled && "opacity-0",
                    )}
                  />
                  None
                </DropdownMenuItem>
              )}
              {effectiveReasoningEffortLevels
                .filter(
                  (level) => level !== "none" || !effectiveSupportsReasoningOff,
                )
                .map((level) => (
                  <DropdownMenuItem
                    key={level}
                    onSelect={() => {
                      setReasoningEffort(level);
                      setReasoningEnabled(true);
                      applyQwenThinkingParams(true);
                      if (isKimiExternal && toolsEnabled) {
                        setToolsEnabled(false, { persist: false });
                      }
                    }}
                  >
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      strokeWidth={2}
                      className={cn(
                        "unsloth-tick size-4",
                        !(
                          effectiveReasoningVisualEnabled &&
                          reasoningEffort === level
                        ) && "opacity-0",
                      )}
                    />
                    {formatEffortLabel(level)}
                  </DropdownMenuItem>
                ))}
            </>
          ) : (
            effectiveSupportsReasoningOff &&
            !reasoningLockedOn && (
              <DropdownMenuItem
                onSelect={() => {
                  const next = !reasoningEnabled;
                  setReasoningEnabled(next);
                  applyQwenThinkingParams(next);
                  if (!next) setPreserveThinking(false);
                  if (isKimiExternal && next && toolsEnabled) {
                    setToolsEnabled(false, { persist: false });
                  }
                }}
              >
                <HugeiconsIcon
                  icon={Tick02Icon}
                  strokeWidth={2}
                  className={cn(
                    "unsloth-tick size-4",
                    !effectiveReasoningEnabled && "opacity-0",
                  )}
                />
                Thinking
              </DropdownMenuItem>
            )
          )}
          {supportsPreserveThinking && (
            <DropdownMenuItem
              disabled={disabled}
              onSelect={(e) => {
                e.preventDefault();
                const next = !preserveThinking;
                setPreserveThinking(next);
                if (next) {
                  setReasoningEnabled(true);
                  applyQwenThinkingParams(true);
                }
              }}
            >
              <HugeiconsIcon
                icon={Tick02Icon}
                strokeWidth={2}
                className={cn(
                  "unsloth-tick size-4",
                  !preserveThinking && "opacity-0",
                )}
              />
              Preserve thinking
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled || reasoningLockedOn}
      aria-disabled={disabled || reasoningLockedOn}
      title={
        reasoningLockedOn
          ? "This model requires reasoning to stay on."
          : undefined
      }
      onClick={() => {
        if (reasoningLockedOn) return;
        const next = !reasoningEnabled;
        setReasoningEnabled(next);
        applyQwenThinkingParams(next);
        if (isKimiExternal && next && toolsEnabled) {
          setToolsEnabled(false, { persist: false });
        }
      }}
      className="unsloth-thinking-pill"
      data-pill-label="Thinking"
      data-active={activeLook ? "true" : "false"}
      aria-label={thinkToggleAriaLabel({
        reasoningLockedOn,
        modelLoaded,
        reasoningDisabled: disabled,
        effectiveReasoningEnabled,
      })}
    >
      <PillGlyph>
        <ThinkIcon />
      </PillGlyph>
      {activeLook ? (
        <span className="unsloth-thinking-label">Thinking</span>
      ) : null}
    </button>
  );
};
