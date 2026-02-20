"use client";

import { useEffect, useState } from "react";

import { AlertTriangle, FileText, Info, Layers, Tag } from "lucide-react";

import type { SelectedNodeData } from "@/components/map/knowledge-graph";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db/schema";
import type { Claim } from "@/types/domain";
import type { TopicId } from "@/types/domain";

interface NodeDetailProps {
  selectedNode: SelectedNodeData | null;
}

export function NodeDetail({ selectedNode }: NodeDetailProps) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [isLoadingClaims, setIsLoadingClaims] = useState(false);

  useEffect(() => {
    if (!selectedNode) {
      setClaims([]);
      return;
    }

    let cancelled = false;
    setIsLoadingClaims(true);

    db.claims
      .where("topicIds")
      .equals(selectedNode.topicId as TopicId)
      .toArray()
      .then((result) => {
        if (!cancelled) {
          setClaims(result);
          setIsLoadingClaims(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setClaims([]);
          setIsLoadingClaims(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedNode]);

  if (!selectedNode) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-sm">Node Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <Info className="size-8 opacity-50" />
            <p className="text-center text-sm">
              Select a node on the knowledge map to see its details.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Tag className="size-4" />
          {selectedNode.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Layers className="size-4 text-muted-foreground" />
            <div>
              <div className="font-medium">{selectedNode.claimCount}</div>
              <div className="text-xs text-muted-foreground">Claims</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <FileText className="size-4 text-muted-foreground" />
            <div>
              <div className="font-medium">{selectedNode.documentCount}</div>
              <div className="text-xs text-muted-foreground">Documents</div>
            </div>
          </div>
        </div>

        {/* Density bar */}
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Research Density</span>
            <span className="font-medium">
              {(selectedNode.density * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${selectedNode.density * 100}%` }}
            />
          </div>
        </div>

        {/* Gap adjacent warning */}
        {selectedNode.isGapAdjacent && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs dark:border-amber-900 dark:bg-amber-950">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-amber-800 dark:text-amber-200">
              This topic is adjacent to a knowledge gap. It may benefit from
              further research.
            </span>
          </div>
        )}

        {/* Claims list */}
        <div>
          <h4 className="mb-2 text-xs font-medium text-muted-foreground">
            Associated Claims
          </h4>
          {isLoadingClaims ? (
            <p className="text-xs text-muted-foreground">Loading claims...</p>
          ) : claims.length === 0 ? (
            <p className="text-xs text-muted-foreground">No claims found.</p>
          ) : (
            <div className="max-h-[300px] space-y-2 overflow-y-auto">
              {claims.slice(0, 10).map((claim) => (
                <div
                  key={claim.id}
                  className="rounded-md border bg-card p-2 text-xs"
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      {claim.type}
                    </Badge>
                    <span className="text-muted-foreground">
                      {(claim.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                  <p className="line-clamp-3 text-muted-foreground">
                    {claim.text}
                  </p>
                </div>
              ))}
              {claims.length > 10 && (
                <p className="text-center text-xs text-muted-foreground">
                  ...and {claims.length - 10} more claims
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
