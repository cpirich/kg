"use client";

import { useState } from "react";

import {
  KnowledgeGraph,
  type SelectedNodeData,
} from "@/components/map/knowledge-graph";
import { NodeDetail } from "@/components/map/node-detail";

export default function MapPage() {
  const [selectedNode, setSelectedNode] = useState<SelectedNodeData | null>(
    null,
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Knowledge Map</h2>
        <p className="text-muted-foreground">
          Interactive visualization of topics and their relationships.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="h-[500px]">
          <KnowledgeGraph onSelectNode={setSelectedNode} />
        </div>
        <NodeDetail selectedNode={selectedNode} />
      </div>
    </div>
  );
}
