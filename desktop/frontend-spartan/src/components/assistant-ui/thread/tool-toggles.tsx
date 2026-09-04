/**
 * Sparta Agent - Toggles de Herramientas y Estado Visual (ToolToggles)
 * Provee pills interactivos para Web Search, Code Execution, Image Generation,
 * Canvas (Artifacts) y el indicador dinámico de estado de herramientas (ToolStatusDisplay).
 */

import {
  useEffect,
  useRef,
  useState,
  type FC,
} from "react";
import { GlobeIcon, TerminalIcon } from "lucide-react";
import {
  CodeIcon,
  Image03Icon,
  PencilRulerIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useAuiState } from "@assistant-ui/react";
import { Spinner } from "@/components/ui/spinner";
import { parseExternalModelId } from "@/features/chat/external-providers";
import { useChatRuntimeStore } from "@/features/chat/stores/chat-runtime-store";
import { useExternalProvidersStore } from "@/features/chat/stores/external-providers-store";
import { applyQwenThinkingParams } from "@/features/chat/utils/qwen-params";
import { toolStatusKind } from "@/features/chat/utils/tool-status";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { PillGlyph } from "./reasoning-toggle";

export const WebSearchToggle: FC = () => {
  const t = useT();
  const toolsEnabled = useChatRuntimeStore((s) => s.toolsEnabled);
  const modelLoaded = useChatRuntimeStore(
    (s) => !!s.params.checkpoint && !s.modelLoading,
  );
  const checkpoint = useChatRuntimeStore((s) => s.params.checkpoint);
  const supportsTools = useChatRuntimeStore((s) => s.supportsTools);
  const supportsBuiltinWebSearch = useChatRuntimeStore(
    (s) => s.supportsBuiltinWebSearch,
  );
  const setToolsEnabled = useChatRuntimeStore((s) => s.setToolsEnabled);
  const setReasoningEnabled = useChatRuntimeStore((s) => s.setReasoningEnabled);
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
  const disabled = modelLoaded && !(supportsTools || supportsBuiltinWebSearch);

  if (!toolsEnabled) {
    return null;
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        const next = !toolsEnabled;
        setToolsEnabled(next);
        if (isKimiExternal) {
          setReasoningEnabled(!next, { persist: false });
          applyQwenThinkingParams(!next);
        }
      }}
      className="composer-pill-btn"
      data-pill-label={t("chat.composer.searchPill")}
      data-active={toolsEnabled && !disabled ? "true" : "false"}
      aria-label={toolsEnabled ? "Disable web search" : "Enable web search"}
    >
      <PillGlyph>
        <GlobeIcon className="size-3.5" />
      </PillGlyph>
      <span>{t("chat.composer.searchPill")}</span>
    </button>
  );
};

export const CodeToolsToggle: FC = () => {
  const t = useT();
  const codeToolsEnabled = useChatRuntimeStore((s) => s.codeToolsEnabled);
  const modelLoaded = useChatRuntimeStore(
    (s) => !!s.params.checkpoint && !s.modelLoading,
  );
  const supportsTools = useChatRuntimeStore((s) => s.supportsTools);
  const supportsBuiltinCodeExecution = useChatRuntimeStore(
    (s) => s.supportsBuiltinCodeExecution,
  );
  const setCodeToolsEnabled = useChatRuntimeStore((s) => s.setCodeToolsEnabled);
  const disabled =
    modelLoaded && !(supportsTools || supportsBuiltinCodeExecution);

  if (!codeToolsEnabled) {
    return null;
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setCodeToolsEnabled(!codeToolsEnabled)}
      className="composer-pill-btn"
      data-pill-label={t("chat.composer.codePill")}
      data-active={codeToolsEnabled && !disabled ? "true" : "false"}
      aria-label={
        codeToolsEnabled ? "Disable code execution" : "Enable code execution"
      }
    >
      <PillGlyph>
        <HugeiconsIcon
          icon={CodeIcon}
          className="size-3.5"
          strokeWidth={2}
        />
      </PillGlyph>
      <span>{t("chat.composer.codePill")}</span>
    </button>
  );
};

