import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface Gap {
  id: string;
  description: string;
  gapType: string;
  significance: number;
  topicIds: string[];
}

interface GapListProps {
  gaps: Gap[];
}

export function GapList({ gaps }: GapListProps) {
  if (gaps.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground">
        <Search className="size-10 opacity-50" />
        <p className="text-sm">
          No knowledge gaps identified yet. Upload papers to begin analysis.
        </p>
      </div>
    );
  }

  const sorted = [...gaps].sort((a, b) => b.significance - a.significance);

  return (
    <div className="space-y-3">
      {sorted.map((gap, index) => (
        <Card key={gap.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                #{index + 1} Knowledge Gap
              </CardTitle>
              <Badge variant="secondary">{gap.gapType}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{gap.description}</p>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Significance</span>
                <span>{Math.round(gap.significance * 100)}%</span>
              </div>
              <Progress value={gap.significance * 100} className="h-1.5" />
            </div>
            {gap.topicIds.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {gap.topicIds.map((topicId) => (
                  <Badge key={topicId} variant="outline" className="text-xs">
                    {topicId}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
