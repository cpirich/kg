"use client";

import { db } from "@/lib/db/schema";
import type { Claim, DocumentId, TopicId } from "@/types/domain";
import { useLiveQuery } from "dexie-react-hooks";

/**
 * Reactive hook for accessing claims from IndexedDB.
 * Optionally filter by documentId.
 */
export function useClaims(documentId?: DocumentId) {
  const claims = useLiveQuery(() => {
    if (documentId) {
      return db.claims.where("documentId").equals(documentId).toArray();
    }
    return db.claims.toArray();
  }, [documentId]);

  return {
    claims: claims ?? [],
    isLoading: claims === undefined,
  };
}

/**
 * Get all claims associated with a specific topic.
 */
export async function getClaimsByTopic(topicId: TopicId): Promise<Claim[]> {
  // Use the multi-entry index on topicIds
  return db.claims.where("topicIds").equals(topicId).toArray();
}
