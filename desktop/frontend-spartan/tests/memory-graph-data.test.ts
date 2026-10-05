import assert from "node:assert/strict";
import test from "node:test";
import { filterMemoryGraph } from "../src/features/memory/memory-graph-data.ts";
import type { MemoryGraphData } from "../src/features/memory/memory-types.ts";

const graph: MemoryGraphData = {
  nodes: [
    {
      id: "episode",
      type: "episode",
      label: "Hola",
      content: "Hola",
      sourceThreadId: "thread",
      sourceMessageId: "message",
      projectId: "project",
      confidence: 0,
    },
    {
      id: "derived",
      type: "preference",
      label: "Español",
      content: "Español",
      sourceThreadId: "thread",
      sourceRole: "user",
      projectId: "project",
      confidence: 0,
    },
    {
      id: "manual",
      type: "entity",
      label: "Proyecto",
      content: "Proyecto",
      sourceThreadId: null,
      projectId: "project",
      confidence: 1,
    },
    {
      id: "personal",
      type: "fact",
      label: "Personal",
      content: "Personal",
      sourceThreadId: null,
      projectId: null,
      confidence: 1,
    },
  ],
  edges: [
    { id: "source", source: "episode", target: "derived", relation: "fuente" },
    { id: "semantic", source: "manual", target: "derived", relation: "usa" },
  ],
};
test("reviewed memories stay visible without turning raw episodes into facts", () => {
  const result = filterMemoryGraph(graph, "memories", "all", "all");
  assert.deepEqual(
    result.nodes.map((node) => node.id),
    ["derived", "manual", "personal"],
  );
  assert.deepEqual(
    result.edges.map((edge) => edge.id),
    ["semantic"],
  );
  assert.equal(graph.nodes.length, 4);
});
test("project, type and episode filters never leave dangling relationships", () => {
  assert.deepEqual(
    filterMemoryGraph(graph, "episodes", "all", "project").nodes.map(
      (node) => node.id,
    ),
    ["episode"],
  );
  assert.deepEqual(
    filterMemoryGraph(graph, "memories", "all", "").nodes.map(
      (node) => node.id,
    ),
    ["personal"],
  );
  assert.equal(
    filterMemoryGraph(graph, "memories", "preference", "project").edges.length,
    0,
  );
});
