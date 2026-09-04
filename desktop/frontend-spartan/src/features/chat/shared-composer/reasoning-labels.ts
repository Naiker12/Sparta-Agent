/**
 * Sparta Agent – Reasoning Label Helpers
 *
 * Utilidades de formateo de etiquetas para los controles de razonamiento
 * del compositor compartido (modo compare y single).
 *
 * Responsabilidad única (SRP): transformar valores internos de `ReasoningEffort`
 * y flags de razonamiento en cadenas de texto listas para el UI.
 */

import type { ReasoningEffort } from "@/features/chat/stores/chat-runtime-store";

/**
 * Formatea el nivel de esfuerzo de razonamiento como etiqueta visible.
 * Tiene en cuenta modelos Claude con alias de nivel "Extra High" → "Max".
 */
export function formatReasoningEffortLabel(
  level: ReasoningEffort,
  modelId?: string,
): string {
  if (level === "max") return "Max";
  if (level === "xhigh") {
    const normalized = modelId?.trim().toLowerCase() ?? "";
    if (
      normalized.startsWith("claude-opus-4-6") ||
      normalized.startsWith("claude-sonnet-4-6")
    ) {
      return "Max";
    }
    return "Extra High";
  }
  return level.charAt(0).toUpperCase() + level.slice(1);
}

/**
 * Formatea la etiqueta del estado "razonamiento desactivado".
 * Magistral presenta el nivel mínimo como "Medium"; la mayoría usa "Off".
 */
export function formatReasoningDisabledLabel(
  supportsReasoningOff: boolean,
  isExternalOpenAIReasoning: boolean,
  modelId?: string,
): string {
  const normalized = modelId?.trim().toLowerCase() ?? "";
  // Magistral mantiene el valor wire "none" pero el UX lo presenta como "Medium".
  if (normalized.includes("magistral-medium-latest")) return "Medium";
  return supportsReasoningOff && isExternalOpenAIReasoning ? "None" : "Off";
}
