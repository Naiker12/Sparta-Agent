/**
 * Sparta Agent – Compare Views
 *
 * Módulo que agrupa la infraestructura visual y de orquestación
 * del modo de comparación de modelos (General y LoRA compare).
 *
 * Incluye:
 * - CompareContent (componente selector rápido base/lora vs general)
 * - ComparePane (columna individual para un hilo de modelo en compare)
 * - CompareShell (contenedor flex interactivo con composer compartido)
 * - LoraCompareContent (comparación rápida entre modelo base y adaptador fine-tuned)
 * - GeneralCompareHeader (encabezado con ModelSelector sincronizado)
 * - GeneralCompareContent (comparación general entre dos modelos arbitrarios)
 */

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import {
  ModelSelector,
  type DeletedModelRef,
  type ExternalConnectionRef,
  type ExternalModelOption,
  type LoraModelOption,
  type ModelOption,
  type ModelSelectorChangeMeta,
  type PerModelConfig,
} from "@/features/model-picker";
import { Thread } from "@/components/assistant-ui/thread";
import {
  ChatRuntimeProvider,
  useChatActive,
} from "@/features/chat/runtime-provider";
import {
  type CompareHandle,
  type CompareHandles,
  CompareHandlesProvider,
  RegisterCompareHandle,
  SharedComposer,
} from "@/features/chat/shared-composer";
import { useChatRuntimeStore } from "@/features/chat/stores/chat-runtime-store";
import { useChatPreferencesStore } from "@/features/chat/stores/chat-preferences-store";
import {
  isExpectedBackgroundChatStorageError,
  listStoredChatThreads,
} from "@/features/chat/utils/chat-history-storage";

export type CompareModelSelection = {
  id: string;
  isLora: boolean;
  ggufVariant?: string;
  isDiffusion?: boolean;
  config?: PerModelConfig;
};

export function modelMatchesDeleted(
  model: { id: string; ggufVariant?: string | null },
  deletedModel?: DeletedModelRef,
): boolean {
  if (!deletedModel || model.id !== deletedModel.id) return false;
  return (
    deletedModel.ggufVariant == null ||
    (model.ggufVariant ?? null) === deletedModel.ggufVariant
  );
}

/**
 * True when the loaded checkpoint is a LoRA, meaning a base-vs-fine-tuned
 * compare that uses the fast simultaneous adapter-toggle path.
 */
export function useIsLoraCompare(): boolean {
  return useChatRuntimeStore((s) => {
    const cp = s.params.checkpoint;
    const selected = cp ? s.loras.find((l) => l.id === cp) : undefined;
    return selected?.exportType === "lora";
  });
}

/**
 * A single column in the compare layout: one ChatRuntimeProvider and one
 * Thread with hideComposer (the composer is shared across panes).
 */
export function ComparePane({
  modelType,
  pairId,
  projectId,
  initialThreadId,
  handleName,
  header,
  borderClassName,
}: {
  modelType: "base" | "lora" | "model1" | "model2";
  pairId: string;
  projectId?: string | null;
  initialThreadId: string | undefined;
  handleName: string;
  header: ReactElement;
  borderClassName?: string;
}): ReactElement {
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden",
        borderClassName,
      )}
    >
      {header}
      <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden [&_.aui-thread-viewport]:px-6 lg:[&_.aui-thread-viewport]:px-10">
        <ChatRuntimeProvider
          modelType={modelType}
          pairId={pairId}
          projectId={projectId}
          initialThreadId={initialThreadId}
          syncActiveThreadId={false}
        >
          <RegisterCompareHandle name={handleName} />
          <Thread hideComposer={true} hideWelcome={true} />
        </ChatRuntimeProvider>
      </div>
    </div>
  );
}

/**
 * Shared shell for both compare variants: a flex column with the two panes
 * as siblings and the shared composer docked at the bottom.
 */
