import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";

type LayoutNode = { id: string; x: number; y: number };
type LayoutEdge = { id: string; source: string; target: string };
type LayoutRequest = { nodes: LayoutNode[]; edges: LayoutEdge[] };
type Point = { x: number; y: number };

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function initialPosition(id: string): Point {
  const seed = hash(id);
  const angle = (seed / 0xffffffff) * Math.PI * 2;
  const radius = 120 + ((seed >>> 8) % 180);
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function separateOverlappingNodes(nodes: LayoutNode[], minimumDistance: number) {
  // Relax only positions; this never changes the graph's actual relationships.
  for (let pass = 0; pass < 48; pass += 1) {
    let moved = false;
    for (let left = 0; left < nodes.length; left += 1) {
      for (let right = left + 1; right < nodes.length; right += 1) {
        const a = nodes[left];
        const b = nodes[right];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distance = Math.hypot(dx, dy);
        if (distance >= minimumDistance) continue;
        if (distance < 0.001) {
          const angle = ((hash(`${a.id}:${b.id}`) / 0xffffffff) * Math.PI * 2);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }
        const shift = (minimumDistance - distance) / 2;
        const x = (dx / distance) * shift;
        const y = (dy / distance) * shift;
        a.x -= x;
        a.y -= y;
        b.x += x;
        b.y += y;
        moved = true;
      }
    }
    if (!moved) break;
  }
}

self.onmessage = (event: MessageEvent<LayoutRequest>) => {
  const { nodes, edges } = event.data;
  if (!nodes.length) {
    self.postMessage({});
    return;
  }

  const graph = new Graph({ type: "undirected", multi: true });
  const nodeIds = new Set(nodes.map(({ id }) => id));
  for (const node of nodes) {
    const seed = Number.isFinite(node.x) && Number.isFinite(node.y)
      ? { x: node.x, y: node.y }
      : initialPosition(node.id);
    graph.addNode(node.id, seed);
  }
  for (const edge of edges) {
    if (
      nodeIds.has(edge.source) &&
      nodeIds.has(edge.target) &&
      edge.source !== edge.target
    ) {
      graph.addEdgeWithKey(edge.id, edge.source, edge.target);
    }
  }

  forceAtlas2.assign(graph, {
    iterations: 260,
    settings: {
      adjustSizes: true,
      barnesHutOptimize: nodes.length > 300,
      gravity: 0.28,
      linLogMode: true,
      scalingRatio: 14,
      slowDown: 2.4,
    },
  });

  const positions = nodes.map(({ id }) => ({
    id,
    x: graph.getNodeAttribute(id, "x") as number,
    y: graph.getNodeAttribute(id, "y") as number,
  }));
  const minX = Math.min(...positions.map(({ x }) => x));
  const maxX = Math.max(...positions.map(({ x }) => x));
  const minY = Math.min(...positions.map(({ y }) => y));
  const maxY = Math.max(...positions.map(({ y }) => y));
  const largestSpan = Math.max(maxX - minX, maxY - minY, 1);
  const scale = Math.min(1, 900 / largestSpan);
  for (const point of positions) {
    point.x = ((point.x - (minX + maxX) / 2) * scale);
    point.y = ((point.y - (minY + maxY) / 2) * scale);
  }
  separateOverlappingNodes(positions, 24);
  // A slightly wider field uses the available canvas better and reads like a
  // constellation map instead of a compressed circular ball of nodes.
  for (const point of positions) point.x *= 1.65;

  self.postMessage(
    Object.fromEntries(positions.map(({ id, x, y }) => [id, { x, y }])),
  );
};

export {};
