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

// ---------------------------------------------------------------------------
// Helpers — mirror the logic from use-ingestion-pipeline.ts but operate on
// the local `db` instance so we can unit-test without the React hook.
// ---------------------------------------------------------------------------

async function createDocument(
  testDb: KnowledgeGapDB,
  overrides: Partial<Document> = {},
): Promise<Document> {
  const doc: Document = {
    id: createId<DocumentId>("doc"),
    name: "test-paper.txt",
    hash: `hash_${crypto.randomUUID()}`,
    size: 1024,
    type: "text",
    status: "complete",
    progress: 100,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
  await testDb.documents.put(doc);
  return doc;
}

/**
 * Mirrors `upsertTopic` from use-ingestion-pipeline.ts.
 * Tracks documentCount using a `seenDocIds` map so the same document
 * does not increment a topic's documentCount more than once.
 */
async function upsertTopic(
  testDb: KnowledgeGapDB,
  rawLabel: string,
  documentId: DocumentId,
  seenDocIds: Map<TopicId, Set<DocumentId>>,
): Promise<TopicId> {
  const normalized = normalizeLabel(rawLabel);

  const existing = await testDb.topics
    .where("normalizedLabel")
    .equals(normalized)
    .first();

  if (existing) {
    const seen = seenDocIds.get(existing.id);
    const isNewDoc = !seen || !seen.has(documentId);

    await testDb.topics.update(existing.id, {
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
  await testDb.topics.put(topic);
  seenDocIds.set(topicId, new Set([documentId]));
  return topicId;
}

/**
 * Mirrors `createTopicRelationships` from use-ingestion-pipeline.ts.
 */
async function createTopicRelationships(
  testDb: KnowledgeGapDB,
  documentId: DocumentId,
): Promise<void> {
  const claims = await testDb.claims
    .where("documentId")
    .equals(documentId)
    .toArray();

  // Count co-occurrences within claims
  const pairWeights = new Map<string, number>();

  for (const claim of claims) {
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

  // Count co-occurrences across different claims in the same document
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

    const existing = await testDb.topicRelationships
      .where("sourceId")
      .equals(sourceId)
      .filter((r) => r.targetId === targetId && r.type === "related")
      .first();

    if (existing) {
      await testDb.topicRelationships.update(existing.id, {
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
      await testDb.topicRelationships.put(rel);
    }
  }
}

/**
 * Helper: create a claim with the given topics and store it.
 * Also upserts topics using the seenDocIds map.
 */
async function createClaimWithTopics(
  testDb: KnowledgeGapDB,
  documentId: DocumentId,
  chunkId: string,
  rawTopics: string[],
  seenDocIds: Map<TopicId, Set<DocumentId>>,
  overrides: Partial<Claim> = {},
): Promise<{ claimId: ClaimId; topicIds: TopicId[] }> {
  const topicIds: TopicId[] = [];
  for (const rawTopic of rawTopics) {
    const topicId = await upsertTopic(testDb, rawTopic, documentId, seenDocIds);
    topicIds.push(topicId);
  }

  const claimId = createId<ClaimId>("claim");
  await testDb.claims.put({
    id: claimId,
    documentId,
    chunkId,
    text: overrides.text ?? `Claim about ${rawTopics.join(" and ")}`,
    type: overrides.type ?? "finding",
    confidence: overrides.confidence ?? 0.9,
    topicIds,
    createdAt: Date.now(),
    ...overrides,
  } as Claim);

  return { claimId, topicIds };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("topic relationships: creation after ingestion", () => {
  it("creates TopicRelationship records for topics co-occurring in the same claim", async () => {
    const doc = await createDocument(db);
    const seenDocIds = new Map<TopicId, Set<DocumentId>>();

    // One claim with two topics: they should form a relationship
    await createClaimWithTopics(
      db,
      doc.id,
      "chunk_1",
      ["neural networks", "image classification"],
      seenDocIds,
    );

    await createTopicRelationships(db, doc.id);

    const relationships = await db.topicRelationships.toArray();
    expect(relationships).toHaveLength(1);
    expect(relationships[0].type).toBe("related");
    expect(relationships[0].weight).toBe(1);

    // Verify the sourceId and targetId point to actual topics
    const source = await db.topics.get(relationships[0].sourceId);
    const target = await db.topics.get(relationships[0].targetId);
    expect(source).toBeDefined();
    expect(target).toBeDefined();

    // The two topics should be "neural networks" and "image classification"
    const labels = new Set([source?.normalizedLabel, target?.normalizedLabel]);
    expect(labels).toContain(normalizeLabel("neural networks"));
    expect(labels).toContain(normalizeLabel("image classification"));
  });

  it("creates relationships for topics co-occurring across different claims in the same document", async () => {
    const doc = await createDocument(db);
    const seenDocIds = new Map<TopicId, Set<DocumentId>>();

    // Claim 1: topic A only
    await createClaimWithTopics(db, doc.id, "chunk_1", ["topic A"], seenDocIds);
    // Claim 2: topic B only
    await createClaimWithTopics(db, doc.id, "chunk_1", ["topic B"], seenDocIds);

    await createTopicRelationships(db, doc.id);

    const relationships = await db.topicRelationships.toArray();
    expect(relationships).toHaveLength(1);
    expect(relationships[0].type).toBe("related");
    // Cross-claim co-occurrence contributes weight 1
    expect(relationships[0].weight).toBe(1);
  });

  it("assigns correct sourceId and targetId using canonical ordering", async () => {
    const doc = await createDocument(db);
    const seenDocIds = new Map<TopicId, Set<DocumentId>>();

    await createClaimWithTopics(
      db,
      doc.id,
      "chunk_1",
      ["zebra topic", "alpha topic"],
      seenDocIds,
    );

    await createTopicRelationships(db, doc.id);

    const relationships = await db.topicRelationships.toArray();
    expect(relationships).toHaveLength(1);

    // sourceId should be the lexicographically smaller ID
    expect(relationships[0].sourceId < relationships[0].targetId).toBe(true);
  });

  it("accumulates weight when topics co-occur in multiple claims within the same document", async () => {
    const doc = await createDocument(db);
    const seenDocIds = new Map<TopicId, Set<DocumentId>>();

    // Two claims that share the same pair of topics
    await createClaimWithTopics(
      db,
      doc.id,
      "chunk_1",
      ["neural networks", "deep learning"],
      seenDocIds,
    );
    await createClaimWithTopics(
      db,
      doc.id,
      "chunk_2",
      ["neural networks", "deep learning"],
      seenDocIds,
    );

    await createTopicRelationships(db, doc.id);

    const relationships = await db.topicRelationships.toArray();
    expect(relationships).toHaveLength(1);

    // Within-claim: 1 per claim = 2
    // Cross-claim: each topic in claim 1 paired with each in claim 2
    //   (nn, dl) from c1 x (nn, dl) from c2: nn<->dl (tA===tB skipped for same),
    //   so nn(c1)<->dl(c2)=1 and dl(c1)<->nn(c2)=1, same canonical pair = 2
    // Total = 2 + 2 = 4
    expect(relationships[0].weight).toBe(4);
  });

  it("creates no relationships when a document has claims with single topics only and no overlap", async () => {
    const doc = await createDocument(db);
    const seenDocIds = new Map<TopicId, Set<DocumentId>>();

    // Single topic per claim, different topics
    await createClaimWithTopics(db, doc.id, "chunk_1", ["topic A"], seenDocIds);
    await createClaimWithTopics(db, doc.id, "chunk_2", ["topic B"], seenDocIds);

    await createTopicRelationships(db, doc.id);

    const relationships = await db.topicRelationships.toArray();
    // Even single-topic claims get cross-claim pairing: A <-> B
    expect(relationships).toHaveLength(1);
    expect(relationships[0].weight).toBe(1);
  });

  it("creates no relationships for a document with zero claims", async () => {
    const doc = await createDocument(db);

    await createTopicRelationships(db, doc.id);

    const relationships = await db.topicRelationships.toArray();
    expect(relationships).toHaveLength(0);
  });

  it("creates no relationships for claims with only one topic each and no cross-claim overlap", async () => {
    const doc = await createDocument(db);
    const seenDocIds = new Map<TopicId, Set<DocumentId>>();

    // A single claim with a single topic: no pairs possible
    await createClaimWithTopics(
      db,
      doc.id,
      "chunk_1",
      ["solo topic"],
      seenDocIds,
    );

    await createTopicRelationships(db, doc.id);

    const relationships = await db.topicRelationships.toArray();
    expect(relationships).toHaveLength(0);
  });

  it("creates relationships for three topics in a single claim (all pairs)", async () => {
    const doc = await createDocument(db);
    const seenDocIds = new Map<TopicId, Set<DocumentId>>();

    await createClaimWithTopics(
      db,
      doc.id,
      "chunk_1",
      ["topic A", "topic B", "topic C"],
      seenDocIds,
    );

    await createTopicRelationships(db, doc.id);

    const relationships = await db.topicRelationships.toArray();
    // 3 topics produce C(3,2) = 3 pairs: A-B, A-C, B-C
    expect(relationships).toHaveLength(3);
    for (const rel of relationships) {
      expect(rel.type).toBe("related");
      expect(rel.weight).toBe(1);
    }
  });
});

describe("topic relationships: weight incrementing on re-ingestion", () => {
  it("increments relationship weight when a second document has overlapping topic pairs", async () => {
    const seenDocIds1 = new Map<TopicId, Set<DocumentId>>();
    const seenDocIds2 = new Map<TopicId, Set<DocumentId>>();

    // Document 1
    const doc1 = await createDocument(db);
    await createClaimWithTopics(
      db,
      doc1.id,
      "chunk_1",
      ["neural networks", "deep learning"],
      seenDocIds1,
    );
    await createTopicRelationships(db, doc1.id);

    // Verify initial weight
    let relationships = await db.topicRelationships.toArray();
    expect(relationships).toHaveLength(1);
    expect(relationships[0].weight).toBe(1);

    // Document 2 with the same topic pair
    const doc2 = await createDocument(db);
    await createClaimWithTopics(
      db,
      doc2.id,
      "chunk_1",
      ["neural networks", "deep learning"],
      seenDocIds2,
    );
    await createTopicRelationships(db, doc2.id);

    // Weight should be incremented
    relationships = await db.topicRelationships.toArray();
    expect(relationships).toHaveLength(1);
    expect(relationships[0].weight).toBe(2);
  });

  it("creates new relationships for new topic pairs from a second document", async () => {
    const seenDocIds1 = new Map<TopicId, Set<DocumentId>>();
    const seenDocIds2 = new Map<TopicId, Set<DocumentId>>();

    // Document 1: A-B
    const doc1 = await createDocument(db);
    await createClaimWithTopics(
      db,
      doc1.id,
      "chunk_1",
      ["topic A", "topic B"],
      seenDocIds1,
    );
    await createTopicRelationships(db, doc1.id);

    // Document 2: A-C (shares topic A but adds topic C)
    const doc2 = await createDocument(db);
    await createClaimWithTopics(
      db,
      doc2.id,
      "chunk_1",
      ["topic A", "topic C"],
      seenDocIds2,
    );
    await createTopicRelationships(db, doc2.id);

    const relationships = await db.topicRelationships.toArray();
    // A-B from doc1, A-C from doc2 = 2 relationships
    expect(relationships).toHaveLength(2);

    // Each with weight 1
    for (const rel of relationships) {
      expect(rel.weight).toBe(1);
    }
  });

  it("increments weight for overlapping pairs while creating new ones", async () => {
    const seenDocIds1 = new Map<TopicId, Set<DocumentId>>();
    const seenDocIds2 = new Map<TopicId, Set<DocumentId>>();

    // Document 1: A-B
    const doc1 = await createDocument(db);
    await createClaimWithTopics(
      db,
      doc1.id,
      "chunk_1",
      ["topic A", "topic B"],
      seenDocIds1,
    );
    await createTopicRelationships(db, doc1.id);

    // Document 2: A-B and B-C (one overlapping pair, one new)
    const doc2 = await createDocument(db);
    await createClaimWithTopics(
      db,
      doc2.id,
      "chunk_1",
      ["topic A", "topic B", "topic C"],
      seenDocIds2,
    );
    await createTopicRelationships(db, doc2.id);

    const relationships = await db.topicRelationships.toArray();
    // A-B (weight 2), A-C (weight 1), B-C (weight 1)
    expect(relationships).toHaveLength(3);

    // Find the A-B relationship by checking for the topics
    const topicA = await db.topics
      .where("normalizedLabel")
      .equals(normalizeLabel("topic A"))
      .first();
    const topicB = await db.topics
      .where("normalizedLabel")
      .equals(normalizeLabel("topic B"))
      .first();
    expect(topicA).toBeDefined();
    expect(topicB).toBeDefined();

    // biome-ignore lint/style/noNonNullAssertion: guarded by expect above
    const aId = topicA!.id;
    // biome-ignore lint/style/noNonNullAssertion: guarded by expect above
    const bId = topicB!.id;
    const [sourceId, targetId] = aId < bId ? [aId, bId] : [bId, aId];

    const abRel = relationships.find(
      (r) => r.sourceId === sourceId && r.targetId === targetId,
    );
    expect(abRel).toBeDefined();
    expect(abRel?.weight).toBe(2);
  });
});

describe("topic documentCount tracking", () => {
  it("sets documentCount to 1 when a topic is created for the first time", async () => {
    const doc = await createDocument(db);
    const seenDocIds = new Map<TopicId, Set<DocumentId>>();

    await upsertTopic(db, "neural networks", doc.id, seenDocIds);

    const topic = await db.topics
      .where("normalizedLabel")
      .equals(normalizeLabel("neural networks"))
      .first();
    expect(topic).toBeDefined();
    expect(topic?.documentCount).toBe(1);
    expect(topic?.claimCount).toBe(1);
  });

  it("increments documentCount when a topic appears in a different document", async () => {
    const doc1 = await createDocument(db);
    const doc2 = await createDocument(db);
    const seenDocIds = new Map<TopicId, Set<DocumentId>>();

    // Topic appears in document 1
    await upsertTopic(db, "neural networks", doc1.id, seenDocIds);

    // Same topic appears in document 2
    await upsertTopic(db, "neural networks", doc2.id, seenDocIds);

    const topic = await db.topics
      .where("normalizedLabel")
      .equals(normalizeLabel("neural networks"))
      .first();
    expect(topic?.documentCount).toBe(2);
    expect(topic?.claimCount).toBe(2);
  });

  it("does NOT increment documentCount when the same topic appears multiple times in the SAME document", async () => {
    const doc = await createDocument(db);
    const seenDocIds = new Map<TopicId, Set<DocumentId>>();

    // Topic appears in first claim of the document
    await upsertTopic(db, "neural networks", doc.id, seenDocIds);
    // Topic appears in second claim of the same document
    await upsertTopic(db, "neural networks", doc.id, seenDocIds);
    // Topic appears in third claim of the same document
    await upsertTopic(db, "neural networks", doc.id, seenDocIds);

    const topic = await db.topics
      .where("normalizedLabel")
      .equals(normalizeLabel("neural networks"))
      .first();
    // documentCount should remain 1, even though claimCount is 3
    expect(topic?.documentCount).toBe(1);
    expect(topic?.claimCount).toBe(3);
  });

  it("correctly tracks documentCount across three documents", async () => {
    const doc1 = await createDocument(db);
    const doc2 = await createDocument(db);
    const doc3 = await createDocument(db);
    const seenDocIds = new Map<TopicId, Set<DocumentId>>();

    // Document 1: two mentions
    await upsertTopic(db, "machine learning", doc1.id, seenDocIds);
    await upsertTopic(db, "machine learning", doc1.id, seenDocIds);

    // Document 2: one mention
    await upsertTopic(db, "machine learning", doc2.id, seenDocIds);

    // Document 3: three mentions
    await upsertTopic(db, "machine learning", doc3.id, seenDocIds);
    await upsertTopic(db, "machine learning", doc3.id, seenDocIds);
    await upsertTopic(db, "machine learning", doc3.id, seenDocIds);

    const topic = await db.topics
      .where("normalizedLabel")
      .equals(normalizeLabel("machine learning"))
      .first();
    expect(topic?.documentCount).toBe(3);
    // 2 + 1 + 3 = 6 total claims
    expect(topic?.claimCount).toBe(6);
  });

  it("independently tracks documentCount for different topics", async () => {
    const doc1 = await createDocument(db);
    const doc2 = await createDocument(db);
    const seenDocIds = new Map<TopicId, Set<DocumentId>>();

    // Doc 1: both topics
    await upsertTopic(db, "neural networks", doc1.id, seenDocIds);
    await upsertTopic(db, "image classification", doc1.id, seenDocIds);

    // Doc 2: only "neural networks"
    await upsertTopic(db, "neural networks", doc2.id, seenDocIds);

    const nn = await db.topics
      .where("normalizedLabel")
      .equals(normalizeLabel("neural networks"))
      .first();
    const ic = await db.topics
      .where("normalizedLabel")
      .equals(normalizeLabel("image classification"))
      .first();

    expect(nn?.documentCount).toBe(2);
    expect(nn?.claimCount).toBe(2);
    expect(ic?.documentCount).toBe(1);
    expect(ic?.claimCount).toBe(1);
  });

  it("handles separate seenDocIds maps for separate ingestion runs", async () => {
    const doc1 = await createDocument(db);
    const doc2 = await createDocument(db);

    // Separate seenDocIds maps simulate separate ingestSingleFile calls
    const seenDocIds1 = new Map<TopicId, Set<DocumentId>>();
    const seenDocIds2 = new Map<TopicId, Set<DocumentId>>();

    // Doc 1 run: topic appears twice
    await upsertTopic(db, "transformers", doc1.id, seenDocIds1);
    await upsertTopic(db, "transformers", doc1.id, seenDocIds1);

    // Doc 2 run: topic appears once
    await upsertTopic(db, "transformers", doc2.id, seenDocIds2);

    const topic = await db.topics
      .where("normalizedLabel")
      .equals(normalizeLabel("transformers"))
      .first();

    // documentCount = 2 (one per document)
    expect(topic?.documentCount).toBe(2);
    // claimCount = 3 (2 from doc1 + 1 from doc2)
    expect(topic?.claimCount).toBe(3);
  });
});

describe("end-to-end: ingestion with topic relationships and documentCount", () => {
  it("full pipeline simulation creates topics, claims, and relationships", async () => {
    const doc = await createDocument(db);
    const seenDocIds = new Map<TopicId, Set<DocumentId>>();

    // Simulate AI extracting two claims with overlapping topics
    const extracted = [
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

    for (const claim of extracted) {
      await createClaimWithTopics(
        db,
        doc.id,
        "chunk_1",
        claim.topics,
        seenDocIds,
        {
          text: claim.text,
          type: claim.type,
          confidence: claim.confidence,
        },
      );
    }

    // Build topic relationships
    await createTopicRelationships(db, doc.id);

    // Verify topics
    const topics = await db.topics.toArray();
    expect(topics).toHaveLength(3); // neural networks, image classification, dataset

    // image classification appears in both claims
    const ic = topics.find(
      (t) => t.normalizedLabel === normalizeLabel("image classification"),
    );
    expect(ic?.claimCount).toBe(2);
    expect(ic?.documentCount).toBe(1); // same document

    // Verify relationships — 3 unique topics yield up to 3 pairs,
    // plus cross-claim pairing
    const relationships = await db.topicRelationships.toArray();
    expect(relationships.length).toBeGreaterThanOrEqual(1);

    // All relationships should be of type "related"
    for (const rel of relationships) {
      expect(rel.type).toBe("related");
      expect(rel.weight).toBeGreaterThanOrEqual(1);
    }

    // Verify the "image classification" <-> "neural networks" pair exists
    // (they co-occur in claim 1)
    const nnId = topics.find(
      (t) => t.normalizedLabel === normalizeLabel("neural networks"),
    )?.id;
    const icId = ic?.id;
    expect(nnId).toBeDefined();
    expect(icId).toBeDefined();

    const nnIcRel = relationships.find(
      (r) =>
        (r.sourceId === nnId && r.targetId === icId) ||
        (r.sourceId === icId && r.targetId === nnId),
    );
    expect(nnIcRel).toBeDefined();
  });

  it("second document ingestion increments relationship weights and documentCounts", async () => {
    // --- Document 1 ---
    const doc1 = await createDocument(db);
    const seenDocIds1 = new Map<TopicId, Set<DocumentId>>();

    await createClaimWithTopics(
      db,
      doc1.id,
      "chunk_1",
      ["neural networks", "deep learning"],
      seenDocIds1,
    );
    await createTopicRelationships(db, doc1.id);

    // Check initial state
    let nnTopic = await db.topics
      .where("normalizedLabel")
      .equals(normalizeLabel("neural networks"))
      .first();
    expect(nnTopic?.documentCount).toBe(1);
    expect(nnTopic?.claimCount).toBe(1);

    let rels = await db.topicRelationships.toArray();
    expect(rels).toHaveLength(1);
    expect(rels[0].weight).toBe(1);

    // --- Document 2 (same topics) ---
    const doc2 = await createDocument(db);
    const seenDocIds2 = new Map<TopicId, Set<DocumentId>>();

    await createClaimWithTopics(
      db,
      doc2.id,
      "chunk_1",
      ["neural networks", "deep learning"],
      seenDocIds2,
    );
    await createTopicRelationships(db, doc2.id);

    // documentCount should now be 2 for both topics
    nnTopic = await db.topics
      .where("normalizedLabel")
      .equals(normalizeLabel("neural networks"))
      .first();
    expect(nnTopic?.documentCount).toBe(2);
    expect(nnTopic?.claimCount).toBe(2);

    const dlTopic = await db.topics
      .where("normalizedLabel")
      .equals(normalizeLabel("deep learning"))
      .first();
    expect(dlTopic?.documentCount).toBe(2);
    expect(dlTopic?.claimCount).toBe(2);

    // Relationship weight should be 2
    rels = await db.topicRelationships.toArray();
    expect(rels).toHaveLength(1);
    expect(rels[0].weight).toBe(2);
  });
});
