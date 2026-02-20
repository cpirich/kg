"use client";

import { db } from "@/lib/db/schema";
import type { Document, DocumentId } from "@/types/domain";
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
    [db.documents, db.textChunks, db.claims],
    async () => {
      // Get claim IDs to clean up topic counts
      const claims = await db.claims.where("documentId").equals(id).toArray();
      const claimIds = claims.map((c) => c.id);

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
