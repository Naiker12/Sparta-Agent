/**
 * Sparta Agent – Fine Tuned Rows Component
 *
 * Renderiza las filas de modelos adaptadores o fine-tuneados (LoRA, Merged, Full, GGUF exportado):
 * - Detección de subtipos de checkpoint y tags visuales.
 * - Soporte de expansión para directorios GGUF locales y variantes exportadas.
 * - Menú contextual con acciones de eliminación y configuración de inferencia.
 */

import { type Dispatch, type SetStateAction } from "react";
import { deleteFineTunedModel } from "@/features/chat";
import { ModelDeleteAction } from "./model-delete-action";
import { ModelLoadSettingsAction } from "./model-load-settings-action";
import { ModelRow, ROW_ACTIONS_CLASS } from "./model-row";
import { focusFirstChildOption, makeModelOptionKey, type useRovingModelList } from "./use-roving-model-list";
import type {
  DeletedModelRef,
  LoraModelOption,
  ModelSelectorChangeMeta,
} from "./types";
import { modelIdsMatchForPicker, ggufVariantsMatchForPicker } from "./row-identity";

import { GgufVariantExpander } from "./gguf-variant-expander";

export const TTS_CODECS = new Set(["snac", "csm", "bicodec", "dac"]);

export function hasGgufSuffix(id: string): boolean {
  return /-GGUF(?:$|-)/i.test(id);
}

export function isGgufRepo(id: string, hintedIsGguf?: boolean): boolean {
  return Boolean(hintedIsGguf) || hasGgufSuffix(id);
}

export function canDeleteLoraModel(model: LoraModelOption): boolean {
  const isTraining = model.source === "training";
  const isExported = model.source === "exported";
  const isExportedGguf = isExported && model.exportType === "gguf";
  return (isTraining || isExported) && !isExportedGguf;
}

export function audioPipelineTagFor(
  audioType?: string | null,
  isLocalCheckpoint = false,
): string | undefined {
  if (!audioType) return undefined;
  if (audioType === "whisper")
    return isLocalCheckpoint ? undefined : "automatic-speech-recognition";
  return TTS_CODECS.has(audioType) ? "text-to-speech" : undefined;
}

export function isRuntimeLoadedModel(
  loadedModelId: string | undefined,
  activeGgufVariant: string | null | undefined,
  modelId: string,
  variantPolicy: "none" | "required" | "ignore",
): boolean {
  if (!modelIdsMatchForPicker(loadedModelId, modelId)) return false;
  if (variantPolicy === "ignore") return true;
  const hasActiveGgufVariant = !ggufVariantsMatchForPicker(
    activeGgufVariant,
    null,
  );
  return variantPolicy === "required"
    ? hasActiveGgufVariant
    : !hasActiveGgufVariant;
}

