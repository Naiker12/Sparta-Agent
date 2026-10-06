import { useMemoryT as useUiT } from "./memory-i18n";
import cytoscape, { type Core } from "cytoscape";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { MemoryGraphData } from "./memory-types";

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

const nodeIcon = (type: string) => {
  const paths: Record<string, string> = {
    entity:
      '<circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
    preference:
      '<path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-4 4 0 9 8 15 8-6 12-11 8-15Z"/>',
    event:
      '<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4M16 3v4M4 11h16"/>',
    episode: '<path d="M21 11a9 9 0 0 1-9 9H4l-2 2V11a9 9 0 0 1 19 0Z"/>',
    fact: '<path d="M9 18h6M9 21h6M8 14a6 6 0 1 1 8 0l-1 3H9Z"/>',
  };
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#183956" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[type] ?? paths.fact}</svg>`)}`;
};

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
            label: "data(label)",
            width: 40,
            height: 40,
            "background-image": "data(icon)",
            "background-width": "58%",
            "background-height": "58%",
            "background-color": "#319cff",
            "border-width": 2,
            "border-color": "#f4efe6",
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
            width: 1.2,
            "line-color": "#a9b4c4",
            "curve-style": "bezier",
            "target-arrow-shape": "triangle",
            "target-arrow-color": "#a9b4c4",
            "arrow-scale": 0.65,
            opacity: 0.55,
          },
        },
        { selector: ".muted", style: { opacity: 0.25 } },
        {
          selector: "node:selected",
          style: {
            "border-color": "#299cff",
            "border-width": 4,
            width: 52,
            height: 52,
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
      cy.destroy();
      instance.current = null;
    };
  }, []);
  useEffect(() => {
    const cy = instance.current;
    if (!cy) return;
    const signature = JSON.stringify(graph);
    if (cy.scratch("signature") === signature) return;
    const oldPositions = new Map(
      cy.nodes().map((node) => [node.id(), node.position()] as const),
    );
    const changedTopology =
      graph.nodes.length !== cy.nodes().length ||
      graph.edges.length !== cy.edges().length ||
      graph.nodes.some((node) => !oldPositions.has(node.id));
    cy.batch(() => {
      cy.elements().remove();
      cy.add([
        ...graph.nodes.map((node, index) => ({
          data: {
            ...node,
            icon: nodeIcon(node.type),
            label:
              node.label.length > 65
                ? `${node.label.slice(0, 62)}…`
                : node.label,
          },
          position: oldPositions.get(node.id) ?? {
            x: (index % 6) * 180,
            y: Math.floor(index / 6) * 150,
          },
        })),
        ...graph.edges.map((edge) => ({ data: edge })),
      ]);
    });
    cy.scratch("signature", signature);
    if (changedTopology && graph.nodes.length) {
      cy.layout({
        name: "cose",
        animate: false,
        randomize: false,
        padding: 45,
        nodeDimensionsIncludeLabels: true,
        nodeRepulsion: () => 4500,
        idealEdgeLength: () => 110,
        componentSpacing: 60,
        nodeOverlap: 35,
      }).run();
      // Keep the local map readable rather than fitting a very spread-out layout.
      const bounds = cy.nodes().boundingBox();
      const scale = Math.min(
        1,
        850 / Math.max(bounds.w, 1),
        520 / Math.max(bounds.h, 1),
      );
      if (scale < 1)
        cy.nodes().positions((node) => ({
          x: node.position("x") * scale,
          y: node.position("y") * scale,
        }));
      cy.fit(undefined, 45);
      if (graph.nodes.length === 1) {
        cy.zoom(1);
        cy.center();
      }
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
        node.connectedEdges().addClass("focus");
      }
    });
  }, [selectedId, graph]);
  return (
    <div className="relative h-full min-h-0">
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
