/**
 * Sparta Agent - Slice de Parámetros de Inferencia y Presets
 * Gestiona temperatura, topP, contextLength, presets de usuario y memoria por modelo.
 */

import type { ChatPresetSource, Preset } from "../../presets/preset-policy";
import {
  DEFAULT_INFERENCE_PARAMS,
  type InferenceParams,
} from "../../types/runtime";

export type PersistedInferenceParams = Partial<InferenceParams>;

export interface InferenceParamsSliceState {
  params: InferenceParams;
  paramsByModel: Record<string, PersistedInferenceParams>;
  rememberParamsPerModel: boolean;
  customPresets: Preset[];
  activePreset: string;
  activePresetSource: ChatPresetSource;
}

export interface InferenceParamsSliceActions {
  setParams: (params: InferenceParams) => void;
  patchParams: (patch: Partial<InferenceParams>) => void;
  setRememberParamsPerModel: (remember: boolean) => void;
  setCustomPresets: (presets: Preset[]) => void;
  setActivePreset: (name: string) => void;
  setActivePresetSource: (source: ChatPresetSource) => void;
}

export type InferenceParamsSlice = InferenceParamsSliceState &
  InferenceParamsSliceActions;

export const initialInferenceParamsState: InferenceParamsSliceState = {
  params: DEFAULT_INFERENCE_PARAMS,
  paramsByModel: {},
  rememberParamsPerModel: true,
  customPresets: [],
  activePreset: "Default",
  activePresetSource: "builtin-default",
};
