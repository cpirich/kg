"use client";

import { GitBranch } from "lucide-react";

import { Button } from "@/components/ui/button";

const layouts = ["cola", "dagre", "cose", "concentric"];

export function KnowledgeGraph() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b p-2">
        <span className="text-xs font-medium text-muted-foreground">
          Layout:
        </span>
        {layouts.map((layout) => (
          <Button key={layout} variant="outline" size="xs">
            {layout}
          </Button>
        ))}
      </div>
      <div className="flex flex-1 items-center justify-center rounded-b-lg border border-t-0 bg-muted/30">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <GitBranch className="size-12 opacity-50" />
          <p className="text-sm">
            Knowledge map will appear here after uploading papers
          </p>
        </div>
      </div>
    </div>
  );
}
