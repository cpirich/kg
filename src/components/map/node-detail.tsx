import { Info } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function NodeDetail() {
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
