"use client";

import { db } from "@/lib/db/schema";
import type { Document, DocumentId, TopicId } from "@/types/domain";
import { useLiveQuery } from "dexie-react-hooks";

/**
 * Reactive hook for accessing documents from IndexedDB.
 * Returns all documents sorted by creation date (newest first).
 */
export function useDocuments() {
  const documents = useLiveQuery(
    () => db.documents.orderBy("createdAt").reverse().toArray(),
    [],
  );

  return {
    documents: documents ?? [],
    isLoading: documents === undefined,
  };
}

/**
 * Add a new document to the database.
 */
export async function addDocument(doc: Document): Promise<void> {
  await db.documents.put(doc);
}

/**
 * Update an existing document's fields.
 */
export async function updateDocument(
  id: DocumentId,
  changes: Partial<Omit<Document, "id">>,
): Promise<void> {
  await db.documents.update(id, { ...changes, updatedAt: Date.now() });
}

/**
 * Delete a document and all its associated data (chunks, claims).
 */
export async function deleteDocument(id: DocumentId): Promise<void> {
  await db.transaction(
    "rw",
    [db.documents, db.textChunks, db.claims, db.topics, db.topicRelationships],
    async () => {
      // Get claims to collect topic references
      const claims = await db.claims.where("documentId").equals(id).toArray();

      // Collect all unique topicIds and count how many claims reference each topic
      const topicClaimCounts = new Map<TopicId, number>();
      for (const claim of claims) {
        for (const topicId of claim.topicIds) {
          topicClaimCounts.set(
            topicId,
            (topicClaimCounts.get(topicId) ?? 0) + 1,
          );
        }
      }

      // Update topic counts and collect orphaned topics
      const orphanedTopicIds: TopicId[] = [];
      for (const [topicId, count] of topicClaimCounts) {
        const topic = await db.topics.get(topicId);
        if (!topic) continue;

        const newClaimCount = topic.claimCount - count;
        if (newClaimCount <= 0) {
          orphanedTopicIds.push(topicId);
        } else {
          await db.topics.update(topicId, {
            claimCount: newClaimCount,
            documentCount: Math.max(0, topic.documentCount - 1),
          });
        }
      }

      // Delete orphaned topics
      if (orphanedTopicIds.length > 0) {
        await db.topics.bulkDelete(orphanedTopicIds);

        // Delete topic relationships referencing orphaned topics
        const orphanedSet = new Set(orphanedTopicIds);
        const allRelationships = await db.topicRelationships.toArray();
        const relationshipIdsToDelete = allRelationships
          .filter(
            (r) => orphanedSet.has(r.sourceId) || orphanedSet.has(r.targetId),
          )
          .map((r) => r.id);
        if (relationshipIdsToDelete.length > 0) {
          await db.topicRelationships.bulkDelete(relationshipIdsToDelete);
        }
      }

      // Delete claims
      await db.claims.where("documentId").equals(id).delete();

      // Delete chunks
      await db.textChunks.where("documentId").equals(id).delete();

      // Delete the document
      await db.documents.delete(id);
    },
  );
}

/**
 * Find a document by its content hash (for deduplication).
 */
export async function getDocumentByHash(
  hash: string,
): Promise<Document | undefined> {
  return db.documents.where("hash").equals(hash).first();
}