export function FineTunedRows({
  adapters,
  value,
  loadedModelId,
  activeGgufVariant,
  onSelect,
  onConfigure,
  onModelsChange,
  deleteDisabled = false,
  loraModelList,
  expandedGguf,
  setExpandedGguf,
  gpu,
}: {
  adapters: LoraModelOption[];
  value?: string;
  loadedModelId?: string;
  activeGgufVariant?: string | null;
  onSelect: (id: string, meta: ModelSelectorChangeMeta) => void;
  onConfigure?: (id: string, meta: ModelSelectorChangeMeta) => void;
  onModelsChange?: (deletedModel?: DeletedModelRef) => void;
  deleteDisabled?: boolean;
  loraModelList: ReturnType<typeof useRovingModelList>;
  expandedGguf: string | null;
  setExpandedGguf: Dispatch<SetStateAction<string | null>>;
  gpu: {
    available: boolean;
    budgetKnown: boolean;
    memoryTotalGb: number;
    systemRamAvailableGb: number;
  };
}) {
  return (
    <>
      {adapters.map((adapter) => {
        const isLocal = adapter.source === "local";
        const isTraining = adapter.source === "training";
        const isExported = adapter.source === "exported";
        const isMerged = adapter.exportType === "merged";
        const isGguf = adapter.exportType === "gguf";
        const isExportedGguf = isExported && isGguf;
        const canDelete = canDeleteLoraModel(adapter);
        const isTrainingFull = isTraining && isMerged;
        const isLocalGgufDir =
          isLocal && (isGgufRepo(adapter.id) || isGgufRepo(adapter.name));
        const selectionMeta: ModelSelectorChangeMeta = {
          source: isLocal ? "local" : isExported ? "exported" : "lora",
          isLora: !isLocal && !isMerged && !isGguf,
          isDownloaded: true,
          isGguf: false,
          pipelineTag: audioPipelineTagFor(adapter.audioType, true),
        };
        const canConfigure = !(isLocalGgufDir || isExportedGguf);
        const optionKey = makeModelOptionKey("lora", adapter.id);
        const tag = isLocal
          ? isLocalGgufDir
            ? "GGUF"
            : "Local"
          : isGguf
            ? "GGUF"
            : isTrainingFull
              ? "Full"
              : isExported
                ? isMerged
                  ? "Merged"
                  : "LoRA"
                : "LoRA";
        const meta = isLocal
          ? isLocalGgufDir
            ? "GGUF"
            : "Local"
          : isTrainingFull
            ? "Full finetune"
            : isExported
              ? `${tag} · Exported`
              : tag;
        return (
          <div key={adapter.id}>
            <div className="group flex items-center">
              <div className="min-w-0 flex-1">
                <ModelRow
                  label={adapter.name}
                  meta={meta}
                  selected={value === adapter.id}
                  loaded={isRuntimeLoadedModel(
                    loadedModelId,
                    activeGgufVariant,
                    adapter.id,
                    isLocalGgufDir || isExportedGguf ? "required" : "none",
                  )}
                  optionProps={loraModelList.getOptionProps(
                    optionKey,
                    value === adapter.id,
                  )}
                  onClick={() => {
                    if (isLocalGgufDir || isExportedGguf) {
                      setExpandedGguf((prev) =>
                        prev === adapter.id ? null : adapter.id,
                      );
                    } else {
                      onSelect(adapter.id, selectionMeta);
                    }
                  }}
                  tooltipText={
                    <>
                      <span className="block break-words">{adapter.name}</span>
                      <span className="block mt-1 text-ui-10 text-muted-foreground break-all">
                        {adapter.id}
                      </span>
                    </>
                  }
                  onArrowDownIntoChildren={
                    expandedGguf === adapter.id
                      ? () => {
                          const focused = focusFirstChildOption(optionKey);
                          return focused;
                        }
                      : undefined
                  }
                  alignMeta="device"
                />
              </div>
              <span className={ROW_ACTIONS_CLASS}>
                {canConfigure && onConfigure && (
                  <ModelLoadSettingsAction
                    ariaLabel={`Inference settings for ${adapter.name}`}
                    onConfigure={() => onConfigure(adapter.id, selectionMeta)}
                  />
                )}
                {canDelete && (
                  <ModelDeleteAction
                    ariaLabel={`Delete ${adapter.name}`}
                    title="Delete fine-tuned model?"
                    description={
                      <>
                        This will remove{" "}
                        <span className="font-medium text-foreground">
                          {adapter.name}
                        </span>{" "}
                        from disk. This cannot be undone.
                      </>
                    }
                    successMessage={`Deleted ${adapter.name}`}
                    disabled={deleteDisabled}
                    onConfirm={() =>
                      deleteFineTunedModel({
                        modelPath: adapter.id,
                        source: isExported ? "exported" : "training",
                        exportType: adapter.exportType,
                      })
                    }
                    onDeleted={() => onModelsChange?.({ id: adapter.id })}
                  />
                )}
              </span>
            </div>
            {expandedGguf === adapter.id && (
              <GgufVariantExpander
                repoId={adapter.id}
                onSelect={onSelect}
                onConfigure={onConfigure}
                parentOptionKey={optionKey}
                onNavigatePastStart={() => loraModelList.focusOption(optionKey)}
                onNavigatePastEnd={() =>
                  loraModelList.moveFocus(optionKey, "next")
                }
                gpuGb={gpu.available ? gpu.memoryTotalGb : undefined}
                systemRamGb={gpu.systemRamAvailableGb || undefined}
                budgetKnown={gpu.budgetKnown}
                sourceOverride={isExportedGguf ? "exported" : undefined}
                variantActions={{
                  deleteTitle: "Delete exported GGUF variant?",
                  renderDeleteDescription: (quant) => (
                    <>
                      This will remove{" "}
                      <span className="font-medium text-foreground">
                        {adapter.name} ({quant})
                      </span>{" "}
                      from disk. This cannot be undone.
                    </>
                  ),
                  getDeleteSuccessMessage: (quant) =>
                    `Deleted ${adapter.name} ${quant}`,
                  deleteDisabled: deleteDisabled,
                  onDelete: isExportedGguf
                    ? async (quant) => {
                        await deleteFineTunedModel({
                          modelPath: adapter.id,
                          source: "exported",
                          exportType: "gguf",
                          ggufVariant: quant,
                        });
                        onModelsChange?.({
                          id: adapter.id,
                          ggufVariant: quant,
                        });
                      }
                    : undefined,
                }}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
