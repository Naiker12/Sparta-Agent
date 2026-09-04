/**
 * Sparta Agent - Slice de Recuperación Aumentada (RAG) y Adjuntos
 * Gestiona bases de conocimiento, modos de búsqueda híbrida y OCR de documentos.
 */

import {
  DEFAULT_PROJECT_ATTACHMENT_TARGET,
  type ProjectAttachmentTarget,
} from "../../utils/project-attachment-target";
import {
  DEFAULT_RAG_AUTOINJECT,
  DEFAULT_RAG_AUTOINJECT_MIN_SCORE,
  DEFAULT_RAG_CAPTION,
  DEFAULT_RAG_MODE,
  DEFAULT_RAG_OCR,
  DEFAULT_RAG_SOURCE,
  DEFAULT_RAG_TOP_K,
} from "./constants";
import type { RagAutoInject, RagMode, RagSource } from "./types";

export interface RagSliceState {
  ragEnabled: boolean;
  ragSource: RagSource;
  projectAttachmentTarget: ProjectAttachmentTarget;
  projectAttachmentTargetByThread: Record<string, ProjectAttachmentTarget>;
  ragMode: RagMode;
  ragTopK: number;
  ragAutoInject: RagAutoInject;
  ragAutoInjectMinScore: number;
  ragOcrScanned: boolean;
  ragCaptionFigures: boolean;
}

export interface RagSliceActions {
  setRagEnabled: () => void;
  setRagSource: (source: RagSource) => void;
  setProjectAttachmentTarget: (target: ProjectAttachmentTarget) => void;
  setProjectAttachmentTargetForThread: (
    threadId: string,
    target: ProjectAttachmentTarget,
  ) => void;
  setRagMode: (mode: RagMode) => void;
  setRagTopK: (topK: number) => void;
  setRagAutoInject: (autoInject: RagAutoInject) => void;
  setRagAutoInjectMinScore: (minScore: number) => void;
  setRagOcrScanned: (scanned: boolean) => void;
  setRagCaptionFigures: (caption: boolean) => void;
}

export type RagSlice = RagSliceState & RagSliceActions;

export const initialRagState: RagSliceState = {
  ragEnabled: true,
  ragSource: DEFAULT_RAG_SOURCE,
  projectAttachmentTarget: DEFAULT_PROJECT_ATTACHMENT_TARGET,
  projectAttachmentTargetByThread: {},
  ragMode: DEFAULT_RAG_MODE,
  ragTopK: DEFAULT_RAG_TOP_K,
  ragAutoInject: DEFAULT_RAG_AUTOINJECT,
  ragAutoInjectMinScore: DEFAULT_RAG_AUTOINJECT_MIN_SCORE,
  ragOcrScanned: DEFAULT_RAG_OCR,
  ragCaptionFigures: DEFAULT_RAG_CAPTION,
};
