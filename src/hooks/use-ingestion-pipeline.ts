"use client";

import { extractClaims } from "@/lib/ai/claim-extractor";
import { db } from "@/lib/db/schema";
import { chunkText } from "@/lib/pdf/chunker";
import { extractTextFromPdf } from "@/lib/pdf/extract";
import { hashContent, normalizeLabel } from "@/lib/utils/text";
import type {
  ClaimId,
  Document,
  DocumentId,
  DocumentStatus,
  Topic,
  TopicId,
  TopicRelationship,
} from "@/types/domain";
import { createId } from "@/types/domain";
import { useCallback, useRef, useState } from "react";

interface IngestionProgress {
  documentId: DocumentId | null;
  fileName: string;
  status: DocumentStatus;
  progress: number; // 0-100
  error?: string;
}

interface UseIngestionPipelineResult {
  ingest: (files: File[]) => Promise<void>;
  isProcessing: boolean;
  progress: IngestionProgress[];
}

/**
 * Simple semaphore for limiting concurrency.
 */
function createSemaphore(limit: number) {
  let running = 0;
  const queue: Array<() => void> = [];

  return {
    async acquire(): Promise<void> {
      if (running < limit) {
        running++;
        return;
      }
      return new Promise<void>((resolve) => {
        queue.push(() => {
          running++;
          resolve();
        });
      });
    },
    release(): void {
      running--;
      const next = queue.shift();
      if (next) next();
    },
  };
}

/**
 * Update the document status and progress in the database.
 */
async function setDocumentStatus(
  id: DocumentId,
  status: DocumentStatus,
  progress: number,
  error?: string,
): Promise<void> {
  await db.documents.update(id, {
    status,
    progress,
    error,
    updatedAt: Date.now(),
  });
}

/**
 * Find or create a topic by its normalized label.
 * Returns the topic ID.
 *
 * @param seenDocIds - tracks which documentIds have already been counted for
 *   each topic within a single ingestSingleFile call so documentCount is only
 *   incremented once per document.
 */
async function upsertTopic(
  rawLabel: string,
  documentId: DocumentId,
  seenDocIds: Map<TopicId, Set<DocumentId>>,
): Promise<TopicId> {
  const normalized = normalizeLabel(rawLabel);

  const existing = await db.topics
    .where("normalizedLabel")
    .equals(normalized)
    .first();

  if (existing) {
    const seen = seenDocIds.get(existing.id);
    const isNewDoc = !seen || !seen.has(documentId);

    await db.topics.update(existing.id, {
      claimCount: existing.claimCount + 1,
      ...(isNewDoc ? { documentCount: existing.documentCount + 1 } : {}),
    });

    if (isNewDoc) {
      if (!seen) {
        seenDocIds.set(existing.id, new Set([documentId]));
      } else {
        seen.add(documentId);
      }
    }

    return existing.id;
  }

  const topicId = createId<TopicId>("topic");
  const topic: Topic = {
    id: topicId,
    label: rawLabel.trim(),
    normalizedLabel: normalized,
    claimCount: 1,
    documentCount: 1,
  };
  await db.topics.put(topic);
  seenDocIds.set(topicId, new Set([documentId]));
  return topicId;
}

/**
 * Create or update TopicRelationship records for topics that co-occur
 * across claims in the same document.
 */
async function createTopicRelationships(documentId: DocumentId): Promise<void> {
  // Gather all claims for this document
  const claims = await db.claims
    .where("documentId")
    .equals(documentId)
    .toArray();

  // Collect all unique topic IDs across all claims in this document
  const allTopicIds = new Set<TopicId>();
  for (const claim of claims) {
    for (const tid of claim.topicIds) {
      allTopicIds.add(tid);
    }
  }

  // Count co-occurrences: two topics co-occur when they appear in the same
  // claim, or across different claims in the same document.
  // We pair every topic from every claim with every other topic from every
  // claim, but use a canonical ordering to avoid duplicates.
  const pairWeights = new Map<string, number>();

  // For each pair of claims (including a claim paired with itself),
  // pair their topics
  for (const claim of claims) {
    // Within the same claim, pair all topics with each other
    const topics = claim.topicIds;
    for (let i = 0; i < topics.length; i++) {
      for (let j = i + 1; j < topics.length; j++) {
        const [a, b] =
          topics[i] < topics[j]
            ? [topics[i], topics[j]]
            : [topics[j], topics[i]];
        const key = `${a}::${b}`;
        pairWeights.set(key, (pairWeights.get(key) ?? 0) + 1);
      }
    }
  }

  // Also pair topics across different claims in the same document
  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      for (const tA of claims[i].topicIds) {
        for (const tB of claims[j].topicIds) {
          if (tA === tB) continue;
          const [a, b] = tA < tB ? [tA, tB] : [tB, tA];
          const key = `${a}::${b}`;
          pairWeights.set(key, (pairWeights.get(key) ?? 0) + 1);
        }
      }
    }
  }

  // Upsert each relationship
  for (const [key, weight] of pairWeights) {
    const [sourceId, targetId] = key.split("::") as [TopicId, TopicId];

    const existing = await db.topicRelationships
      .where("sourceId")
      .equals(sourceId)
      .filter((r) => r.targetId === targetId && r.type === "related")
      .first();

    if (existing) {
      await db.topicRelationships.update(existing.id, {
        weight: existing.weight + weight,
      });
    } else {
      const rel: TopicRelationship = {
        id: createId<string>("rel"),
        sourceId,
        targetId,
        type: "related",
        weight,
      };
      await db.topicRelationships.put(rel);
    }
  }
}

