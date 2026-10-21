import { default as BalanceScaleIcon } from "@hugeicons/core-free-icons/BalanceScaleIcon";
import { default as Clock01Icon } from "@hugeicons/core-free-icons/Clock01Icon";
import { default as CodeIcon } from "@hugeicons/core-free-icons/CodeIcon";
import { default as CodeSimpleIcon } from "@hugeicons/core-free-icons/CodeSimpleIcon";
import { default as DiceFaces03Icon } from "@hugeicons/core-free-icons/DiceFaces03Icon";
import { default as EqualSignIcon } from "@hugeicons/core-free-icons/EqualSignIcon";
import { default as FingerPrintIcon } from "@hugeicons/core-free-icons/FingerPrintIcon";
import { default as FunctionIcon } from "@hugeicons/core-free-icons/FunctionIcon";
import { default as Parabola02Icon } from "@hugeicons/core-free-icons/Parabola02Icon";
import { default as PencilEdit02Icon } from "@hugeicons/core-free-icons/PencilEdit02Icon";
import { default as Plant01Icon } from "@hugeicons/core-free-icons/Plant01Icon";
import { default as Plug01Icon } from "@hugeicons/core-free-icons/Plug01Icon";
import { default as Shield02Icon } from "@hugeicons/core-free-icons/Shield02Icon";
import { default as Tag01Icon } from "@hugeicons/core-free-icons/Tag01Icon";
import { default as TagsIcon } from "@hugeicons/core-free-icons/TagsIcon";
import { default as UserAccountIcon } from "@hugeicons/core-free-icons/UserAccountIcon";
import type { Edge } from "@xyflow/react";
import { useMemo } from "react";
import type { RecipeExecutionRecord } from "../execution-types";
import type {
  LayoutDirection,
  LlmType,
  NodeConfig,
  RecipeNode as RecipeBuilderNode,
  SamplerType,
} from "../types";
import { deriveDisplayGraph } from "../utils/graph/derive-display-graph";
import {
  deriveGraphRuntimeVisualState,
  pickLatestActiveExecution,
} from "../utils/graph/runtime-visual-state";

type IconType = typeof CodeIcon;

const SAMPLER_ICONS: Record<SamplerType, IconType> = {
  category: Tag01Icon,
  subcategory: TagsIcon,
  uniform: EqualSignIcon,
  gaussian: Parabola02Icon,
  bernoulli: EqualSignIcon,
  datetime: Clock01Icon,
  timedelta: Clock01Icon,
  uuid: FingerPrintIcon,
  person: UserAccountIcon,
  person_from_faker: UserAccountIcon,
};

const LLM_ICONS: Record<LlmType, IconType> = {
  text: PencilEdit02Icon,
  structured: CodeIcon,
  code: CodeSimpleIcon,
  judge: BalanceScaleIcon,
};

function resolveExecutionColumnIcon(config: NodeConfig | null): IconType {
  if (!config) {
    return DiceFaces03Icon;
  }
  if (config.kind === "sampler") {
    return SAMPLER_ICONS[config.sampler_type];
  }
  if (config.kind === "llm") {
    return LLM_ICONS[config.llm_type];
  }
  if (config.kind === "expression") {
    return FunctionIcon;
  }
  if (config.kind === "validator") {
    return Shield02Icon;
  }
  if (config.kind === "seed") {
    return Plant01Icon;
  }
  if (config.kind === "model_provider") {
    return Shield02Icon;
  }
  if (config.kind === "model_config") {
    return Plant01Icon;
  }
  if (config.kind === "tool_config") {
    return Plug01Icon;
  }
  return PencilEdit02Icon;
}

type UseRecipeRuntimeVisualsArgs = {
  executions: RecipeExecutionRecord[];
  configs: Record<string, NodeConfig>;
  nodes: RecipeBuilderNode[];
  edges: Edge[];
  layoutDirection: LayoutDirection;
  auxNodePositions: Record<string, { x: number; y: number }>;
  llmAuxVisibility: Record<string, boolean>;
};

type UseRecipeRuntimeVisualsResult = {
  activeExecution: RecipeExecutionRecord | null;
  runtimeVisualState: ReturnType<typeof deriveGraphRuntimeVisualState>;
  displayGraph: ReturnType<typeof deriveDisplayGraph>;
  displayNodeIds: string[];
  currentColumnIcon: IconType;
};

export function useRecipeRuntimeVisuals({
  executions,
  configs,
  nodes,
  edges,
  layoutDirection,
  auxNodePositions,
  llmAuxVisibility,
}: UseRecipeRuntimeVisualsArgs): UseRecipeRuntimeVisualsResult {
  const activeExecution = useMemo(
    () => pickLatestActiveExecution(executions),
    [executions],
  );

  const runtimeVisualState = useMemo(
    () =>
      deriveGraphRuntimeVisualState({
        activeExecution,
        configs,
        edges,
      }),
    [activeExecution, configs, edges],
  );

  const displayGraph = useMemo(
    () =>
      deriveDisplayGraph({
        nodes,
        edges,
        configs,
        layoutDirection,
        auxNodePositions,
        llmAuxVisibility,
        runtime: runtimeVisualState,
      }),
    [
      auxNodePositions,
      configs,
      edges,
      layoutDirection,
      llmAuxVisibility,
      nodes,
      runtimeVisualState,
    ],
  );

  const currentColumnConfig = useMemo(() => {
    const columnName = activeExecution?.current_column?.trim();
    if (!columnName) {
      return null;
    }
    for (const config of Object.values(configs)) {
      if (config.name.trim() === columnName) {
        return config;
      }
    }
    return null;
  }, [activeExecution?.current_column, configs]);

  const currentColumnIcon = useMemo(
    () => resolveExecutionColumnIcon(currentColumnConfig),
    [currentColumnConfig],
  );

  const displayNodeIds = useMemo(
    () => displayGraph.nodes.map((node) => node.id),
    [displayGraph.nodes],
  );

  return {
    activeExecution,
    runtimeVisualState,
    displayGraph,
    displayNodeIds,
    currentColumnIcon,
  };
}
