import { db } from "@/lib/db/schema";
import type {
  AppSettings,
  ClaimId,
  Document,
  DocumentId,
  TopicId,
} from "@/types/domain";
import { createId } from "@/types/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearAllData, exportAllData, importAllData } from "./export";

// These tests use the module-level db instance since export.ts imports it directly.
// We clear data between tests to avoid contamination.

beforeEach(async () => {
  await clearAllData();
});

afterEach(async () => {
  await clearAllData();
});

describe("exportAllData", () => {
  it("exports empty DB as valid JSON with empty arrays", async () => {
    const json = await exportAllData();
    const data = JSON.parse(json);

    expect(data.documents).toEqual([]);
    expect(data.textChunks).toEqual([]);
    expect(data.claims).toEqual([]);
    expect(data.topics).toEqual([]);
    expect(data.topicRelationships).toEqual([]);
    expect(data.contradictions).toEqual([]);
    expect(data.knowledgeGaps).toEqual([]);
    expect(data.researchQuestions).toEqual([]);
    expect(data.appSettings).toEqual([]);
  });

  it("exports populated tables with correct data", async () => {
    const doc: Document = {
      id: createId<DocumentId>("doc"),
      name: "test.txt",
      hash: "abc123",
      size: 100,
      type: "text",
      status: "complete",
      progress: 100,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.documents.put(doc);

    const json = await exportAllData();
    const data = JSON.parse(json);

    expect(data.documents).toHaveLength(1);
    expect(data.documents[0].name).toBe("test.txt");
    expect(data.documents[0].hash).toBe("abc123");
  });
});

describe("importAllData", () => {
  it("imports data into all tables", async () => {
    const doc: Document = {
      id: createId<DocumentId>("doc"),
      name: "imported.txt",
      hash: "import-hash",
      size: 200,
      type: "text",
      status: "complete",
      progress: 100,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const importData = {
      documents: [doc],
      textChunks: [],
      claims: [],
      topics: [],
      topicRelationships: [],
      contradictions: [],
      knowledgeGaps: [],
      researchQuestions: [],
      appSettings: [],
    };

    await importAllData(JSON.stringify(importData));

    const docs = await db.documents.toArray();
    expect(docs).toHaveLength(1);
    expect(docs[0].name).toBe("imported.txt");
  });

  it("clears existing data before importing", async () => {
    // Seed existing data
    await db.documents.put({
      id: createId<DocumentId>("doc"),
      name: "existing.txt",
      hash: "existing-hash",
      size: 50,
      type: "text",
      status: "complete",
      progress: 100,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const newDoc: Document = {
      id: createId<DocumentId>("doc"),
      name: "new.txt",
      hash: "new-hash",
      size: 100,
      type: "text",
      status: "complete",
      progress: 100,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await importAllData(
      JSON.stringify({
        documents: [newDoc],
        textChunks: [],
        claims: [],
        topics: [],
        topicRelationships: [],
        contradictions: [],
        knowledgeGaps: [],
        researchQuestions: [],
        appSettings: [],
      }),
    );

    const docs = await db.documents.toArray();
    expect(docs).toHaveLength(1);
    expect(docs[0].name).toBe("new.txt");
  });

  it("throws error on invalid JSON", async () => {
    await expect(importAllData("not valid json{{{")).rejects.toThrow();
  });
});

describe("round-trip export/import", () => {
  it("preserves all data through export then import", async () => {
    // Populate the DB with various records
    const docId = createId<DocumentId>("doc");
    const topicId = createId<TopicId>("topic");
    const claimId = createId<ClaimId>("claim");

    await db.documents.put({
      id: docId,
      name: "roundtrip.txt",
      hash: "roundtrip-hash",
      size: 500,
      type: "text",
      status: "complete",
      progress: 100,
      createdAt: 1000,
      updatedAt: 2000,
    });

    await db.topics.put({
      id: topicId,
      label: "Test Topic",
      normalizedLabel: "test topic",
      claimCount: 1,
      documentCount: 1,
    });

    await db.claims.put({
      id: claimId,
      documentId: docId,
      chunkId: createId("chunk"),
      text: "A test claim.",
      type: "finding",
      confidence: 0.9,
      topicIds: [topicId],
      createdAt: 1000,
    });

    const settings: AppSettings = {
      id: "settings",
      apiKey: "test-key",
      model: "claude-sonnet-4-20250514",
      chunkSize: 1500,
      chunkOverlap: 200,
    };
    await db.appSettings.put(settings);

    // Export
    const exported = await exportAllData();

    // Clear all data
    await clearAllData();
    const emptyDocs = await db.documents.toArray();
    expect(emptyDocs).toHaveLength(0);

    // Import
    await importAllData(exported);

    // Verify
    const docs = await db.documents.toArray();
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe(docId);
    expect(docs[0].name).toBe("roundtrip.txt");

    const topics = await db.topics.toArray();
    expect(topics).toHaveLength(1);
    expect(topics[0].label).toBe("Test Topic");

    const claims = await db.claims.toArray();
    expect(claims).toHaveLength(1);
    expect(claims[0].text).toBe("A test claim.");

    const storedSettings = await db.appSettings.get("settings");
    expect(storedSettings?.apiKey).toBe("test-key");
  });
});

describe("clearAllData", () => {
  it("removes all records from all tables", async () => {
    await db.documents.put({
      id: createId<DocumentId>("doc"),
      name: "to-delete.txt",
      hash: "hash",
      size: 10,
      type: "text",
      status: "complete",
      progress: 100,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await db.topics.put({
      id: createId<TopicId>("topic"),
      label: "Topic",
      normalizedLabel: "topic",
      claimCount: 1,
      documentCount: 1,
    });

    await clearAllData();

    expect(await db.documents.count()).toBe(0);
    expect(await db.textChunks.count()).toBe(0);
    expect(await db.claims.count()).toBe(0);
    expect(await db.topics.count()).toBe(0);
    expect(await db.topicRelationships.count()).toBe(0);
    expect(await db.contradictions.count()).toBe(0);
    expect(await db.knowledgeGaps.count()).toBe(0);
    expect(await db.researchQuestions.count()).toBe(0);
    expect(await db.appSettings.count()).toBe(0);
  });
});
