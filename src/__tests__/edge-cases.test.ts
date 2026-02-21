import { chunkText } from "@/lib/pdf/chunker";
import { hashContent, normalizeLabel } from "@/lib/utils/text";
import type {
  Claim,
  ClaimId,
  Document,
  DocumentId,
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

describe("edge case: duplicate upload detection", () => {
  it("detects same SHA-256 hash and rejects duplicate", async () => {
    const content = "This is a scientific paper about neural networks.";
    const hash = await hashContent(content);

    // First upload
    const doc1: Document = {
      id: createId<DocumentId>("doc"),
      name: "paper-v1.txt",
      hash,
      size: content.length,
      type: "text",
      status: "complete",
      progress: 100,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.documents.put(doc1);

    // Second upload attempt with same content
    const hash2 = await hashContent(content);
    expect(hash2).toBe(hash);

    const existing = await db.documents.where("hash").equals(hash2).first();
    expect(existing).toBeDefined();
    expect(existing?.name).toBe("paper-v1.txt");
  });

  it("allows uploads with different content", async () => {
    const content1 = "First paper content.";
    const content2 = "Second paper content.";
    const hash1 = await hashContent(content1);
    const hash2 = await hashContent(content2);

    expect(hash1).not.toBe(hash2);

    await db.documents.put({
      id: createId<DocumentId>("doc"),
      name: "first.txt",
      hash: hash1,
      size: content1.length,
      type: "text",
      status: "complete",
      progress: 100,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const existing = await db.documents.where("hash").equals(hash2).first();
    expect(existing).toBeUndefined();
  });
});

describe("edge case: very short text", () => {
  it("text shorter than chunk size produces exactly one chunk", () => {
    const docId = createId<DocumentId>("doc");
    const shortText = "Short.";
    const chunks = chunkText(shortText, docId, {
      chunkSize: 1500,
      chunkOverlap: 200,
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(shortText);
    expect(chunks[0].startOffset).toBe(0);
    expect(chunks[0].endOffset).toBe(shortText.length);
    expect(chunks[0].chunkIndex).toBe(0);
  });

  it("single character text produces exactly one chunk", () => {
    const docId = createId<DocumentId>("doc");
    const chunks = chunkText("A", docId, {
      chunkSize: 1500,
      chunkOverlap: 200,
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("A");
  });
});

describe("edge case: no topics extracted", () => {
  it("stores claims with empty topic list", async () => {
    const claim: Claim = {
      id: createId<ClaimId>("claim"),
      documentId: createId<DocumentId>("doc"),
      chunkId: createId("chunk"),
      text: "A vague statement with no identifiable topics.",
      type: "claim",
      confidence: 0.5,
      topicIds: [],
      createdAt: Date.now(),
    };

    await db.claims.put(claim);
    const retrieved = await db.claims.get(claim.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.topicIds).toHaveLength(0);
  });
});

describe("edge case: topic label normalization", () => {
  it('normalizes "Cells", "cells", and " CELLS " to the same label', () => {
    const norm1 = normalizeLabel("Cells");
    const norm2 = normalizeLabel("cells");
    const norm3 = normalizeLabel(" CELLS ");

    expect(norm1).toBe(norm2);
    expect(norm2).toBe(norm3);
    // All should be "cell" (lowercase, trimmed, singularized)
    expect(norm1).toBe("cell");
  });

  it("deduplicates topics with different casing in the DB", async () => {
    const labels = ["Neural Networks", "neural networks", " NEURAL NETWORKS "];
    const topicIds: TopicId[] = [];

    for (const label of labels) {
      const normalized = normalizeLabel(label);
      const existing = await db.topics
        .where("normalizedLabel")
        .equals(normalized)
        .first();

      if (existing) {
        await db.topics.update(existing.id, {
          claimCount: existing.claimCount + 1,
        });
        topicIds.push(existing.id);
      } else {
        const id = createId<TopicId>("topic");
        await db.topics.put({
          id,
          label: label.trim(),
          normalizedLabel: normalized,
          claimCount: 1,
          documentCount: 1,
        });
        topicIds.push(id);
      }
    }

    // Should all resolve to the same topic
    const allTopics = await db.topics.toArray();
    expect(allTopics).toHaveLength(1);
    expect(allTopics[0].claimCount).toBe(3);

    // All IDs should be the same
    expect(topicIds[0]).toBe(topicIds[1]);
    expect(topicIds[1]).toBe(topicIds[2]);
  });
});

describe("edge case: single document upload", () => {
  it("works correctly end-to-end with one document", async () => {
    const content =
      "This paper studies the effects of temperature on enzyme activity. We found that enzyme activity increases linearly with temperature up to 37 degrees Celsius.";
    const hash = await hashContent(content);
    const docId = createId<DocumentId>("doc");

    // Create document
    const doc: Document = {
      id: docId,
      name: "enzyme-study.txt",
      hash,
      size: content.length,
      type: "text",
      status: "uploading",
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.documents.put(doc);

    // Chunk
    const chunks = chunkText(content, docId, {
      chunkSize: 1500,
      chunkOverlap: 200,
    });
    await db.textChunks.bulkPut(chunks);

    // Store mock claims
    const topicId = createId<TopicId>("topic");
    await db.topics.put({
      id: topicId,
      label: "enzyme activity",
      normalizedLabel: normalizeLabel("enzyme activity"),
      claimCount: 1,
      documentCount: 1,
    });

    await db.claims.put({
      id: createId<ClaimId>("claim"),
      documentId: docId,
      chunkId: chunks[0].id,
      text: "Enzyme activity increases linearly with temperature up to 37C.",
      type: "finding",
      confidence: 0.9,
      topicIds: [topicId],
      createdAt: Date.now(),
    });

    // Complete
    await db.documents.update(docId, {
      status: "complete",
      progress: 100,
      updatedAt: Date.now(),
    });

    // Verify everything
    const finalDoc = await db.documents.get(docId);
    expect(finalDoc?.status).toBe("complete");

    const storedChunks = await db.textChunks
      .where("documentId")
      .equals(docId)
      .toArray();
    expect(storedChunks).toHaveLength(1);

    const storedClaims = await db.claims
      .where("documentId")
      .equals(docId)
      .toArray();
    expect(storedClaims).toHaveLength(1);

    const storedTopics = await db.topics.toArray();
    expect(storedTopics).toHaveLength(1);
  });
});

describe("edge case: large number of chunks", () => {
  it("handles 20+ chunks correctly", () => {
    const docId = createId<DocumentId>("doc");
    // Generate long text that will produce many chunks
    const sentence = "This is a test sentence about various research topics. ";
    const text = sentence.repeat(600); // ~33,000 chars

    const chunks = chunkText(text, docId, {
      chunkSize: 1500,
      chunkOverlap: 200,
    });

    expect(chunks.length).toBeGreaterThanOrEqual(20);

    // All chunks should have sequential indexes
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].chunkIndex).toBe(i);
      expect(chunks[i].documentId).toBe(docId);
    }

    // First chunk starts at 0
    expect(chunks[0].startOffset).toBe(0);

    // Last chunk ends at text length
    expect(chunks[chunks.length - 1].endOffset).toBe(text.length);

    // All chunk IDs should be unique
    const ids = new Set(chunks.map((c) => c.id));
    expect(ids.size).toBe(chunks.length);
  });

  it("stores 20+ chunks in the database correctly", async () => {
    const docId = createId<DocumentId>("doc");
    const sentence = "Another test sentence for bulk chunk storage. ";
    const text = sentence.repeat(600);

    const chunks = chunkText(text, docId, {
      chunkSize: 1500,
      chunkOverlap: 200,
    });

    expect(chunks.length).toBeGreaterThanOrEqual(20);

    // Store all chunks
    await db.textChunks.bulkPut(chunks);

    // Verify all stored
    const stored = await db.textChunks
      .where("documentId")
      .equals(docId)
      .toArray();
    expect(stored).toHaveLength(chunks.length);
  });
});
