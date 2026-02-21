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
  analysisStatus: string | null;
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
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gaps = useLiveQuery(() => db.knowledgeGaps.toArray(), []);

  const questions = useLiveQuery(
    () => db.researchQuestions.orderBy("overallScore").reverse().toArray(),
    [],
  );

  const runGapAnalysis = useCallback(async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setAnalysisStatus("Loading data...");
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
      setAnalysisStatus("Detecting knowledge gaps...");
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

      // Generate research questions for each gap with bounded concurrency
      setAnalysisStatus(
        `Generating questions for ${detectedGaps.length} gaps...`,
      );
      const CONCURRENCY_LIMIT = 3;
      let gapIndex = 0;
      let completedGaps = 0;

      const processNextGap = async (): Promise<void> => {
        while (gapIndex < detectedGaps.length) {
          const currentIndex = gapIndex++;
          const gap = detectedGaps[currentIndex];

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

          // Store questions progressively so UI updates via useLiveQuery
          if (generated.length > 0) {
            await db.researchQuestions.bulkPut(generated);
          }
          completedGaps++;
          setAnalysisStatus(
            `Generated questions for ${completedGaps}/${detectedGaps.length} gaps...`,
          );
        }
      };

      const workers = Array.from(
        { length: Math.min(CONCURRENCY_LIMIT, detectedGaps.length) },
        () => processNextGap(),
      );
      await Promise.all(workers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze gaps");
    } finally {
      setAnalysisStatus(null);
      setIsAnalyzing(false);
    }
  }, [isAnalyzing]);

  return {
    gaps: gaps ?? [],
    questions: questions ?? [],
    isLoading: gaps === undefined || questions === undefined,
    isAnalyzing,
    analysisStatus,
    error,
    runGapAnalysis,
  };
}
