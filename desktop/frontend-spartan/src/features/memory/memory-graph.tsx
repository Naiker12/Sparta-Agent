import { useMemoryT as useUiT } from "./memory-i18n";
import cytoscape, { type Core } from "cytoscape";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { MemoryGraphData } from "./memory-types";

type GraphPosition = { x: number; y: number };
type LayoutPositions = Record<string, GraphPosition>;
const POSITION_STORAGE_KEY = "spartan.memory.graph.positions.v2";
const TOPOLOGY_STORAGE_KEY = "spartan.memory.graph.topology.v2";

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function seedPosition(id: string): GraphPosition {
  const seed = hash(id);
  const angle = (seed / 0xffffffff) * Math.PI * 2;
  const radius = 120 + ((seed >>> 8) % 180);
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function readSavedPositions(): LayoutPositions {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(POSITION_STORAGE_KEY) ?? "{}",
    ) as LayoutPositions;
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, point]) =>
          Number.isFinite(point?.x) && Number.isFinite(point?.y),
      ),
    );
  } catch {
    return {};
  }
}

function readSavedTopology() {
  try {
    return localStorage.getItem(TOPOLOGY_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function savePositions(positions: LayoutPositions, topology: string) {
  try {
    const previous = readSavedPositions();
    localStorage.setItem(
      POSITION_STORAGE_KEY,
      JSON.stringify({ ...previous, ...positions }),
    );
    localStorage.setItem(TOPOLOGY_STORAGE_KEY, topology);
  } catch {
    // Private browsing or storage limits should not prevent graph rendering.
  }
}

// Cytoscape expects RGB colors; the app's theme uses OKLCH tokens.
function graphColor(color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d")!;
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
  return `rgb(${red}, ${green}, ${blue})`;
}

export function MemoryGraph({
  graph,
  selectedId,
  onSelect,
}: {
  graph: MemoryGraphData;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const uiT = useUiT();

  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<Core | null>(null);
  const layoutWorker = useRef<Worker | null>(null);
  const savedPositions = useRef<LayoutPositions | null>(null);
  const selection = useRef(onSelect);
  useEffect(() => {
    selection.current = onSelect;
  }, [onSelect]);
  const [zoom, setZoom] = useState(100);
  useEffect(() => {
    if (!container.current) return;
    const cy = cytoscape({
      container: container.current,
      elements: [],
      minZoom: 0.25,
      maxZoom: 2.5,
      wheelSensitivity: 0.2,
      style: [
        {
          selector: "node",
          style: {
            // A large episode graph is unreadable with every sentence painted
            // at once. Labels appear only for the hovered node and selection.
            label: "",
            width: 16,
            height: 16,
            "background-color": "#319cff",
            "border-width": 0.8,
            "border-color": "#d9e5f5",
            "border-opacity": 0.7,
            "font-size": 13,
            "font-family": "Figtree, sans-serif",
            "text-valign": "bottom",
            "text-margin-y": 9,
            "text-wrap": "wrap",
            "text-max-width": "145px",
          },
        },
        {
          selector: "node[type = 'preference']",
          style: { "background-color": "#94cbb9" },
        },
        {
          selector: "node[type = 'entity']",
          style: { "background-color": "#b3a1e3" },
        },
        {
          selector: "node[type = 'event']",
          style: { "background-color": "#d9b77c" },
        },
        {
          selector: "node[type = 'episode']",
          style: { "background-color": "#9ebad3" },
        },
        {
          selector: "edge",
          style: {
            width: 0.85,
            "line-color": "#9aa9c0",
            "curve-style": "bezier",
            "target-arrow-shape": "triangle",
            "target-arrow-color": "#9aa9c0",
            "arrow-scale": 0.45,
            opacity: 0.34,
          },
        },
        { selector: ".muted", style: { opacity: 0.25 } },
        {
          selector: "node.focus, node.hover",
          style: {
            label: "data(label)",
            "text-background-color": "#f4efe6",
            "text-background-opacity": 0.96,
            "text-background-padding": "4px",
            "text-wrap": "wrap",
            "text-max-width": "180px",
            "z-index": 10,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-color": "#299cff",
            "border-width": 2,
            width: 22,
            height: 22,
          },
        },
        {
          selector: "edge.focus",
          style: {
            label: "data(relation)",
            "font-size": 10,
            "text-background-color": "#f4efe6",
            "text-background-opacity": 1,
            "text-background-padding": "4px",
            "text-rotation": "autorotate",
            "line-color": "#299cff",
            "target-arrow-color": "#299cff",
            opacity: 1,
          },
        },
      ],
    });
    instance.current = cy;
    const syncTheme = () => {
      if (!container.current) return;
      const foreground = graphColor(getComputedStyle(container.current).color);
      const background = graphColor(
        getComputedStyle(document.body).backgroundColor,
      );
      cy.style()
        .selector("node")
        .style("color", foreground)
        .selector("node.focus, node.hover")
        .style("text-background-color", background)
        .style("color", foreground)
        .selector("edge.focus")
        .style("color", foreground)
        .style("text-background-color", background)
        .update();
    };
    syncTheme();
    const themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
    themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    cy.on("tap", "node", (event) => selection.current(event.target.id()));
    cy.on("mouseover", "node", (event) => event.target.addClass("hover"));
    cy.on("mouseout", "node", (event) => event.target.removeClass("hover"));
    cy.on("tap", (event) => {
      if (event.target === cy) selection.current(null);
    });
    cy.on("zoom", () => {
      const scale = cy.zoom();
      setZoom(Math.round(scale * 100));
      cy.style()
        .selector("node")
        .style("font-size", 13 / scale)
        .selector("edge.focus")
        .style("font-size", 10 / scale)
        .update();
    });
    const resize = new ResizeObserver(() => {
      const center = { x: cy.width() / 2, y: cy.height() / 2 };
      cy.resize();
      if (cy.nodes().length) cy.fit(undefined, 45);
      else cy.zoom({ level: 1, renderedPosition: center });
    });
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      themeObserver.disconnect();
      layoutWorker.current?.terminate();
      layoutWorker.current = null;
      cy.destroy();
      instance.current = null;
    };
  }, []);
  useEffect(() => {
    const cy = instance.current;
    if (!cy) return;
    const signature = JSON.stringify(graph);
    if (cy.scratch("signature") === signature) return;
    savedPositions.current ??= readSavedPositions();
    const topologySignature = JSON.stringify({
      nodes: graph.nodes.map(({ id }) => id).sort(),
      edges: graph.edges
        .map(({ id, source, target }) => [id, source, target])
        .sort(([left], [right]) => String(left).localeCompare(String(right))),
    });
    const oldPositions = new Map(
      cy.nodes().map((node) => [node.id(), node.position()] as const),
    );
    const existingNodeIds = new Set(cy.nodes().map((node) => node.id()));
    const existingEdgeIds = new Set(cy.edges().map((edge) => edge.id()));
    const changedTopology =
      graph.nodes.length !== cy.nodes().length ||
      graph.edges.length !== cy.edges().length ||
      graph.nodes.some((node) => !existingNodeIds.has(node.id)) ||
      graph.edges.some((edge) => {
        const previous = cy.getElementById(edge.id);
        return (
          !existingEdgeIds.has(edge.id) ||
          previous.data("source") !== edge.source ||
          previous.data("target") !== edge.target
        );
      });
    cy.batch(() => {
      cy.elements().remove();
      cy.add([
        ...graph.nodes.map((node) => ({
          data: {
            ...node,
            label:
              node.label.length > 65
                ? `${node.label.slice(0, 62)}…`
                : node.label,
          },
          position:
            oldPositions.get(node.id) ??
            savedPositions.current?.[node.id] ??
            seedPosition(node.id),
        })),
        ...graph.edges.map((edge) => ({ data: edge })),
      ]);
    });
    cy.scratch("signature", signature);
    const canReuseSavedLayout =
      graph.nodes.length > 0 &&
      graph.nodes.every((node) => savedPositions.current?.[node.id]) &&
      readSavedTopology() === topologySignature;
    if (changedTopology && graph.nodes.length && !canReuseSavedLayout) {
      layoutWorker.current?.terminate();
      const worker = new Worker(
        new URL("./memory-layout.worker.ts", import.meta.url),
        { type: "module" },
      );
      layoutWorker.current = worker;
      worker.onmessage = (event: MessageEvent<LayoutPositions>) => {
        if (layoutWorker.current !== worker || instance.current !== cy) return;
        cy.batch(() => {
          cy.nodes().forEach((node) => {
            const point = event.data[node.id()];
            if (point) node.position(point);
          });
        });
        savedPositions.current = {
          ...(savedPositions.current ?? {}),
          ...event.data,
        };
        savePositions(event.data, topologySignature);
        worker.terminate();
        layoutWorker.current = null;
        cy.fit(undefined, 45);
        if (graph.nodes.length === 1) {
          cy.zoom(1);
          cy.center();
        }
      };
      worker.onerror = () => {
        if (layoutWorker.current !== worker) return;
        worker.terminate();
        layoutWorker.current = null;
        cy.layout({
          name: "cose",
          animate: true,
          animationDuration: 450,
          randomize: true,
          padding: 45,
          nodeDimensionsIncludeLabels: false,
          nodeRepulsion: () => 4500,
          idealEdgeLength: () => 90,
          componentSpacing: 50,
          nodeOverlap: 24,
        }).run();
      };
      worker.postMessage({
        nodes: graph.nodes.map((node) => ({
          id: node.id,
          ...(oldPositions.get(node.id) ?? savedPositions.current?.[node.id] ?? seedPosition(node.id)),
        })),
        edges: graph.edges,
      });
    } else if (changedTopology && graph.nodes.length) {
      cy.fit(undefined, 45);
    }
  }, [graph]);
  useEffect(() => {
    const cy = instance.current;
    if (!cy) return;
    cy.batch(() => {
      cy.elements().removeClass("muted focus");
      cy.nodes().unselect();
      const node = selectedId ? cy.getElementById(selectedId) : null;
      if (node?.length) {
        node.select();
        const nearby = node.closedNeighborhood();
        cy.elements().difference(nearby).addClass("muted");
        nearby.nodes().addClass("focus");
        node.connectedEdges().addClass("focus");
      }
    });
  }, [selectedId, graph]);
  return (
    <div
      className="memory-universe-surface relative h-full min-h-0 overflow-hidden rounded-lg"
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
        const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
        event.currentTarget.style.setProperty("--memory-depth-x", `${(x * 14).toFixed(1)}px`);
        event.currentTarget.style.setProperty("--memory-depth-y", `${(y * 10).toFixed(1)}px`);
        event.currentTarget.style.setProperty("--memory-stars-x", `${(x * -9).toFixed(1)}px`);
        event.currentTarget.style.setProperty("--memory-stars-y", `${(y * -7).toFixed(1)}px`);
      }}
      onPointerLeave={(event) => {
        event.currentTarget.style.setProperty("--memory-depth-x", "0px");
        event.currentTarget.style.setProperty("--memory-depth-y", "0px");
        event.currentTarget.style.setProperty("--memory-stars-x", "0px");
        event.currentTarget.style.setProperty("--memory-stars-y", "0px");
      }}
    >
      <div
        ref={container}
        className="h-full w-full"
        role="img"
        aria-label={uiT(
          "ui.map_of_memories_and_their_relationships_use_the_accessible_list_t",
        )}
      />
      <div className="absolute bottom-4 left-4 flex items-center gap-1 rounded-full border bg-background/95 p-1">
        <Button
          variant="ghost"
          size="sm"
          aria-label={uiT("ui.zoom_out_map")}
          onClick={() =>
            instance.current?.zoom({
              level: instance.current.zoom() / 1.2,
              renderedPosition: {
                x: container.current!.clientWidth / 2,
                y: container.current!.clientHeight / 2,
              },
            })
          }
        >
          −
        </Button>
        <span className="min-w-12 text-center text-xs text-muted-foreground">
          {zoom}%
        </span>
        <Button
          variant="ghost"
          size="sm"
          aria-label={uiT("ui.zoom_in_map")}
          onClick={() =>
            instance.current?.zoom({
              level: instance.current.zoom() * 1.2,
              renderedPosition: {
                x: container.current!.clientWidth / 2,
                y: container.current!.clientHeight / 2,
              },
            })
          }
        >
          +
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => instance.current?.fit(undefined, 65)}
        >
          {uiT("ui.fit")}
        </Button>
      </div>
    </div>
  );
}
