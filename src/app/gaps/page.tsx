"use client";

import { GapList } from "@/components/gaps/gap-list";
import { QuestionList } from "@/components/gaps/question-list";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGaps } from "@/hooks/use-gaps";
import { db } from "@/lib/db/schema";
import { useLiveQuery } from "dexie-react-hooks";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";

export default function GapsPage() {
  const { gaps, questions, isAnalyzing, analysisStatus, error, runGapAnalysis } =
    useGaps();

  const topics = useLiveQuery(() => db.topics.toArray(), []);
  const topicNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of topics ?? []) {
      map[t.id] = t.label;
    }
    return map;
  }, [topics]);

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

      {isAnalyzing && analysisStatus && (
        <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          {analysisStatus}
        </div>
      )}

      <Tabs defaultValue="gaps">
        <TabsList>
          <TabsTrigger value="gaps">Knowledge Gaps</TabsTrigger>
          <TabsTrigger value="questions">Research Questions</TabsTrigger>
        </TabsList>
        <TabsContent value="gaps" className="mt-4">
          <GapList gaps={gaps} topicNames={topicNames} />
        </TabsContent>
        <TabsContent value="questions" className="mt-4">
          <QuestionList questions={questions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
