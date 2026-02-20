"use client";

import { GapList } from "@/components/gaps/gap-list";
import { QuestionList } from "@/components/gaps/question-list";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGaps } from "@/hooks/use-gaps";
import { Loader2 } from "lucide-react";

export default function GapsPage() {
  const { gaps, questions, isAnalyzing, error, runGapAnalysis } = useGaps();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Knowledge Gaps</h2>
          <p className="text-muted-foreground">
            Under-explored areas and generated research questions.
          </p>
        </div>
        <Button onClick={runGapAnalysis} disabled={isAnalyzing}>
          {isAnalyzing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isAnalyzing ? "Analyzing..." : "Run Analysis"}
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Tabs defaultValue="gaps">
        <TabsList>
          <TabsTrigger value="gaps">Knowledge Gaps</TabsTrigger>
          <TabsTrigger value="questions">Research Questions</TabsTrigger>
        </TabsList>
        <TabsContent value="gaps" className="mt-4">
          <GapList gaps={gaps} />
        </TabsContent>
        <TabsContent value="questions" className="mt-4">
          <QuestionList questions={questions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
