import { translateMemory as translate } from "./memory-i18n";

export type MemoryNode = {
  id: string;
  type: string;
  label: string;
  content: string;
  sourceThreadId: string | null;
  sourceMessageId?: string | null;
  sourceRole?: string | null;
  projectId?: string | null;
  confidence: number;
  createdAt?: number;
  updatedAt?: number;
};
export type MemoryEdge = {
  id: string;
  source: string;
  target: string;
  relation: string;
};
export type MemoryGraphData = { nodes: MemoryNode[]; edges: MemoryEdge[] };
export type MemoryEvidence = {
  sourceId: string;
  quote: string;
  sourceThreadId: string | null;
  sourceRole: string | null;
};
export type MemoryDetail = MemoryNode & { evidence?: MemoryEvidence[] };
export type MemoryInput = Pick<
  MemoryNode,
  "type" | "label" | "content" | "projectId"
>;
export const MEMORY_TYPES = {
  get fact() {
    return translate("ui.fact");
  },
  get preference() {
    return translate("ui.preference");
  },
  get entity() {
    return translate("ui.entity");
  },
  get event() {
    return translate("ui.event");
  },
  get episode() {
    return translate("ui.episode");
  },
};
export function memoryTypeLabel(type: string) {
  return MEMORY_TYPES[type as keyof typeof MEMORY_TYPES] ?? type;
}
