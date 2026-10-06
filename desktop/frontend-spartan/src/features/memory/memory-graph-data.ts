import type { MemoryGraphData } from "./memory-types";

export function filterMemoryGraph(
  graph: MemoryGraphData,
  view: string,
  type: string,
  project: string,
): MemoryGraphData {
  const nodes = graph.nodes.filter(
    (node) =>
      (view === "episodes"
        ? Boolean(node.sourceMessageId)
        : !node.sourceMessageId) &&
      (type === "all" || node.type === type) &&
      (project === "all" || (node.projectId ?? "") === project),
  );
  const ids = new Set(nodes.map((node) => node.id));
  return {
    nodes,
    edges: graph.edges.filter(
      (edge) => ids.has(edge.source) && ids.has(edge.target),
    ),
  };
}
