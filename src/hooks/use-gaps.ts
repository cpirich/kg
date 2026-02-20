"use client";

import { getAIClient, getModelName } from "@/lib/ai/client";
import { analyzeGaps } from "@/lib/ai/gap-analyzer";
import { generateQuestions } from "@/lib/ai/question-generator";
import { db } from "@/lib/db/schema";
import type { KnowledgeGap, ResearchQuestion } from "@/types/domain";
import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useState } from "react";

interface UseGapsResult {
  gaps: KnowledgeGap[];
  questions: ResearchQuestion[];
  isLoading: boolean;
  isAnalyzing: boolean;
  error: string | null;
  runGapAnalysis: () => Promise<void>;
}

/**
 * Reactive hook for accessing knowledge gaps and research questions.
 * Uses useLiveQuery for reactive data from IndexedDB.
 * Includes runGapAnalysis() to trigger the gap analysis and question generation pipeline.
 */
export function useGaps(): UseGapsResult {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gaps = useLiveQuery(() => db.knowledgeGaps.toArray(), []);

  const questions = useLiveQuery(
    () => db.researchQuestions.orderBy("overallScore").reverse().toArray(),
    [],
  );

  const runGapAnalysis = useCallback(async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setError(null);

    try {
      const client = await getAIClient();
      const model = await getModelName();

      // Read data from DB
      const topics = await db.topics.toArray();
      const relationships = await db.topicRelationships.toArray();
      const claims = await db.claims.toArray();

      if (topics.length === 0) {
        setError("No topics found. Ingest some documents first.");
        return;
      }

      // Run gap analysis
      const detectedGaps = await analyzeGaps(
        topics,
        relationships,
        claims,
        client,
        model,
      );

      // Clear existing gaps and questions before storing new ones
      await db.knowledgeGaps.clear();
      await db.researchQuestions.clear();

      // Store gaps in DB
      if (detectedGaps.length > 0) {
        await db.knowledgeGaps.bulkPut(detectedGaps);
      }

      // Generate research questions for each gap
      const allQuestions: ResearchQuestion[] = [];
      for (const gap of detectedGaps) {
        // Gather surrounding claims (claims that share topics with this gap)
        const surroundingClaims = claims.filter((claim) =>
          claim.topicIds.some((topicId) => gap.topicIds.includes(topicId)),
        );

        const gapTopics = topics.filter((t) => gap.topicIds.includes(t.id));
        const generated = await generateQuestions(
          gap,
          surroundingClaims,
          gapTopics,
          client,
          model,
        );
        allQuestions.push(...generated);
      }

      // Store questions in DB
      if (allQuestions.length > 0) {
        await db.researchQuestions.bulkPut(allQuestions);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze gaps");
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing]);

  return {
    gaps: gaps ?? [],
    questions: questions ?? [],
    isLoading: gaps === undefined || questions === undefined,
    isAnalyzing,
    error,
    runGapAnalysis,
  };
}
