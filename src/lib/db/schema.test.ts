import type {
  Claim,
  ClaimId,
  Contradiction,
  ContradictionId,
  Document,
  DocumentId,
  GapId,
  KnowledgeGap,
  QuestionId,
  ResearchQuestion,
  TextChunk,
  Topic,
  TopicId,
  TopicRelationship,
} from "@/types/domain";
import { createId } from "@/types/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { KnowledgeGapDB } from "./schema";

let db: KnowledgeGapDB;

beforeEach(() => {
  // Create a fresh DB instance for each test to avoid cross-test contamination
  db = new KnowledgeGapDB();
});

afterEach(async () => {
  await db.delete();
});

describe("documents table", () => {
  it("can add and retrieve a document", async () => {
    const doc: Document = {
      id: createId<DocumentId>("doc"),
      name: "test.pdf",
      hash: "abc123",
      size: 1024,
      type: "pdf",
      status: "complete",
      progress: 100,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.documents.put(doc);
    const retrieved = await db.documents.get(doc.id);
    expect(retrieved).toEqual(doc);
  });

  it("can query by hash index", async () => {
    const doc: Document = {
      id: createId<DocumentId>("doc"),
      name: "test.pdf",
      hash: "unique-hash-123",
      size: 1024,
      type: "pdf",
      status: "complete",
      progress: 100,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.documents.put(doc);
    const found = await db.documents
      .where("hash")
      .equals("unique-hash-123")
      .first();
    expect(found?.id).toBe(doc.id);
  });

  it("can query by status index", async () => {
    const doc1: Document = {
      id: createId<DocumentId>("doc"),
      name: "a.pdf",
      hash: "h1",
      size: 100,
      type: "pdf",
      status: "complete",
      progress: 100,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const doc2: Document = {
      id: createId<DocumentId>("doc"),
      name: "b.pdf",
      hash: "h2",
      size: 200,
      type: "pdf",
      status: "error",
      progress: 0,
      error: "Failed",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.documents.bulkPut([doc1, doc2]);
    const errorDocs = await db.documents
      .where("status")
      .equals("error")
      .toArray();
    expect(errorDocs).toHaveLength(1);
    expect(errorDocs[0].name).toBe("b.pdf");
  });

  it("can update a document", async () => {
    const doc: Document = {
      id: createId<DocumentId>("doc"),
      name: "test.pdf",
      hash: "abc",
      size: 1024,
      type: "pdf",
      status: "uploading",
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.documents.put(doc);
    await db.documents.update(doc.id, { status: "complete", progress: 100 });
    const updated = await db.documents.get(doc.id);
    expect(updated?.status).toBe("complete");
    expect(updated?.progress).toBe(100);
  });

  it("can delete a document", async () => {
    const doc: Document = {
      id: createId<DocumentId>("doc"),
      name: "test.pdf",
      hash: "abc",
      size: 1024,
      type: "pdf",
      status: "complete",
      progress: 100,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.documents.put(doc);
    await db.documents.delete(doc.id);
    const retrieved = await db.documents.get(doc.id);
    expect(retrieved).toBeUndefined();
  });
});

describe("textChunks table", () => {
  it("can add and query chunks by documentId", async () => {
    const docId = createId<DocumentId>("doc");
    const chunk: TextChunk = {
      id: createId("chunk"),
      documentId: docId,
      content: "Some text content",
      startOffset: 0,
      endOffset: 17,
      chunkIndex: 0,
    };

    await db.textChunks.put(chunk);
    const chunks = await db.textChunks
      .where("documentId")
      .equals(docId)
      .toArray();
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("Some text content");
  });
});

describe("claims table", () => {
  it("can add a claim with topic IDs", async () => {
    const claim: Claim = {
      id: createId<ClaimId>("claim"),
      documentId: createId<DocumentId>("doc"),
      chunkId: createId("chunk"),
      text: "Neural networks outperform traditional methods.",
      type: "finding",
      confidence: 0.9,
      topicIds: [createId<TopicId>("topic"), createId<TopicId>("topic")],
      createdAt: Date.now(),
    };

    await db.claims.put(claim);
    const retrieved = await db.claims.get(claim.id);
    expect(retrieved?.topicIds).toHaveLength(2);
  });

  it("can query claims by documentId", async () => {
    const docId = createId<DocumentId>("doc");
    const claim1: Claim = {
      id: createId<ClaimId>("claim"),
      documentId: docId,
      chunkId: createId("chunk"),
      text: "Claim 1",
      type: "finding",
      confidence: 0.8,
      topicIds: [],
      createdAt: Date.now(),
    };
    const claim2: Claim = {
      id: createId<ClaimId>("claim"),
      documentId: docId,
      chunkId: createId("chunk"),
      text: "Claim 2",
      type: "methodology",
      confidence: 0.7,
      topicIds: [],
      createdAt: Date.now(),
    };

    await db.claims.bulkPut([claim1, claim2]);
    const claims = await db.claims.where("documentId").equals(docId).toArray();
    expect(claims).toHaveLength(2);
  });

  it("can query claims by topicIds multi-entry index", async () => {
    const topicId = createId<TopicId>("topic");
    const claim: Claim = {
      id: createId<ClaimId>("claim"),
      documentId: createId<DocumentId>("doc"),
      chunkId: createId("chunk"),
      text: "A claim about a topic",
      type: "claim",
      confidence: 0.85,
      topicIds: [topicId],
      createdAt: Date.now(),
    };

    await db.claims.put(claim);
    const found = await db.claims.where("topicIds").equals(topicId).toArray();
    expect(found).toHaveLength(1);
    expect(found[0].text).toBe("A claim about a topic");
  });
});

describe("topics table", () => {
  it("can add and query by normalizedLabel", async () => {
    const topic: Topic = {
      id: createId<TopicId>("topic"),
      label: "Neural Networks",
      normalizedLabel: "neural network",
      claimCount: 5,
      documentCount: 2,
    };

    await db.topics.put(topic);
    const found = await db.topics
      .where("normalizedLabel")
      .equals("neural network")
      .first();
    expect(found?.label).toBe("Neural Networks");
  });
});

describe("topicRelationships table", () => {
  it("can add and query by sourceId", async () => {
    const sourceId = createId<TopicId>("topic");
    const rel: TopicRelationship = {
      id: `rel_${crypto.randomUUID()}`,
      sourceId,
      targetId: createId<TopicId>("topic"),
      type: "related",
      weight: 0.8,
    };

    await db.topicRelationships.put(rel);
    const found = await db.topicRelationships
      .where("sourceId")
      .equals(sourceId)
      .toArray();
    expect(found).toHaveLength(1);
    expect(found[0].type).toBe("related");
  });
});

describe("contradictions table", () => {
  it("can add and query by status", async () => {
    const contradiction: Contradiction = {
      id: createId<ContradictionId>("contra"),
      claimAId: createId<ClaimId>("claim"),
      claimBId: createId<ClaimId>("claim"),
      description: "Conflicting findings on topic X",
      severity: "high",
      confidence: 0.85,
      status: "pending",
      createdAt: Date.now(),
    };

    await db.contradictions.put(contradiction);
    const pending = await db.contradictions
      .where("status")
      .equals("pending")
      .toArray();
    expect(pending).toHaveLength(1);
  });
});

describe("knowledgeGaps table", () => {
  it("can add and query by gapType", async () => {
    const gap: KnowledgeGap = {
      id: createId<GapId>("gap"),
      description: "Missing longitudinal studies",
      topicIds: [createId<TopicId>("topic")],
      gapType: "temporal",
      significance: 0.9,
      createdAt: Date.now(),
    };

    await db.knowledgeGaps.put(gap);
    const temporal = await db.knowledgeGaps
      .where("gapType")
      .equals("temporal")
      .toArray();
    expect(temporal).toHaveLength(1);
  });
});

describe("researchQuestions table", () => {
  it("can add and query by gapId", async () => {
    const gapId = createId<GapId>("gap");
    const question: ResearchQuestion = {
      id: createId<QuestionId>("q"),
      gapId,
      question: "What is the long-term effect?",
      rationale: "No longitudinal data exists.",
      impact: 8,
      feasibility: 6,
      overallScore: 8 * 0.6 + 6 * 0.4,
      createdAt: Date.now(),
    };

    await db.researchQuestions.put(question);
    const found = await db.researchQuestions
      .where("gapId")
      .equals(gapId)
      .toArray();
    expect(found).toHaveLength(1);
    expect(found[0].overallScore).toBeCloseTo(7.2);
  });
});

describe("appSettings table", () => {
  it("ensureSettings creates defaults on first call", async () => {
    // Use the module-level db for ensureSettings since it imports from schema
    const { ensureSettings: ensure, db: moduleDb } = await import("./schema");
    try {
      const settings = await ensure();
      expect(settings.id).toBe("settings");
      expect(settings.model).toBe("claude-sonnet-4-20250514");
      expect(settings.chunkSize).toBe(1500);
      expect(settings.chunkOverlap).toBe(200);
      expect(settings.apiKey).toBeUndefined();
    } finally {
      // Clean up the module-level db
      await moduleDb.appSettings.clear();
    }
  });

  it("ensureSettings returns existing settings on subsequent calls", async () => {
    const { ensureSettings: ensure, db: moduleDb } = await import("./schema");
    try {
      const first = await ensure();
      // Update the API key
      await moduleDb.appSettings.update("settings", {
        apiKey: "test-key-123",
      });
      const second = await ensure();
      expect(second.apiKey).toBe("test-key-123");
    } finally {
      await moduleDb.appSettings.clear();
    }
  });
});