export function CompareShell({
  handlesRef,
  children,
  composer,
}: {
  handlesRef: CompareHandles;
  children: ReactElement;
  composer: ReactElement;
  }): ReactElement {
  const t = useT();
  const showModelDisclaimer = useChatPreferencesStore(
    (s) => s.showModelDisclaimer,
  );
  return (
    <CompareHandlesProvider handlesRef={handlesRef}>
      <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col">
        <div
          data-tour="chat-compare-view"
          className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col pt-[var(--studio-content-top-inset,0px)] md:flex-row"
        >
          {children}
        </div>
        <div className="shrink-0 bg-background pl-5 pr-5 md:pr-[30px] pb-2 pt-1">
          <div className="mx-auto w-full max-w-[48rem]">{composer}</div>
          {showModelDisclaimer && (
            <p className="composer-footer-note">
              {t("chat.composer.disclaimer")}
            </p>
          )}
        </div>
      </div>
    </CompareHandlesProvider>
  );
}

/** Fast path: same model, adapter on/off, simultaneous generation. */
export const LoraCompareContent = memo(function LoraCompareContent({
  pairId,
  onExitCompare,
  projectId,
}: {
  pairId: string;
  onExitCompare?: () => void;
  projectId?: string | null;
}): ReactElement {
  const handlesRef = useRef<Record<string, CompareHandle>>({});
  const [baseThreadId, setBaseThreadId] = useState<string>();
  const [loraThreadId, setLoraThreadId] = useState<string>();
  const active = useChatActive();

  const compareRunning = useChatRuntimeStore(
    (s) => Object.keys(s.runningByThreadId).length > 0,
  );

  useEffect(() => {
    if (compareRunning) return;
    let isActive = true;
    listStoredChatThreads({ pairId })
      .then((threads) => {
        if (!isActive) return;
        setBaseThreadId(threads.find((t) => t.modelType === "base")?.id);
        setLoraThreadId(threads.find((t) => t.modelType === "lora")?.id);
      })
      .catch((error) => {
        if (!isExpectedBackgroundChatStorageError(error)) {
          throw error;
        }
      });
    return () => {
      isActive = false;
    };
  }, [pairId, compareRunning]);

  return (
    <CompareShell
      handlesRef={handlesRef}
      composer={
        active ? (
          <SharedComposer
            handlesRef={handlesRef}
            onExitCompare={onExitCompare}
            model1ThreadId={baseThreadId}
            model2ThreadId={loraThreadId}
          />
        ) : (
          <></>
        )
      }
    >
      <>
        <ComparePane
          modelType="base"
          pairId={pairId}
          projectId={projectId}
          initialThreadId={baseThreadId}
          handleName="base"
          header={
            <div className="shrink-0 px-3 py-1.5">
              <span className="text-ui-10 font-semibold uppercase tracking-wider text-muted-foreground">
                Base Model
              </span>
            </div>
          }
        />
        <ComparePane
          modelType="lora"
          pairId={pairId}
          projectId={projectId}
          initialThreadId={loraThreadId}
          handleName="lora"
          borderClassName="border-t border-border/60 md:border-t-0 md:border-l"
          header={
            <div className="shrink-0 px-3 py-1.5 text-start md:text-end md:pr-[calc(4rem+var(--studio-chat-header-right-inset,var(--studio-window-control-inset,0px)))]">
              <span className="text-ui-10 font-semibold uppercase tracking-wider text-primary">
                Fine-tuned
              </span>
            </div>
          }
        />
      </>
    </CompareShell>
  );
});

/**
 * Per-pane header (inside GeneralCompareContent) with the model selector,
 * aligned to the global topbar height.
 */
