import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";

type LayoutNode = { id: string; x: number; y: number };
type LayoutEdge = { id: string; source: string; target: string };
type LayoutRequest = { nodes: LayoutNode[]; edges: LayoutEdge[] };
type Point = { x: number; y: number };
type Component = { nodes: LayoutNode[]; radius: number };

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function initialPosition(id: string, index: number): Point {
  // A small deterministic sunflower seed gives ForceAtlas2 a well-spread start
  // without placing every isolated node on the same hash-derived ring.
  const angle = index * 2.399963229728653 + (hash(id) % 1000) / 1000;
  const radius = 12 * Math.sqrt(index + 1) + 4;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function connectedComponents(nodes: LayoutNode[], edges: LayoutEdge[]) {
  const adjacency = new Map(nodes.map(({ id }) => [id, [] as string[]]));
  for (const edge of edges) {
    if (
      edge.source !== edge.target &&
      adjacency.has(edge.source) &&
      adjacency.has(edge.target)
    ) {
      adjacency.get(edge.source)!.push(edge.target);
      adjacency.get(edge.target)!.push(edge.source);
    }
  }

  const visited = new Set<string>();
  const components: string[][] = [];
  for (const { id } of nodes) {
    if (visited.has(id)) continue;
    const stack = [id];
    const component: string[] = [];
    visited.add(id);
    while (stack.length) {
      const current = stack.pop()!;
      component.push(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        stack.push(neighbor);
      }
    }
    components.push(component);
  }
  return components;
}

function layoutComponent(
  ids: string[],
  allNodes: Map<string, LayoutNode>,
  allEdges: LayoutEdge[],
): Component {
  if (ids.length === 1) {
    return { nodes: [{ ...allNodes.get(ids[0])!, x: 0, y: 0 }], radius: 26 };
  }

  const graph = new Graph({ type: "undirected", multi: true });
  ids.forEach((id, index) => {
    const seed = initialPosition(id, index);
    graph.addNode(id, seed);
  });
  const included = new Set(ids);
  for (const edge of allEdges) {
    if (
      included.has(edge.source) &&
      included.has(edge.target) &&
      edge.source !== edge.target
    ) {
      graph.addEdgeWithKey(edge.id, edge.source, edge.target);
    }
  }

  forceAtlas2.assign(graph, {
    iterations: Math.min(420, 240 + ids.length * 2),
    settings: {
      adjustSizes: true,
      barnesHutOptimize: ids.length > 80,
      // LinLog pulled the whole memory into one dark, tangled ball. Standard
      // ForceAtlas2 keeps connected groups readable while retaining structure.
      linLogMode: false,
      gravity: 0.035,
      scalingRatio: 22,
      slowDown: 4,
    },
  });

  const laidOut = ids.map((id) => ({
    ...allNodes.get(id)!,
    x: graph.getNodeAttribute(id, "x") as number,
    y: graph.getNodeAttribute(id, "y") as number,
  }));
  const centerX = laidOut.reduce((sum, node) => sum + node.x, 0) / laidOut.length;
  const centerY = laidOut.reduce((sum, node) => sum + node.y, 0) / laidOut.length;
  for (const node of laidOut) {
    node.x -= centerX;
    node.y -= centerY;
  }

  // Keep tiny linked groups legible and cap giant groups so the component
  // packer can still give the rest of the memory some room.
  const extent = Math.max(
    ...laidOut.map(({ x, y }) => Math.hypot(x, y)),
    1,
  );
  const targetExtent = Math.max(55, Math.min(420, Math.sqrt(ids.length) * 28));
  const scale = targetExtent / extent;
  for (const node of laidOut) {
    node.x *= scale;
    node.y *= scale;
  }

  const radius = Math.max(
    38,
    ...laidOut.map(({ x, y }) => Math.hypot(x, y) + 20),
  );
  return { nodes: laidOut, radius };
}

function packComponents(components: Component[]) {
  const packed: Array<{ x: number; y: number; radius: number }> = [];
  const cells = new Map<string, Array<(typeof packed)[number]>>();
  const cellSize = 200;
  const cellKey = (x: number, y: number) =>
    `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const largestRadius = Math.max(...components.map(({ radius }) => radius));

  for (const component of components) {
    let best = { x: 0, y: 0, score: Number.POSITIVE_INFINITY };
    const searchCount = Math.max(240, packed.length * 12);
    for (let index = 0; index < searchCount; index += 1) {
      const radius = index === 0 ? 0 : 30 * Math.sqrt(index);
      const angle = index * goldenAngle;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      let overlapPenalty = 0;
      const neighborCells = Math.ceil(
        (component.radius + largestRadius + 34) / cellSize,
      );
      const cellX = Math.floor(x / cellSize);
      const cellY = Math.floor(y / cellSize);
      for (let offsetX = -neighborCells; offsetX <= neighborCells; offsetX += 1) {
        for (let offsetY = -neighborCells; offsetY <= neighborCells; offsetY += 1) {
          for (const other of cells.get(`${cellX + offsetX}:${cellY + offsetY}`) ?? []) {
            const overlap = component.radius + other.radius + 34 - Math.hypot(x - other.x, y - other.y);
            if (overlap > 0) overlapPenalty += overlap * overlap;
          }
        }
      }
      const score = overlapPenalty * 1000 + radius;
      if (score < best.score) best = { x, y, score };
      if (overlapPenalty === 0) break;
    }
    const placed = { x: best.x, y: best.y, radius: component.radius };
    packed.push(placed);
    const key = cellKey(placed.x, placed.y);
    cells.set(key, [...(cells.get(key) ?? []), placed]);
  }
  return packed;
}

self.onmessage = (event: MessageEvent<LayoutRequest>) => {
  const { nodes, edges } = event.data;
  if (!nodes.length) {
    self.postMessage({});
    return;
  }

  const allNodes = new Map(nodes.map((node) => [node.id, node]));
  const ids = connectedComponents(nodes, edges);
  const groups = ids
    .map((component) =>
      layoutComponent(component, allNodes, edges),
    )
    .sort((left, right) => right.radius - left.radius);
  const centers = packComponents(groups);
  const positions: Record<string, Point> = {};

  groups.forEach((group, index) => {
    const center = centers[index];
    for (const node of group.nodes) {
      positions[node.id] = { x: node.x + center.x, y: node.y + center.y };
    }
  });

  // Preserve a comfortable, centered viewport while keeping the x/y scale
  // equal. Stretching only x made the graph feel like a flat row of beads.
  const points = Object.values(positions);
  const minX = Math.min(...points.map(({ x }) => x));
  const maxX = Math.max(...points.map(({ x }) => x));
  const minY = Math.min(...points.map(({ y }) => y));
  const maxY = Math.max(...points.map(({ y }) => y));
  const largestSpan = Math.max(maxX - minX, maxY - minY, 1);
  const scale = Math.min(1.15, 1000 / largestSpan);
  for (const point of points) {
    point.x = (point.x - (minX + maxX) / 2) * scale;
    point.y = (point.y - (minY + maxY) / 2) * scale;
  }

  self.postMessage(positions);
};

export {};
