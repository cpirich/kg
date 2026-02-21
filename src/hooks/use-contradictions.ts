"use client";

import { getAIClient, getModelName } from "@/lib/ai/client";
import { detectContradictions } from "@/lib/ai/contradiction-detector";
import { db } from "@/lib/db/schema";
import type { Contradiction } from "@/types/domain";
import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useState } from "react";

interface UseContradictionsResult {
  contradictions: Contradiction[];
  isLoading: boolean;
  isDetecting: boolean;
  error: string | null;
  runContradictionDetection: () => Promise<void>;
}

/**
 * Reactive hook for accessing and detecting contradictions.
 * Uses useLiveQuery for reactive data from IndexedDB.
 * Includes runContradictionDetection() to trigger the detection pipeline.
 */
export function useContradictions(): UseContradictionsResult {
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contradictions = useLiveQuery(() => db.contradictions.toArray(), []);

  const runContradictionDetection = useCallback(async () => {
    if (isDetecting) return;
    setIsDetecting(true);
    setError(null);

    try {
      const client = await getAIClient();
      const model = await getModelName();

      // Read all claims from DB
      const claims = await db.claims.toArray();

      if (claims.length < 2) {
        setError("Need at least 2 claims to detect contradictions.");
        return;
      }

      // Run the detection pipeline
      const detected = await detectContradictions(claims, client, model);

      // Clear existing contradictions before storing new ones
      await db.contradictions.clear();

      // Store new contradictions in DB
      if (detected.length > 0) {
        await db.contradictions.bulkPut(detected);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to detect contradictions",
      );
    } finally {
      setIsDetecting(false);
    }
  }, [isDetecting]);

  return {
    contradictions: contradictions ?? [],
    isLoading: contradictions === undefined,
    isDetecting,
    error,
    runContradictionDetection,
  };
}
