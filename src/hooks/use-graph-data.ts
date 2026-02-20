"use client";

import { db } from "@/lib/db/schema";
import { buildGraphElements } from "@/lib/graph/builder";
import type { GraphElement } from "@/types/graph";
import { useLiveQuery } from "dexie-react-hooks";

interface UseGraphDataResult {
  elements: GraphElement[];
  isLoading: boolean;
}

/**
 * Reactive hook that reads topics, relationships, and gaps from DB
 * and returns Cytoscape.js graph elements via buildGraphElements().
 * Automatically updates when underlying data changes.
 */
export function useGraphData(): UseGraphDataResult {
  const topics = useLiveQuery(() => db.topics.toArray(), []);
  const relationships = useLiveQuery(() => db.topicRelationships.toArray(), []);
  const gaps = useLiveQuery(() => db.knowledgeGaps.toArray(), []);

  const isLoading =
    topics === undefined || relationships === undefined || gaps === undefined;

  const elements = isLoading
    ? []
    : buildGraphElements(topics, relationships, gaps);

  return {
    elements,
    isLoading,
  };
}
