import { AlertTriangle, Check, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Contradiction {
  id: string;
  description: string;
  severity: "low" | "medium" | "high";
  confidence: number;
  status: string;
}

interface ContradictionListProps {
  contradictions: Contradiction[];
}

const severityConfig = {
  high: {
    label: "High",
    borderColor: "border-l-red-500",
    badgeClassName: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  },
  medium: {
    label: "Medium",
    borderColor: "border-l-orange-500",
    badgeClassName:
      "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  },
  low: {
    label: "Low",
    borderColor: "border-l-yellow-500",
    badgeClassName:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  },
};

const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

export function ContradictionList({ contradictions }: ContradictionListProps) {
  if (contradictions.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground">
        <AlertTriangle className="size-10 opacity-50" />
        <p className="text-sm">
          No contradictions detected yet. Upload papers to begin analysis.
        </p>
      </div>
    );
  }

  const sorted = [...contradictions].sort(
    (a, b) =>
      (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3),
  );

  return (
    <div className="space-y-3">
      {sorted.map((contradiction) => {
        const config = severityConfig[contradiction.severity];
        return (
          <Card
            key={contradiction.id}
            className={`border-l-4 ${config.borderColor}`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Contradiction</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={config.badgeClassName}>
                    {config.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(contradiction.confidence * 100)}% confidence
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{contradiction.description}</p>
            </CardContent>
            <CardFooter className="gap-2">
              <Button size="sm" variant="outline">
                <Check className="size-3" />
                Confirm
              </Button>
              <Button size="sm" variant="ghost">
                <X className="size-3" />
                Dismiss
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
