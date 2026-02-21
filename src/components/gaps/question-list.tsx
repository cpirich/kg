import { HelpCircle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Question {
  id: string;
  question: string;
  rationale: string;
  impact: number;
  feasibility: number;
  overallScore: number;
}

interface QuestionListProps {
  questions: Question[];
}

export function QuestionList({ questions }: QuestionListProps) {
  if (questions.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground">
        <HelpCircle className="size-10 opacity-50" />
        <p className="text-sm">
          No research questions generated yet. Identify knowledge gaps first.
        </p>
      </div>
    );
  }

  const sorted = [...questions].sort((a, b) => b.overallScore - a.overallScore);

  return (
    <div className="space-y-3">
      {sorted.map((q, index) => (
        <Card key={q.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              #{index + 1} Research Question
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm font-medium">{q.question}</p>
            <p className="text-sm text-muted-foreground">{q.rationale}</p>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>Impact</span>
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(q.impact * 10, 100)}%` }}
                  />
                </div>
                <span>{q.impact}/10</span>
              </div>
              <div className="flex items-center gap-2">
                <span>Feasibility</span>
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(q.feasibility * 10, 100)}%` }}
                  />
                </div>
                <span>{q.feasibility}/10</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Score</span>
                <span className="font-medium">
                  {q.overallScore.toFixed(1)}/10
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
