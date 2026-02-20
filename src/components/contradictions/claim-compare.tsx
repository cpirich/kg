import { ArrowLeftRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ClaimCompare() {
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
