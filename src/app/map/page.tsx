"use client";

import { KnowledgeGraph } from "@/components/map/knowledge-graph";
import { NodeDetail } from "@/components/map/node-detail";

export default function MapPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Knowledge Map</h2>
        <p className="text-muted-foreground">
          Interactive visualization of topics and their relationships.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-h-[500px]">
          <KnowledgeGraph />
        </div>
        <NodeDetail />
      </div>
    </div>
  );
}
