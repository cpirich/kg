import { chunkText } from "@/lib/pdf/chunker";
import { hashContent, normalizeLabel } from "@/lib/utils/text";
import type {
  ClaimId,
  Document,
  DocumentId,
  Topic,
  TopicId,
} from "@/types/domain";
import { createId } from "@/types/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { KnowledgeGapDB } from "../lib/db/schema";

let db: KnowledgeGapDB;

beforeEach(() => {
  db = new KnowledgeGapDB();
});

afterEach(async () => {
  await db.delete();
});

/**
 * Helper: create a document record and store it in the DB.
 */
async function createDocument(
  testDb: KnowledgeGapDB,
  overrides: Partial<Document> = {},
): Promise<Document> {
  const doc: Document = {
    id: createId<DocumentId>("doc"),
    name: "test-paper.txt",
    hash: await hashContent("default content"),
    size: 1024,
    type: "text",
    status: "uploading",
    progress: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
  await testDb.documents.put(doc);
  return doc;
}

/**
 * Helper: simulate claim extraction from AI (mocked).
 * Returns a set of claims with topics, as if the AI had extracted them.
 */
function mockExtractedClaims() {
  return [
    {
      text: "Neural networks outperform SVMs on image classification tasks.",
      type: "finding" as const,
      confidence: 0.92,
      topics: ["neural networks", "image classification"],
    },
    {
      text: "The study used a dataset of 10,000 images.",
      type: "methodology" as const,
      confidence: 0.85,
      topics: ["dataset", "image classification"],
    },
  ];
}

/**
 * Helper: upsert a topic by its normalized label — mirrors the
 * logic from use-ingestion-pipeline.ts without the React hook.
 */
async function upsertTopic(
  testDb: KnowledgeGapDB,
  rawLabel: string,
): Promise<TopicId> {
  const normalized = normalizeLabel(rawLabel);
  const existing = await testDb.topics
    .where("normalizedLabel")
    .equals(normalized)
    .first();

  if (existing) {
    await testDb.topics.update(existing.id, {
      claimCount: existing.claimCount + 1,
    });
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
  await testDb.topics.put(topic);
  return topicId;
}

describe("ingestion flow: text to DB", () => {
  it("processes text content through chunk → extract → store pipeline", async () => {
    const content =
      "Neural networks have revolutionized image classification. Studies show they outperform SVMs on large datasets. The methodology involves training on 10,000 labeled images.";
    const hash = await hashContent(content);

    // Step 1: Create document
    const doc = await createDocument(db, {
      hash,
      name: "research.txt",
      status: "uploading",
    });

    // Step 2: Update to extracting
    await db.documents.update(doc.id, {
      status: "extracting",
      updatedAt: Date.now(),
    });
    const extracting = await db.documents.get(doc.id);
    expect(extracting?.status).toBe("extracting");

    // Step 3: Chunk the text
    await db.documents.update(doc.id, {
      status: "chunking",
      updatedAt: Date.now(),
    });
    const chunks = chunkText(content, doc.id, {
      chunkSize: 1500,
      chunkOverlap: 200,
    });
    await db.textChunks.bulkPut(chunks);

    // Verify chunks stored
    const storedChunks = await db.textChunks
      .where("documentId")
      .equals(doc.id)
      .toArray();
    expect(storedChunks.length).toBeGreaterThan(0);
    expect(storedChunks[0].documentId).toBe(doc.id);

    // Step 4: Mock AI extraction — simulate storing claims with topics
    await db.documents.update(doc.id, {
      status: "analyzing",
      updatedAt: Date.now(),
    });
    const extracted = mockExtractedClaims();

    for (const claim of extracted) {
      const topicIds: TopicId[] = [];
      for (const rawTopic of claim.topics) {
        const topicId = await upsertTopic(db, rawTopic);
        topicIds.push(topicId);
      }

      await db.claims.put({
        id: createId<ClaimId>("claim"),
        documentId: doc.id,
        chunkId: storedChunks[0].id,
        text: claim.text,
        type: claim.type,
        confidence: claim.confidence,
        topicIds,
        createdAt: Date.now(),
      });
    }

    // Step 5: Mark complete
    await db.documents.update(doc.id, {
      status: "complete",
      progress: 100,
      updatedAt: Date.now(),
    });

    // Verify documents
    const finalDoc = await db.documents.get(doc.id);
    expect(finalDoc?.status).toBe("complete");
    expect(finalDoc?.progress).toBe(100);

    // Verify claims
    const claims = await db.claims.where("documentId").equals(doc.id).toArray();
    expect(claims).toHaveLength(2);
    const claimTexts = claims.map((c) => c.text);
    expect(claimTexts).toContain(
      "Neural networks outperform SVMs on image classification tasks.",
    );
    expect(claims.some((c) => c.type === "methodology")).toBe(true);

    // Verify topics
    const topics = await db.topics.toArray();
    expect(topics.length).toBeGreaterThanOrEqual(2);

    // "image classification" should appear as a shared topic
    const imageClassTopic = topics.find(
      (t) => t.normalizedLabel === normalizeLabel("image classification"),
    );
    expect(imageClassTopic).toBeDefined();
    // Both claims reference "image classification" so claimCount should be 2
    expect(imageClassTopic?.claimCount).toBe(2);
  });

  it("detects duplicate uploads via SHA-256 hash", async () => {
    const content = "Duplicate document content for testing.";
    const hash = await hashContent(content);

    // First upload
    await createDocument(db, { hash, name: "first.txt" });

    // Attempt second upload with same content
    const existingDoc = await db.documents.where("hash").equals(hash).first();
    expect(existingDoc).toBeDefined();
    expect(existingDoc?.name).toBe("first.txt");
  });

  it("handles error during processing with error status", async () => {
    const doc = await createDocument(db, { status: "uploading" });

    // Simulate an error during chunking
    await db.documents.update(doc.id, {
      status: "error",
      progress: 0,
      error: "Failed to extract text from file.",
      updatedAt: Date.now(),
    });

    const errorDoc = await db.documents.get(doc.id);
    expect(errorDoc?.status).toBe("error");
    expect(errorDoc?.error).toBe("Failed to extract text from file.");
    expect(errorDoc?.progress).toBe(0);
  });

  it("produces no chunks for empty content", () => {
    const docId = createId<DocumentId>("doc");
    const chunks = chunkText("", docId);
    expect(chunks).toHaveLength(0);
  });

  it("produces no chunks for whitespace-only content", () => {
    const docId = createId<DocumentId>("doc");
    const chunks = chunkText("   \n  \t  ", docId);
    expect(chunks).toHaveLength(0);
  });

  it("tracks document status transitions correctly", async () => {
    const doc = await createDocument(db, { status: "uploading" });
    const statuses: string[] = [];

    // Track each transition
    const transitions: Array<{
      status: Document["status"];
      progress: number;
    }> = [
      { status: "uploading", progress: 10 },
      { status: "extracting", progress: 15 },
      { status: "chunking", progress: 35 },
      { status: "analyzing", progress: 45 },
      { status: "complete", progress: 100 },
    ];

    for (const { status, progress } of transitions) {
      await db.documents.update(doc.id, {
        status,
        progress,
        updatedAt: Date.now(),
      });
      const updated = await db.documents.get(doc.id);
      statuses.push(updated?.status ?? "unknown");
    }

    expect(statuses).toEqual([
      "uploading",
      "extracting",
      "chunking",
      "analyzing",
      "complete",
    ]);
  });
});
