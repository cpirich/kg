"use client";

import type cytoscape from "cytoscape";
import { useCallback, useEffect, useRef, useState } from "react";

import { GitBranch, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useGraphData } from "@/hooks/use-graph-data";
import {
  colaLayout,
  concentricLayout,
  coseLayout,
  dagreLayout,
} from "@/lib/graph/layouts";
import type { GraphNode } from "@/types/graph";

type CytoscapeCore = cytoscape.Core;

const layoutConfigs: Record<string, cytoscape.LayoutOptions> = {
  cola: colaLayout as unknown as cytoscape.LayoutOptions,
  dagre: dagreLayout as unknown as cytoscape.LayoutOptions,
  cose: coseLayout as unknown as cytoscape.LayoutOptions,
  concentric: concentricLayout as unknown as cytoscape.LayoutOptions,
};

const layoutNames = Object.keys(layoutConfigs);

export interface SelectedNodeData {
  id: string;
  label: string;
  topicId: string;
  claimCount: number;
  documentCount: number;
  density: number;
  isGapAdjacent: boolean;
}

interface KnowledgeGraphProps {
  onSelectNode?: (node: SelectedNodeData | null) => void;
}

// Cytoscape style types are too narrow for mapData() expressions and string
// values that cytoscape actually supports at runtime.
// We build the stylesheet as Stylesheet[] with targeted type casts.
type CyStylesheet = cytoscape.StylesheetStyle;

function buildStylesheet(): CyStylesheet[] {
  return [
    {
      selector: "node",
      style: {
        label: "data(label)",
        "text-valign": "center",
        "text-halign": "center",
        "font-size": "11px" as unknown as number,
        color: "#1a1a2e",
        "text-outline-color": "#ffffff",
        "text-outline-width": 2,
        "text-max-width": "100px",
        "text-wrap": "ellipsis",
        "background-color": "#6366f1",
        // mapData is valid at runtime
        width: "mapData(claimCount, 1, 20, 30, 80)" as unknown as number,
        height: "mapData(claimCount, 1, 20, 30, 80)" as unknown as number,
        "border-width": 2,
        "border-color": "#4f46e5",
        "overlay-padding": 4 as unknown as string,
      },
    },
    {
      selector: "node[?isGapAdjacent]",
      style: {
        "background-color": "#f59e0b",
        "border-color": "#d97706",
      } as cytoscape.Css.Node,
    },
    {
      selector: "node:selected",
      style: {
        "background-color": "#2563eb",
        "border-color": "#1d4ed8",
        "border-width": 3,
      } as cytoscape.Css.Node,
    },
    {
      selector: "node:active",
      style: {
        "overlay-color": "#6366f1",
        "overlay-opacity": 0.15,
      } as cytoscape.Css.Node,
    },
    {
      selector: "edge",
      style: {
        width: "mapData(weight, 0.1, 1, 1, 6)" as unknown as number,
        "line-color": "#94a3b8",
        "target-arrow-color": "#94a3b8",
        "target-arrow-shape": "triangle",
        "curve-style": "bezier",
        opacity: 0.6,
      },
    },
    {
      selector: 'edge[type = "subtopic"]',
      style: {
        "line-style": "solid",
        "target-arrow-shape": "triangle",
      } as cytoscape.Css.Edge,
    },
    {
      selector: 'edge[type = "prerequisite"]',
      style: {
        "line-style": "dashed",
        "target-arrow-shape": "triangle",
      } as cytoscape.Css.Edge,
    },
    {
      selector: 'edge[type = "contradicts"]',
      style: {
        "line-color": "#ef4444",
        "target-arrow-color": "#ef4444",
        "target-arrow-shape": "tee",
      } as cytoscape.Css.Edge,
    },
    {
      selector: 'edge[type = "related"]',
      style: {
        "target-arrow-shape": "none",
      } as cytoscape.Css.Edge,
    },
  ];
}