export const ImagesToggle: FC = () => {
  const t = useT();
  const modelLoaded = useChatRuntimeStore(
    (s) => !!s.params.checkpoint && !s.modelLoading,
  );
  const supportsBuiltinImageGeneration = useChatRuntimeStore(
    (s) => s.supportsBuiltinImageGeneration,
  );
  const imageToolsEnabled = useChatRuntimeStore((s) => s.imageToolsEnabled);
  const setImageToolsEnabled = useChatRuntimeStore(
    (s) => s.setImageToolsEnabled,
  );
  if (!supportsBuiltinImageGeneration || !imageToolsEnabled) {
    return null;
  }
  const disabled = !modelLoaded;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setImageToolsEnabled(!imageToolsEnabled)}
      className="composer-pill-btn"
      data-pill-label={t("chat.composer.imagesPill")}
      data-active={imageToolsEnabled && !disabled ? "true" : "false"}
      aria-label={
        imageToolsEnabled
          ? "Disable image generation"
          : "Enable image generation"
      }
    >
      <PillGlyph>
        <HugeiconsIcon
          icon={Image03Icon}
          className="size-3.5"
          strokeWidth={2}
        />
      </PillGlyph>
      <span>{t("chat.composer.imagesPill")}</span>
    </button>
  );
};

export const ArtifactsToggle: FC = () => {
  const artifactsEnabled = useChatRuntimeStore((s) => s.artifactsEnabled);
  const setArtifactsEnabled = useChatRuntimeStore((s) => s.setArtifactsEnabled);
  if (!artifactsEnabled) return null;

  return (
    <button
      type="button"
      onClick={() => setArtifactsEnabled(false)}
      className="composer-pill-btn"
      data-pill-label="Canvas"
      data-active="true"
      aria-label="Disable canvas"
    >
      <PillGlyph>
        <HugeiconsIcon
          icon={PencilRulerIcon}
          className="size-3.5"
          strokeWidth={2}
        />
      </PillGlyph>
      <span>Canvas</span>
    </button>
  );
};

export const ToolStatusDisplay: FC = () => {
  const threadListItemId = useAuiState(
    ({ threadListItem }) => threadListItem.remoteId,
  );
  const isThreadRunning = useAuiState(({ thread }) => thread.isRunning);
  const entry = useChatRuntimeStore((s) => {
    const unresolved = s.toolStatusByThreadId.__default;
    const own =
      s.toolStatusByThreadId[threadListItemId ?? ""] ??
      (isThreadRunning && unresolved?.length === 1 ? unresolved : undefined);
    return own?.[own.length - 1];
  });
  const toolStatus = entry?.status ?? null;
  const startedAt = entry?.startedAt ?? null;
  const [now, setNow] = useState(() => Date.now());
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    if (!startedAt) {
      if (!isThreadRunning) {
        setVisible(false);
      }
      return;
    }

    setNow(Date.now());

    let showTimer: ReturnType<typeof setTimeout> | undefined;
    if (!visibleRef.current) {
      showTimer = setTimeout(() => setVisible(true), 300);
    }

    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(interval);
      if (showTimer) {
        clearTimeout(showTimer);
      }
    };
  }, [startedAt, isThreadRunning]);

  if (!(toolStatus && startedAt && visible)) {
    return null;
  }
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const kind = toolStatusKind(toolStatus);
  const isNudging = kind === "nudge";
  const StatusIcon = kind === "terminal" ? TerminalIcon : GlobeIcon;
  return (
    <div
      data-testid="composer-tool-status"
      className="mb-1 flex w-full flex-row items-center gap-1.5 px-1 pt-0 pb-0.5"
    >
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[11px] text-primary leading-tight",
          !isNudging && "animate-pulse",
        )}
      >
        {isNudging ? (
          <Spinner className="size-3" label={toolStatus} />
        ) : (
          <StatusIcon className="size-3" />
        )}
        <span>{toolStatus}</span>
        <span className="tabular-nums opacity-60">{elapsed}s</span>
      </div>
    </div>
  );
};
