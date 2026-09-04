/**
 * Sparta Agent – Shared Composer Barrel
 *
 * Punto de entrada unificado para los submódulos del compositor compartido
 * (modo compare). Re-exporta todos los contratos públicos sin romper
 * los imports existentes que apunten a ./shared-composer.
 *
 * Estructura de submódulos:
 * - compare-handles:      Tipos CompareMessagePart/CompareHandle, contexto y
 *                         componentes CompareHandlesProvider/RegisterCompareHandle.
 * - use-dictation:        Hook useDictation para gestión del ciclo de vida STT.
 * - reasoning-labels:     Helpers de formateo de etiquetas de razonamiento.
 * - composer-ui-helpers:  Constantes, tipos PendingImage/Thumb, PillGlyph, IME helpers.
 * - compare-model-types:  CompareModelSelection y helpers de configuración especulativa.
 */

export {
  type CompareMessagePart,
  type CompareHandle,
  type CompareHandles,
  CompareHandlesContext,
  CompareHandlesProvider,
  RegisterCompareHandle,
} from "./compare-handles";

export { useDictation } from "./use-dictation";

export {
  formatReasoningEffortLabel,
  formatReasoningDisabledLabel,
} from "./reasoning-labels";

export {
  IMAGE_ACCEPT,
  MAX_IMAGE_SIZE,
  IME_STUCK_TIMEOUT_MS,
  isNativeComposing,
  ArrowDownStandardIcon,
  fileToBase64DataURL,
  type PendingImage,
  PendingImageThumb,
  PillGlyph,
} from "./composer-ui-helpers";

export {
  type CompareModelSelection,
  cleanCompareChatTemplate,
  resolveCompareSpecDraftNMax,
} from "./compare-model-types";

export {
  SharedComposerToolsMenu,
  type SharedComposerToolsMenuProps,
} from "./shared-composer-tools-menu";

export {
  useComparePromptQueue,
  type UseComparePromptQueueOptions,
} from "./use-compare-prompt-queue";

export {
  useCompareAttachments,
  type UseCompareAttachmentsOptions,
  type PendingAudio,
} from "./use-compare-attachments";
