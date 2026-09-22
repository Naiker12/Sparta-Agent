import type { Edge, XYPosition } from "@xyflow/react";
import type {
  LayoutDirection,
  NodeConfig,
  RecipeNode,
  RecipeProcessorConfig,
} from "../../types";

export type RecipeSnapshot = {
  configs: Record<string, NodeConfig>;
  nodes: RecipeNode[];
  edges: Edge[];
  auxNodePositions: Record<string, XYPosition>;
  processors: RecipeProcessorConfig[];
  layoutDirection: LayoutDirection;
  nextId: number;
  nextY: number;
};

export type ImportResult = {
  errors: string[];
  snapshot: RecipeSnapshot | null;
};
