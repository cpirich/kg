"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeftRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db/schema";
import type { ContradictionId } from "@/types/domain";

interface ClaimCompareProps {
  contradictionId?: string | null;
}

export function ClaimCompare({ contradictionId }: ClaimCompareProps) {
  const contradiction = useLiveQuery(
    () =>
      contradictionId
        ? db.contradictions.get(contradictionId as ContradictionId)
        : undefined,
    [contradictionId],
  );

  const claimA = useLiveQuery(
    () => (contradiction ? db.claims.get(contradiction.claimAId) : undefined),
    [contradiction],
  );

  const claimB = useLiveQuery(
    () => (contradiction ? db.claims.get(contradiction.claimBId) : undefined),
    [contradiction],
  );

  if (!contradictionId || !contradiction || !claimA || !claimB) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Claim Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <ArrowLeftRight className="size-8 opacity-50" />
            <p className="text-center text-sm">
              Select a contradiction to compare the conflicting claims side by
              side.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Claim Comparison</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Claim A
          </p>
          <p className="text-sm">{claimA.text}</p>
        </div>
        <div className="flex justify-center">
          <ArrowLeftRight className="size-4 text-muted-foreground" />
        </div>
        <div className="rounded-md border p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Claim B
          </p>
          <p className="text-sm">{claimB.text}</p>
        </div>
        <div className="rounded-md bg-muted p-3">
          <p className="text-sm">{contradiction.description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
