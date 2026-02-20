"use client";

import { ClaimCompare } from "@/components/contradictions/claim-compare";
import { ContradictionList } from "@/components/contradictions/contradiction-list";

export default function ContradictionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Contradictions</h2>
        <p className="text-muted-foreground">
          Claims that conflict across papers, ranked by severity.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <ContradictionList contradictions={[]} />
        <ClaimCompare />
      </div>
    </div>
  );
}
