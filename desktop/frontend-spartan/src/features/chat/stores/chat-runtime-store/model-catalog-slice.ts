/**
 * Sparta Agent - Slice de Catálogo de Modelos y LoRAs
 * Gestiona el inventario de modelos, variantes GGUF, estado residente y errores de carga.
 */

import type { ChatLoraSummary, ChatModelSummary } from "../../types/runtime";

export interface ModelCatalogSliceState {
  models: ChatModelSummary[];
  loras: ChatLoraSummary[];
  modelsError: string | null;
  lastModelLoadError: string | null;
  activeGgufVariant: string | null;
  residentCheckpoint: string | null | undefined;
  activeModelIsLocal: boolean;
  ggufContextLength: number | null;
  ggufMaxContextLength: number | null;
  ggufNativeContextLength: number | null;
  modelRequiresTrustRemoteCode: boolean;
}

export interface ModelCatalogSliceActions {
  setModels: (models: ChatModelSummary[]) => void;
  setLoras: (loras: ChatLoraSummary[]) => void;
  setModelsError: (error: string | null) => void;
  setLastModelLoadError: (error: string | null) => void;
}

export type ModelCatalogSlice = ModelCatalogSliceState &
  ModelCatalogSliceActions;

export const initialModelCatalogState: ModelCatalogSliceState = {
  models: [],
  loras: [],
  modelsError: null,
  lastModelLoadError: null,
  activeGgufVariant: null,
  residentCheckpoint: undefined,
  activeModelIsLocal: false,
  ggufContextLength: null,
  ggufMaxContextLength: null,
  ggufNativeContextLength: null,
  modelRequiresTrustRemoteCode: false,
};

export const createModelCatalogSlice = (
  set: (partial: any) => void,
): ModelCatalogSlice => ({
  ...initialModelCatalogState,

  setModels: (models) => set({ models }),
  setLoras: (loras) => set({ loras }),
  setModelsError: (modelsError) => set({ modelsError }),
  setLastModelLoadError: (lastModelLoadError) => set({ lastModelLoadError }),
});