export function GeneralCompareHeader({
  models,
  loraModels,
  externalModels,
  externalConnections,
  value,
  selectedConfig,
  selectedGgufVariant,
  onValueChange,
  onFoldersChange,
  onModelsChange,
  deleteDisabled,
  side,
}: {
  models: ModelOption[];
  loraModels: LoraModelOption[];
  externalModels: ExternalModelOption[];
  externalConnections: ExternalConnectionRef[];
  value: string;
  selectedConfig?: PerModelConfig | null;
  selectedGgufVariant?: string | null;
  onValueChange: (
    id: string,
    meta: ModelSelectorChangeMeta,
  ) => void;
  onFoldersChange?: () => void;
  onModelsChange?: (deletedModel?: DeletedModelRef) => void;
  deleteDisabled?: boolean;
  side: "left" | "right";
}): ReactElement {
  const active = useChatActive();
  const [selectorOpen, setSelectorOpen] = useState(false);
  const { pinned } = useSidebar();

  return (
    <div
      className={cn(
        "pointer-events-none relative z-40 flex h-[48px] shrink-0 items-start gap-2 bg-background pt-[var(--studio-chat-header-padding-top,11px)]",
        side === "left"
          ? pinned
            ? "pl-12 pr-3 md:pl-2"
            : "pl-12 pr-3 md:pl-[calc(0.5rem+max(0px,var(--studio-mac-traffic-light-inset,0px)-var(--sidebar-width-icon,3rem)))]"
          : "pl-3 pr-[calc(3rem+var(--studio-chat-header-right-inset,var(--studio-window-control-inset,0px)))]",
      )}
    >
      <ModelSelector
        models={models}
        loraModels={loraModels}
        externalModels={externalModels}
        externalConnections={externalConnections}
        value={value}
        selectedConfig={selectedConfig}
        selectedGgufVariant={selectedGgufVariant}
        onValueChange={onValueChange}
        onFoldersChange={onFoldersChange}
        onModelsChange={onModelsChange}
        deleteDisabled={deleteDisabled}
        variant="ghost"
        className="pointer-events-auto max-w-[80%] !h-[var(--studio-chat-control-height,34px)]"
        open={active && selectorOpen}
        onOpenChange={(open) => setSelectorOpen(active && open)}
      />
    </div>
  );
}

