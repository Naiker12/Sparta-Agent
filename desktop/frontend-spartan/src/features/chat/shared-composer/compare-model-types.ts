/**
 * Sparta Agent – Compare Model Types & Helpers
 *
 * Tipos de selección de modelos para el modo compare y utilidades de
 * configuración espectulativa.
 *
 * Responsabilidad única (SRP): lógica de configuración de modelos en compare,
 * sin dependencias de UI ni de estado React.
 */

import { DRAFT_N_MAX_SPEC_TYPES } from "@/lib/speculative-modes";
import type { PerModelConfig } from "@/features/model-picker";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Selección de modelo en un pane de comparación. */
export type CompareModelSelection = {
  id: string;
  isLora: boolean;
  ggufVariant?: string;
  isDiffusion?: boolean;
  config?: PerModelConfig;
};

// ---------------------------------------------------------------------------
// Helpers de configuración
// ---------------------------------------------------------------------------

/**
 * Limpia el valor de chat template personalizado: retorna `null` si está vacío
 * o es solo espacio en blanco.
 */
export function cleanCompareChatTemplate(
  value: string | null | undefined,
): string | null {
  return value?.trim() ? value : null;
}

/**
 * Resuelve el `draft_n` máximo para el modo especulativo en compare.
 * Solo aplica para tipos especulativos que requieren `draft_n` (DRAFT_N_MAX_SPEC_TYPES).
 */
export function resolveCompareSpecDraftNMax(
  speculativeType: string | null,
  value: number | null,
): number | null {
  return speculativeType != null && DRAFT_N_MAX_SPEC_TYPES.has(speculativeType)
    ? value
    : null;
}
