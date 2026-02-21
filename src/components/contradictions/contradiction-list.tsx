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
  onSelect?: (id: string) => void;
  selectedId?: string | null;
  onStatusChange?: (id: string, status: "confirmed" | "dismissed") => void;
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

export function ContradictionList({
  contradictions,
  onSelect,
  selectedId,
  onStatusChange,
}: ContradictionListProps) {
  if (contradictions.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground">
        <AlertTriangle className="size-10 opacity-50" />
        <p className="text-sm">
          Run detection above to identify contradictions across your papers.
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
        const isConfirmed = contradiction.status === "confirmed";
        const isDismissed = contradiction.status === "dismissed";
        return (
          <Card
            key={contradiction.id}
            className={`border-l-4 ${config.borderColor} ${selectedId === contradiction.id ? "ring-2 ring-primary" : ""} ${onSelect ? "cursor-pointer" : ""} ${isDismissed ? "opacity-60" : ""}`}
            onClick={() => onSelect?.(contradiction.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Contradiction</CardTitle>
                <div className="flex items-center gap-2">
                  {isConfirmed && (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                      <Check className="mr-1 size-3" />
                      Confirmed
                    </Badge>
                  )}
                  {isDismissed && (
                    <Badge variant="secondary">
                      <X className="mr-1 size-3" />
                      Dismissed
                    </Badge>
                  )}
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
              <Button
                size="sm"
                variant="outline"
                disabled={isConfirmed}
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange?.(contradiction.id, "confirmed");
                }}
              >
                <Check className="size-3" />
                Confirm
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={isDismissed}
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange?.(contradiction.id, "dismissed");
                }}
              >
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