/** General path: any two models, sequential load → generate. */
export const GeneralCompareContent = memo(function GeneralCompareContent({
  pairId,
  projectId,
  models,
  loraModels,
  externalModels,
  externalConnections,
  onFoldersChange,
  onModelsChange,
  deleteDisabled,
  onExitCompare,
}: {
  pairId: string;
  projectId?: string | null;
  models: ModelOption[];
  loraModels: LoraModelOption[];
  externalModels: ExternalModelOption[];
  externalConnections: ExternalConnectionRef[];
  onFoldersChange?: () => void;
  onModelsChange?: (deletedModel?: DeletedModelRef) => void;
  deleteDisabled?: boolean;
  onExitCompare?: () => void;
}): ReactElement {
  const handlesRef = useRef<Record<string, CompareHandle>>({});
  const [model1ThreadId, setModel1ThreadId] = useState<string>();
  const [model2ThreadId, setModel2ThreadId] = useState<string>();

  const globalCheckpoint = useChatRuntimeStore((s) => s.params.checkpoint);
  const globalGgufVariant = useChatRuntimeStore((s) => s.activeGgufVariant);
  const globalIsDiffusion = useChatRuntimeStore((s) => s.loadedIsDiffusion);
  const active = useChatActive();
  const compareRunning = useChatRuntimeStore(
    (s) => Object.keys(s.runningByThreadId).length > 0,
  );
  const [model1, setModel1] = useState<CompareModelSelection>({
    id: globalCheckpoint || "",
    isLora: false,
    ggufVariant: globalGgufVariant ?? undefined,
    isDiffusion: globalIsDiffusion,
  });
  const [model2, setModel2] = useState<CompareModelSelection>({
    id: "",
    isLora: false,
  });

  const handleModelsChange = useCallback(
    (deletedModel?: DeletedModelRef) => {
      if (modelMatchesDeleted(model1, deletedModel)) {
        setModel1({ id: "", isLora: false });
      }
      if (modelMatchesDeleted(model2, deletedModel)) {
        setModel2({ id: "", isLora: false });
      }
      onModelsChange?.(deletedModel);
    },
    [model1, model2, onModelsChange],
  );

  useEffect(() => {
    if (compareRunning) return;
    let isActive = true;
    listStoredChatThreads({ pairId })
      .then((threads) => {
        if (!isActive) return;
        setModel1ThreadId(
          threads.find(
            (t) => t.modelType === "model1" || t.modelType === "base",
          )?.id,
        );
        setModel2ThreadId(
          threads.find(
            (t) => t.modelType === "model2" || t.modelType === "lora",
          )?.id,
        );
      })
      .catch((error) => {
        if (!isExpectedBackgroundChatStorageError(error)) {
          throw error;
        }
      });
    return () => {
      isActive = false;
    };
  }, [pairId, compareRunning]);

  return (
    <CompareShell
      handlesRef={handlesRef}
      composer={
        active ? (
          <SharedComposer
            handlesRef={handlesRef}
            model1={model1}
            model2={model2}
            onExitCompare={onExitCompare}
            model1ThreadId={model1ThreadId}
            model2ThreadId={model2ThreadId}
          />
        ) : (
          <></>
        )
      }
    >
      <>
        <ComparePane
          modelType="model1"
          pairId={pairId}
          projectId={projectId}
          initialThreadId={model1ThreadId}
          handleName="model1"
          header={
            <GeneralCompareHeader
              side="left"
              models={models}
              loraModels={loraModels}
              externalModels={externalModels}
              externalConnections={externalConnections}
              value={model1.id}
              selectedConfig={model1.config}
              selectedGgufVariant={model1.ggufVariant}
              onValueChange={(id, meta) =>
                setModel1({
                  id,
                  isLora: meta.isLora,
                  ggufVariant: meta.ggufVariant,
                  isDiffusion: meta.isDiffusion,
                  config: meta.config,
                })
              }
              onFoldersChange={onFoldersChange}
              onModelsChange={handleModelsChange}
              deleteDisabled={deleteDisabled}
            />
          }
        />
        <ComparePane
          modelType="model2"
          pairId={pairId}
          projectId={projectId}
          initialThreadId={model2ThreadId}
          handleName="model2"
          borderClassName="border-t border-sidebar-border md:border-t-0 md:border-l"
          header={
            <GeneralCompareHeader
              side="right"
              models={models}
              loraModels={loraModels}
              externalModels={externalModels}
              externalConnections={externalConnections}
              value={model2.id}
              selectedConfig={model2.config}
              selectedGgufVariant={model2.ggufVariant}
              onValueChange={(id, meta) =>
                setModel2({
                  id,
                  isLora: meta.isLora,
                  ggufVariant: meta.ggufVariant,
                  isDiffusion: meta.isDiffusion,
                  config: meta.config,
                })
              }
              onFoldersChange={onFoldersChange}
              onModelsChange={handleModelsChange}
              deleteDisabled={deleteDisabled}
            />
          }
        />
      </>
    </CompareShell>
  );
});

export const CompareContent = memo(function CompareContent({
  pairId,
  projectId,
  models,
  loraModels,
  externalModels,
  externalConnections,
  onFoldersChange,
  onModelsChange,
  deleteDisabled,
  onExitCompare,
}: {
  pairId: string;
  projectId?: string | null;
  models: ModelOption[];
  loraModels: LoraModelOption[];
  externalModels: ExternalModelOption[];
  externalConnections: ExternalConnectionRef[];
  onFoldersChange?: () => void;
  onModelsChange?: (deletedModel?: DeletedModelRef) => void;
  deleteDisabled?: boolean;
  onExitCompare?: () => void;
}): ReactElement {
  const isLoraCompare = useIsLoraCompare();

  return isLoraCompare ? (
    <LoraCompareContent
      pairId={pairId}
      onExitCompare={onExitCompare}
      projectId={projectId}
    />
  ) : (
    <GeneralCompareContent
      pairId={pairId}
      projectId={projectId}
      models={models}
      loraModels={loraModels}
      externalModels={externalModels}
      externalConnections={externalConnections}
      onFoldersChange={onFoldersChange}
      onModelsChange={onModelsChange}
      deleteDisabled={deleteDisabled}
      onExitCompare={onExitCompare}
    />
  );
});