export function KnowledgeGraph({ onSelectNode }: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<CytoscapeCore | null>(null);
  const onSelectNodeRef = useRef(onSelectNode);
  const [activeLayout, setActiveLayout] = useState("cose");
  const [isInitialized, setIsInitialized] = useState(false);
  const { elements, isLoading } = useGraphData();

  // Keep callback ref current without reinitializing cy
  useEffect(() => {
    onSelectNodeRef.current = onSelectNode;
  }, [onSelectNode]);

  // Initialize cytoscape instance
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;

      // Dynamically import cytoscape and layout extensions (no SSR)
      const [cytoscapeModule, colaModule, dagreModule] = await Promise.all([
        import("cytoscape"),
        import("cytoscape-cola"),
        import("cytoscape-dagre"),
      ]);

      if (cancelled) return;

      const cytoscapeFn = cytoscapeModule.default;
      const cola = colaModule.default;
      const dagre = dagreModule.default;

      // Register layout extensions
      cytoscapeFn.use(cola);
      cytoscapeFn.use(dagre);

      const cy = cytoscapeFn({
        container: containerRef.current,
        style: buildStylesheet(),
        minZoom: 0.2,
        maxZoom: 3,
        wheelSensitivity: 0.3,
      });

      // Node tap: select and notify parent via ref
      cy.on("tap", "node", (event) => {
        const node = event.target;
        const data = node.data() as GraphNode["data"];
        onSelectNodeRef.current?.({
          id: data.id,
          label: data.label,
          topicId: data.topicId,
          claimCount: data.claimCount,
          documentCount: data.documentCount,
          density: data.density,
          isGapAdjacent: data.isGapAdjacent,
        });
      });

      // Tap on background: deselect
      cy.on("tap", (event) => {
        if (event.target === cy) {
          onSelectNodeRef.current?.(null);
        }
      });

      // Hover effects: highlight connected nodes and edges
      cy.on("mouseover", "node", (event) => {
        const node = event.target;
        const neighborhood = node.neighborhood().add(node);
        cy.elements().not(neighborhood).addClass("dimmed");
        node.addClass("highlighted");
      });

      cy.on("mouseout", "node", () => {
        cy.elements().removeClass("dimmed").removeClass("highlighted");
      });

      cyRef.current = cy;
      setIsInitialized(true);
    }

    init();

    return () => {
      cancelled = true;
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
      setIsInitialized(false);
    };
  }, []);

  // Update graph elements when data changes
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !isInitialized) return;

    // Batch update: remove old elements, add new ones
    cy.elements().remove();

    if (elements.length > 0) {
      cy.add(elements as unknown as cytoscape.ElementDefinition[]);
      // Add dimmed/highlighted styles dynamically
      cy.style()
        .selector(".dimmed")
        .style({
          opacity: 0.15,
        })
        .selector(".highlighted")
        .style({
          "z-index": 10,
        })
        .update();

      // Run layout
      cy.layout(layoutConfigs[activeLayout]).run();
    }
  }, [elements, isInitialized, activeLayout]);

  const handleLayoutChange = useCallback((layoutName: string) => {
    setActiveLayout(layoutName);
    const cy = cyRef.current;
    if (cy && cy.elements().length > 0) {
      cy.layout(layoutConfigs[layoutName]).run();
    }
  }, []);

  const hasData = elements.length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b p-2">
        <span className="text-xs font-medium text-muted-foreground">
          Layout:
        </span>
        {layoutNames.map((layout) => (
          <Button
            key={layout}
            variant={activeLayout === layout ? "default" : "outline"}
            size="xs"
            onClick={() => handleLayoutChange(layout)}
            disabled={!hasData}
          >
            {layout}
          </Button>
        ))}
      </div>
      <div className="relative flex-1 rounded-b-lg border border-t-0 bg-muted/30">
        {/* Cytoscape container - always present for ref stability */}
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{ display: hasData ? "block" : "none" }}
        />

        {/* Loading state */}
        {isLoading && (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="size-8 animate-spin opacity-50" />
              <p className="text-sm">Loading graph data...</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !hasData && (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <GitBranch className="size-12 opacity-50" />
              <p className="text-sm">
                Knowledge map will appear here after uploading papers
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