/**
 * Hook that orchestrates the full document ingestion pipeline.
 */
export function useIngestionPipeline(): UseIngestionPipelineResult {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<IngestionProgress[]>([]);
  const processingRef = useRef(false);

  const updateProgress = useCallback(
    (index: number, update: Partial<IngestionProgress>) => {
      setProgress((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], ...update };
        return next;
      });
    },
    [],
  );

  const ingestSingleFile = useCallback(
    async (file: File, index: number) => {
      const isText = file.type === "text/plain" || file.name.endsWith(".txt");
      const fileType: "pdf" | "text" = isText ? "text" : "pdf";
      const documentId = createId<DocumentId>("doc");

      // Track which documents each topic has already counted so we only
      // increment documentCount once per topic per ingestion run.
      const seenDocIds = new Map<TopicId, Set<DocumentId>>();

      updateProgress(index, {
        documentId,
        fileName: file.name,
        status: "uploading",
        progress: 0,
      });

      try {
        // Step 1: Hash for dedup — read file text once and reuse for text files
        const fileContent = await file.text();
        const hash = await hashContent(fileContent);

        // Check for duplicate
        const existingDoc = await db.documents
          .where("hash")
          .equals(hash)
          .first();
        if (existingDoc) {
          updateProgress(index, {
            status: "error",
            progress: 0,
            error: `Duplicate: "${existingDoc.name}" has already been uploaded.`,
          });
          return;
        }

        // Step 2: Create document record
        const doc: Document = {
          id: documentId,
          name: file.name,
          hash,
          size: file.size,
          type: fileType,
          status: "uploading",
          progress: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await db.documents.put(doc);
        updateProgress(index, { status: "uploading", progress: 10 });

        // Step 3: Extract text
        await setDocumentStatus(documentId, "extracting", 15);
        updateProgress(index, { status: "extracting", progress: 15 });

        let text: string;
        if (fileType === "pdf") {
          text = await extractTextFromPdf(file);
        } else {
          // Reuse the content already read during hashing
          text = fileContent;
        }

        if (!text.trim()) {
          throw new Error("No text content could be extracted from the file.");
        }

        updateProgress(index, { progress: 30 });

        // Step 4: Chunk text
        await setDocumentStatus(documentId, "chunking", 35);
        updateProgress(index, { status: "chunking", progress: 35 });

        const settings = await db.appSettings.get("settings");
        const chunks = chunkText(text, documentId, {
          chunkSize: settings?.chunkSize ?? 1500,
          chunkOverlap: settings?.chunkOverlap ?? 200,
        });

        // Store chunks
        await db.textChunks.bulkPut(chunks);
        updateProgress(index, { progress: 40 });

        // Step 5: AI claim extraction (concurrency limit 2)
        await setDocumentStatus(documentId, "analyzing", 45);
        updateProgress(index, { status: "analyzing", progress: 45 });

        const semaphore = createSemaphore(2);
        const totalChunks = chunks.length;
        let completedChunks = 0;

        const chunkPromises = chunks.map(async (chunk) => {
          await semaphore.acquire();
          try {
            const result = await extractClaims(chunk.content);

            if (result.error) {
              console.warn(
                `Claim extraction warning for chunk ${chunk.chunkIndex}: ${result.error}`,
              );
            }

            // Step 6: Normalize topics and store claims
            for (const extracted of result.claims) {
              const topicIds: TopicId[] = [];
              for (const rawTopic of extracted.topics) {
                const topicId = await upsertTopic(
                  rawTopic,
                  documentId,
                  seenDocIds,
                );
                topicIds.push(topicId);
              }

              const claimId = createId<ClaimId>("claim");
              await db.claims.put({
                id: claimId,
                documentId,
                chunkId: chunk.id,
                text: extracted.text,
                type: extracted.type,
                confidence: extracted.confidence,
                topicIds,
                createdAt: Date.now(),
              });
            }

            completedChunks++;
            const chunkProgress =
              45 + Math.round((completedChunks / totalChunks) * 50);
            updateProgress(index, { progress: chunkProgress });
            await setDocumentStatus(documentId, "analyzing", chunkProgress);
          } finally {
            semaphore.release();
          }
        });

        await Promise.all(chunkPromises);

        // Step 6b: Build topic relationships from co-occurrence
        await createTopicRelationships(documentId);

        // Step 7: Mark complete
        await setDocumentStatus(documentId, "complete", 100);
        updateProgress(index, { status: "complete", progress: 100 });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown error during ingestion";
        await setDocumentStatus(documentId, "error", 0, message);
        updateProgress(index, { status: "error", progress: 0, error: message });
      }
    },
    [updateProgress],
  );

  const ingest = useCallback(
    async (files: File[]) => {
      if (processingRef.current) return;
      processingRef.current = true;
      setIsProcessing(true);

      const initialProgress: IngestionProgress[] = files.map((f) => ({
        documentId: null,
        fileName: f.name,
        status: "uploading" as DocumentStatus,
        progress: 0,
      }));
      setProgress(initialProgress);

      // Process files sequentially to avoid overwhelming the browser
      for (let i = 0; i < files.length; i++) {
        await ingestSingleFile(files[i], i);
      }

      setIsProcessing(false);
      processingRef.current = false;
    },
    [ingestSingleFile],
  );

  return { ingest, isProcessing, progress };
}
