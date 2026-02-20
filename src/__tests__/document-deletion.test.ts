import { deleteDocument } from "@/hooks/use-documents";
import { normalizeLabel } from "@/lib/utils/text";
import type {
  Claim,
  ClaimId,
  Document,
  DocumentId,
  Topic,
  TopicId,
  TopicRelationship,
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
 * Helper: create and store a document.
 */
async function seedDocument(
  testDb: KnowledgeGapDB,
  name = "test-paper.txt",
): Promise<Document> {
  const doc: Document = {
    id: createId<DocumentId>("doc"),
    name,
    hash: `hash_${crypto.randomUUID()}`,
    size: 1024,
    type: "text",
    status: "complete",
    progress: 100,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await testDb.documents.put(doc);
  return doc;
}

/**
 * Helper: create and store a topic.
 */
async function seedTopic(
  testDb: KnowledgeGapDB,
  label: string,
  claimCount: number,
  documentCount = 1,
): Promise<Topic> {
  const topic: Topic = {
    id: createId<TopicId>("topic"),
    label,
    normalizedLabel: normalizeLabel(label),
    claimCount,
    documentCount,
  };
  await testDb.topics.put(topic);
  return topic;
}

/**
 * Helper: create and store a claim referencing a document and topics.
 */
async function seedClaim(
  testDb: KnowledgeGapDB,
  documentId: DocumentId,
  text: string,
  topicIds: TopicId[],
): Promise<Claim> {
  const claim: Claim = {
    id: createId<ClaimId>("claim"),
    documentId,
    chunkId: createId("chunk"),
    text,
    type: "finding",
    confidence: 0.9,
    topicIds,
    createdAt: Date.now(),
  };
  await testDb.claims.put(claim);
  return claim;
}

/**
 * Helper: create and store a topic relationship.
 */
async function seedRelationship(
  testDb: KnowledgeGapDB,
  sourceId: TopicId,
  targetId: TopicId,
  weight = 1.0,
): Promise<TopicRelationship> {
  const rel: TopicRelationship = {
    id: `rel_${crypto.randomUUID()}`,
    sourceId,
    targetId,
    type: "related",
    weight,
  };
  await testDb.topicRelationships.put(rel);
  return rel;
}

/**
 * Helper: create and store a text chunk.
 */
async function seedChunk(
  testDb: KnowledgeGapDB,
  documentId: DocumentId,
): Promise<void> {
  await testDb.textChunks.put({
    id: createId("chunk"),
    documentId,
    content: "Some chunk content.",
    startOffset: 0,
    endOffset: 100,
    chunkIndex: 0,
  });
}

describe("document deletion: basic cleanup", () => {
  it("deletes the document, its chunks, and its claims", async () => {
    const doc = await seedDocument(db);
    const topic = await seedTopic(db, "Neural Networks", 1);
    await seedChunk(db, doc.id);
    await seedClaim(db, doc.id, "Neural networks are effective.", [topic.id]);

    await deleteDocument(doc.id);

    const docs = await db.documents.toArray();
    expect(docs).toHaveLength(0);

    const chunks = await db.textChunks.toArray();
    expect(chunks).toHaveLength(0);

    const claims = await db.claims.toArray();
    expect(claims).toHaveLength(0);
  });
});

describe("document deletion: topic count decrement", () => {
  it("decrements claimCount on topics referenced by deleted claims", async () => {
    const doc1 = await seedDocument(db, "paper-1.txt");
    const doc2 = await seedDocument(db, "paper-2.txt");
    // Topic shared by both documents' claims (3 total claims reference it)
    const topic = await seedTopic(db, "Machine Learning", 3, 2);

    // doc1 has 1 claim referencing the topic
    await seedClaim(db, doc1.id, "ML is effective.", [topic.id]);
    // doc2 has 2 claims referencing the topic
    await seedClaim(db, doc2.id, "ML scales well.", [topic.id]);
    await seedClaim(db, doc2.id, "ML needs data.", [topic.id]);

    // Delete doc1 — should decrement claimCount by 1, documentCount by 1
    await deleteDocument(doc1.id);

    const updatedTopic = await db.topics.get(topic.id);
    expect(updatedTopic).toBeDefined();
    expect(updatedTopic?.claimCount).toBe(2);
    expect(updatedTopic?.documentCount).toBe(1);
  });

  it("decrements correctly when a claim references multiple topics", async () => {
    const doc = await seedDocument(db);
    const topicA = await seedTopic(db, "Deep Learning", 2, 1);
    const topicB = await seedTopic(db, "Computer Vision", 1, 1);

    // This claim references both topics
    await seedClaim(db, doc.id, "DL improves CV results.", [
      topicA.id,
      topicB.id,
    ]);
    // Another claim in a different doc also references topicA
    const otherDoc = await seedDocument(db, "other.txt");
    await seedClaim(db, otherDoc.id, "DL is powerful.", [topicA.id]);

    await deleteDocument(doc.id);

    // topicA: was 2, lost 1 claim => 1 remaining
    const updatedA = await db.topics.get(topicA.id);
    expect(updatedA).toBeDefined();
    expect(updatedA?.claimCount).toBe(1);

    // topicB: was 1, lost 1 claim => 0, should be orphaned and deleted
    const updatedB = await db.topics.get(topicB.id);
    expect(updatedB).toBeUndefined();
  });
});

describe("document deletion: orphan topic cleanup", () => {
  it("deletes topics whose claimCount drops to zero", async () => {
    const doc = await seedDocument(db);
    const orphanTopic = await seedTopic(db, "Ephemeral Topic", 1, 1);

    await seedClaim(db, doc.id, "Something about ephemeral topic.", [
      orphanTopic.id,
    ]);

    await deleteDocument(doc.id);

    const topics = await db.topics.toArray();
    expect(topics).toHaveLength(0);
  });

  it("does not delete topics that still have remaining claims", async () => {
    const doc1 = await seedDocument(db, "paper-a.txt");
    const doc2 = await seedDocument(db, "paper-b.txt");
    const sharedTopic = await seedTopic(db, "Shared Topic", 2, 2);

    await seedClaim(db, doc1.id, "Claim from doc1.", [sharedTopic.id]);
    await seedClaim(db, doc2.id, "Claim from doc2.", [sharedTopic.id]);

    // Delete only doc1
    await deleteDocument(doc1.id);

    const topics = await db.topics.toArray();
    expect(topics).toHaveLength(1);
    expect(topics[0].claimCount).toBe(1);
  });

  it("handles multiple topics becoming orphaned simultaneously", async () => {
    const doc = await seedDocument(db);
    const topicA = await seedTopic(db, "Topic A", 1, 1);
    const topicB = await seedTopic(db, "Topic B", 1, 1);
    const topicC = await seedTopic(db, "Topic C", 1, 1);

    await seedClaim(db, doc.id, "Claim referencing A and B.", [
      topicA.id,
      topicB.id,
    ]);
    await seedClaim(db, doc.id, "Claim referencing C.", [topicC.id]);

    await deleteDocument(doc.id);

    const topics = await db.topics.toArray();
    expect(topics).toHaveLength(0);
  });
});

describe("document deletion: topic relationship cleanup", () => {
  it("deletes relationships that reference orphaned topics", async () => {
    const doc = await seedDocument(db);
    const topicA = await seedTopic(db, "Orphan A", 1, 1);
    const topicB = await seedTopic(db, "Orphan B", 1, 1);

    await seedClaim(db, doc.id, "Claim with both topics.", [
      topicA.id,
      topicB.id,
    ]);
    await seedRelationship(db, topicA.id, topicB.id);

    await deleteDocument(doc.id);

    const relationships = await db.topicRelationships.toArray();
    expect(relationships).toHaveLength(0);
  });

  it("deletes only relationships referencing orphaned topics, keeps others", async () => {
    const doc = await seedDocument(db, "deletable.txt");
    const otherDoc = await seedDocument(db, "keeper.txt");

    const topicOrphan = await seedTopic(db, "Orphan Topic", 1, 1);
    const topicSurvivor = await seedTopic(db, "Survivor Topic", 2, 2);
    const topicOther = await seedTopic(db, "Other Topic", 1, 1);

    // Claim from deletable doc references orphan and survivor
    await seedClaim(db, doc.id, "Claim about orphan and survivor.", [
      topicOrphan.id,
      topicSurvivor.id,
    ]);
    // Claim from keeper doc also references survivor
    await seedClaim(db, otherDoc.id, "Claim about survivor.", [
      topicSurvivor.id,
    ]);

    // Relationships: orphan<->survivor, survivor<->other
    const relOrphanSurvivor = await seedRelationship(
      db,
      topicOrphan.id,
      topicSurvivor.id,
    );
    const relSurvivorOther = await seedRelationship(
      db,
      topicSurvivor.id,
      topicOther.id,
    );

    await deleteDocument(doc.id);

    const relationships = await db.topicRelationships.toArray();
    // relOrphanSurvivor should be deleted (topicOrphan is orphaned)
    // relSurvivorOther should remain
    expect(relationships).toHaveLength(1);
    expect(relationships[0].id).toBe(relSurvivorOther.id);
  });

  it("handles deletion when orphan topic is only on source side of relationship", async () => {
    const doc = await seedDocument(db);
    const orphan = await seedTopic(db, "Source Orphan", 1, 1);
    const survivor = await seedTopic(db, "Target Survivor", 5, 3);

    await seedClaim(db, doc.id, "Claim about orphan.", [orphan.id]);
    await seedRelationship(db, orphan.id, survivor.id);

    await deleteDocument(doc.id);

    const relationships = await db.topicRelationships.toArray();
    expect(relationships).toHaveLength(0);
  });

  it("handles deletion when orphan topic is only on target side of relationship", async () => {
    const doc = await seedDocument(db);
    const orphan = await seedTopic(db, "Target Orphan", 1, 1);
    const survivor = await seedTopic(db, "Source Survivor", 5, 3);

    await seedClaim(db, doc.id, "Claim about orphan.", [orphan.id]);
    await seedRelationship(db, survivor.id, orphan.id);

    await deleteDocument(doc.id);

    const relationships = await db.topicRelationships.toArray();
    expect(relationships).toHaveLength(0);
  });
});

describe("document deletion: no claims scenario", () => {
  it("handles document with no claims gracefully", async () => {
    const doc = await seedDocument(db);
    await seedChunk(db, doc.id);

    // No claims, no topics — just doc and chunks
    await deleteDocument(doc.id);

    const docs = await db.documents.toArray();
    expect(docs).toHaveLength(0);

    const chunks = await db.textChunks.toArray();
    expect(chunks).toHaveLength(0);
  });
});

describe("document deletion: multiple claims referencing same topic", () => {
  it("correctly counts multiple claims from the same document on one topic", async () => {
    const doc = await seedDocument(db);
    const otherDoc = await seedDocument(db, "other.txt");
    // Topic starts with 4 claims total across documents
    const topic = await seedTopic(db, "Genomics", 4, 2);

    // 2 claims from doc reference the same topic
    await seedClaim(db, doc.id, "Genomics claim 1.", [topic.id]);
    await seedClaim(db, doc.id, "Genomics claim 2.", [topic.id]);
    // 2 claims from otherDoc reference the same topic
    await seedClaim(db, otherDoc.id, "Genomics claim 3.", [topic.id]);
    await seedClaim(db, otherDoc.id, "Genomics claim 4.", [topic.id]);

    await deleteDocument(doc.id);

    const updatedTopic = await db.topics.get(topic.id);
    expect(updatedTopic).toBeDefined();
    // 4 - 2 = 2
    expect(updatedTopic?.claimCount).toBe(2);
    expect(updatedTopic?.documentCount).toBe(1);
  });
});

describe("document deletion: preserves unrelated data", () => {
  it("does not affect documents, claims, or topics from other documents", async () => {
    const docToDelete = await seedDocument(db, "delete-me.txt");
    const docToKeep = await seedDocument(db, "keep-me.txt");

    const topicShared = await seedTopic(db, "Shared Topic", 2, 2);
    const topicOnlyDelete = await seedTopic(db, "Only Delete Topic", 1, 1);
    const topicOnlyKeep = await seedTopic(db, "Only Keep Topic", 1, 1);

    await seedChunk(db, docToDelete.id);
    await seedChunk(db, docToKeep.id);

    await seedClaim(db, docToDelete.id, "Delete claim on shared.", [
      topicShared.id,
    ]);
    await seedClaim(db, docToDelete.id, "Delete claim on unique.", [
      topicOnlyDelete.id,
    ]);
    await seedClaim(db, docToKeep.id, "Keep claim on shared.", [
      topicShared.id,
    ]);
    await seedClaim(db, docToKeep.id, "Keep claim on unique.", [
      topicOnlyKeep.id,
    ]);

    await deleteDocument(docToDelete.id);

    // docToKeep and its data should be intact
    const docs = await db.documents.toArray();
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe(docToKeep.id);

    const claims = await db.claims.toArray();
    expect(claims).toHaveLength(2);
    expect(claims.every((c) => c.documentId === docToKeep.id)).toBe(true);

    const chunks = await db.textChunks.toArray();
    expect(chunks).toHaveLength(1);

    // topicOnlyDelete should be gone (orphaned), topicShared and topicOnlyKeep remain
    const topics = await db.topics.toArray();
    expect(topics).toHaveLength(2);
    const topicLabels = topics.map((t) => t.label);
    expect(topicLabels).toContain("Shared Topic");
    expect(topicLabels).toContain("Only Keep Topic");
    expect(topicLabels).not.toContain("Only Delete Topic");

    // Shared topic should have decremented counts
    const shared = topics.find((t) => t.label === "Shared Topic");
    expect(shared?.claimCount).toBe(1);
    expect(shared?.documentCount).toBe(1);
  });
});
