"use client";

import { ClaimCompare } from "@/components/contradictions/claim-compare";
import { ContradictionList } from "@/components/contradictions/contradiction-list";
import { Button } from "@/components/ui/button";
import { useContradictions } from "@/hooks/use-contradictions";
import { Loader2 } from "lucide-react";

export default function ContradictionsPage() {
  const { contradictions, isDetecting, error, runContradictionDetection } =
    useContradictions();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Contradictions</h2>
          <p className="text-muted-foreground">
            Claims that conflict across papers, ranked by severity.
          </p>
          {error && <p className="text-sm text-destructive mt-1">{error}</p>}
        </div>
        <Button onClick={runContradictionDetection} disabled={isDetecting}>
          {isDetecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isDetecting ? "Detecting..." : "Run Detection"}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <ContradictionList contradictions={contradictions} />
        <ClaimCompare />
      </div>
    </div>
  );
}
