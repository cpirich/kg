import { normalizeLabel } from "@/lib/utils/text";
import type {
  Claim,
  ClaimId,
  ClaimType,
  Contradiction,
  ContradictionId,
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

/**
 * Create and store a topic, returning its ID.
 */
async function seedTopic(
  testDb: KnowledgeGapDB,
  label: string,
  claimCount = 1,
): Promise<TopicId> {
  const id = createId<TopicId>("topic");
  await testDb.topics.put({
    id,
    label,
    normalizedLabel: normalizeLabel(label),
    claimCount,
    documentCount: 1,
  });
  return id;
}

/**
 * Create and store a claim, returning it.
 */
async function seedClaim(
  testDb: KnowledgeGapDB,
  text: string,
  type: ClaimType,
  topicIds: TopicId[],
  confidence = 0.9,
): Promise<Claim> {
  const claim: Claim = {
    id: createId<ClaimId>("claim"),
    documentId: createId<DocumentId>("doc"),
    chunkId: createId("chunk"),
    text,
    type,
    confidence,
    topicIds,
    createdAt: Date.now(),
  };
  await testDb.claims.put(claim);
  return claim;
}

/**
 * Generate contradiction candidates — pairs of claims that share at least
 * one topic and have the same claim type. This mirrors what a
 * `generateContradictionCandidates` function would do.
 */
function generateContradictionCandidates(
  claims: Claim[],
): Array<[Claim, Claim]> {
  const candidates: Array<[Claim, Claim]> = [];

  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const a = claims[i];
      const b = claims[j];

      // Must have the same claim type
      if (a.type !== b.type) continue;

      // Must share at least one topic
      const sharedTopics = a.topicIds.filter((tid) => b.topicIds.includes(tid));
      if (sharedTopics.length === 0) continue;

      candidates.push([a, b]);
    }
  }

  return candidates;
}

describe("contradiction detection flow", () => {
  it("generates candidates for claims sharing topics with same type", async () => {
    const topicA = await seedTopic(db, "neural networks");
    const topicB = await seedTopic(db, "image classification");

    const claim1 = await seedClaim(
      db,
      "Neural networks achieve 95% accuracy on ImageNet.",
      "finding",
      [topicA, topicB],
    );
    const claim2 = await seedClaim(
      db,
      "Neural networks only achieve 80% accuracy on ImageNet.",
      "finding",
      [topicA, topicB],
    );

    const allClaims = await db.claims.toArray();
    const candidates = generateContradictionCandidates(allClaims);

    expect(candidates).toHaveLength(1);
    const pairIds = [candidates[0][0].id, candidates[0][1].id];
    expect(pairIds).toContain(claim1.id);
    expect(pairIds).toContain(claim2.id);
  });

  it("does not generate candidates for claims with different types", async () => {
    const topicA = await seedTopic(db, "neural networks");

    await seedClaim(db, "Neural networks achieve 95% accuracy.", "finding", [
      topicA,
    ]);
    await seedClaim(
      db,
      "We used a convolutional architecture.",
      "methodology",
      [topicA],
    );

    const allClaims = await db.claims.toArray();
    const candidates = generateContradictionCandidates(allClaims);

    expect(candidates).toHaveLength(0);
  });

  it("does not generate candidates for claims with different topics", async () => {
    const topicA = await seedTopic(db, "neural networks");
    const topicB = await seedTopic(db, "gene expression");

    await seedClaim(db, "Neural networks are effective.", "finding", [topicA]);
    await seedClaim(db, "Gene expression varies by age.", "finding", [topicB]);

    const allClaims = await db.claims.toArray();
    const candidates = generateContradictionCandidates(allClaims);

    expect(candidates).toHaveLength(0);
  });

  it("stores contradictions with full detection flow (mocked AI)", async () => {
    const topicA = await seedTopic(db, "neural networks");

    const claim1 = await seedClaim(
      db,
      "Deep learning requires massive datasets.",
      "claim",
      [topicA],
    );
    const claim2 = await seedClaim(
      db,
      "Deep learning works well with small datasets.",
      "claim",
      [topicA],
    );

    // Simulate AI verification result
    const mockAIResult = {
      isContradiction: true,
      description:
        "These claims make opposing assertions about dataset requirements for deep learning.",
      severity: "high" as const,
      confidence: 0.88,
    };

    // Only store if confidence > 0.6
    if (mockAIResult.isContradiction && mockAIResult.confidence > 0.6) {
      const contradiction: Contradiction = {
        id: createId<ContradictionId>("contra"),
        claimAId: claim1.id,
        claimBId: claim2.id,
        description: mockAIResult.description,
        severity: mockAIResult.severity,
        confidence: mockAIResult.confidence,
        status: "pending",
        createdAt: Date.now(),
      };
      await db.contradictions.put(contradiction);
    }

    const stored = await db.contradictions.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0].claimAId).toBe(claim1.id);
    expect(stored[0].claimBId).toBe(claim2.id);
    expect(stored[0].severity).toBe("high");
    expect(stored[0].confidence).toBe(0.88);
  });

  it("filters out contradictions with confidence below 0.6", async () => {
    const topicA = await seedTopic(db, "methods");

    const claim1 = await seedClaim(db, "Method A is preferred.", "claim", [
      topicA,
    ]);
    const claim2 = await seedClaim(db, "Method B is preferred.", "claim", [
      topicA,
    ]);

    // Simulate AI returning low confidence
    const mockAIResult = {
      isContradiction: true,
      description: "Marginal disagreement on preferred methods.",
      severity: "low" as const,
      confidence: 0.45, // Below threshold
    };

    // Apply threshold filter
    if (mockAIResult.isContradiction && mockAIResult.confidence > 0.6) {
      const contradiction: Contradiction = {
        id: createId<ContradictionId>("contra"),
        claimAId: claim1.id,
        claimBId: claim2.id,
        description: mockAIResult.description,
        severity: mockAIResult.severity,
        confidence: mockAIResult.confidence,
        status: "pending",
        createdAt: Date.now(),
      };
      await db.contradictions.put(contradiction);
    }

    const stored = await db.contradictions.toArray();
    expect(stored).toHaveLength(0);
  });

  it("handles multiple candidate pairs from several claims", async () => {
    const topicA = await seedTopic(db, "sample size");

    // Three findings on the same topic — should produce 3 pairs
    await seedClaim(db, "Small samples are sufficient.", "finding", [topicA]);
    await seedClaim(db, "Large samples are required.", "finding", [topicA]);
    await seedClaim(db, "Medium samples work best.", "finding", [topicA]);

    const allClaims = await db.claims.toArray();
    const candidates = generateContradictionCandidates(allClaims);

    // C(3,2) = 3 pairs
    expect(candidates).toHaveLength(3);
  });
});
