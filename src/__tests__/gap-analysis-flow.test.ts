import { calculateDensity } from "@/lib/graph/density";
import { findSparseRegions } from "@/lib/graph/gap-detection";
import { normalizeLabel } from "@/lib/utils/text";
import type {
  GapId,
  KnowledgeGap,
  QuestionId,
  ResearchQuestion,
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
 * Create a topic and store it in the DB.
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
 * Create a relationship between two topics and store it.
 */
async function seedRelationship(
  testDb: KnowledgeGapDB,
  sourceId: TopicId,
  targetId: TopicId,
  type: TopicRelationship["type"] = "related",
  weight = 1.0,
): Promise<TopicRelationship> {
  const rel: TopicRelationship = {
    id: `rel_${crypto.randomUUID()}`,
    sourceId,
    targetId,
    type,
    weight,
  };
  await testDb.topicRelationships.put(rel);
  return rel;
}

describe("gap analysis: structural gaps", () => {
  it("finds sparse regions when high-degree topics lack mutual edges", async () => {
    // Create topics with varying claim counts
    const topicA = await seedTopic(db, "Neural Networks", 15);
    const topicB = await seedTopic(db, "Image Classification", 12);
    const topicC = await seedTopic(db, "Reinforcement Learning", 2);
    const topicD = await seedTopic(db, "Transfer Learning", 1);

    // Connect A and B heavily, leave C and D isolated
    await seedRelationship(db, topicA.id, topicB.id);
    await seedRelationship(db, topicB.id, topicA.id);

    const allTopics = await db.topics.toArray();
    const allRels = await db.topicRelationships.toArray();
    const densityMap = calculateDensity(allTopics);

    const sparseRegions = findSparseRegions(allTopics, allRels, densityMap);

    // C and D should be sparse: low density + no connections
    expect(sparseRegions.length).toBeGreaterThan(0);
    expect(sparseRegions).toContain(topicD.id);
  });

  it("returns empty array when all topics are well-connected", async () => {
    const topicA = await seedTopic(db, "Topic A", 10);
    const topicB = await seedTopic(db, "Topic B", 10);
    const topicC = await seedTopic(db, "Topic C", 10);

    // Fully connected
    await seedRelationship(db, topicA.id, topicB.id);
    await seedRelationship(db, topicB.id, topicC.id);
    await seedRelationship(db, topicC.id, topicA.id);

    const allTopics = await db.topics.toArray();
    const allRels = await db.topicRelationships.toArray();
    const densityMap = calculateDensity(allTopics);

    const sparseRegions = findSparseRegions(allTopics, allRels, densityMap);

    // All topics have equal density (1.0) and equal connectivity — none sparse
    expect(sparseRegions).toHaveLength(0);
  });
});

describe("gap analysis: density-based gaps", () => {
  it("identifies topics with below-average claim counts via density map", async () => {
    // Create topics with very different claim counts
    const topicA = await seedTopic(db, "Well-studied Topic", 20);
    const topicB = await seedTopic(db, "Moderately Studied", 10);
    const topicC = await seedTopic(db, "Under-studied Topic", 1);

    const allTopics = await db.topics.toArray();
    const densityMap = calculateDensity(allTopics);

    // Topic C should have low density
    expect(densityMap.get(topicC.id)).toBeLessThan(0.1);
    // Topic A should have the highest density
    expect(densityMap.get(topicA.id)).toBe(1.0);
    // Topic B should be in between
    const bDensity = densityMap.get(topicB.id) ?? 0;
    expect(bDensity).toBeGreaterThan(0);
    expect(bDensity).toBeLessThan(1.0);
  });

  it("returns all 1.0 when all topics have equal claim counts", async () => {
    await seedTopic(db, "Topic X", 5);
    await seedTopic(db, "Topic Y", 5);
    await seedTopic(db, "Topic Z", 5);

    const allTopics = await db.topics.toArray();
    const densityMap = calculateDensity(allTopics);

    for (const topic of allTopics) {
      expect(densityMap.get(topic.id)).toBe(1.0);
    }
  });

  it("returns empty map for empty topic list", () => {
    const densityMap = calculateDensity([]);
    expect(densityMap.size).toBe(0);
  });
});

describe("gap analysis: full flow producing KnowledgeGap records", () => {
  it("creates KnowledgeGap records from detected sparse regions", async () => {
    // Seed a graph with obvious gaps
    const topicA = await seedTopic(db, "Machine Learning", 15);
    const topicB = await seedTopic(db, "Deep Learning", 12);
    const topicC = await seedTopic(db, "Bayesian Methods", 1);
    const topicD = await seedTopic(db, "Causal Inference", 1);

    await seedRelationship(db, topicA.id, topicB.id);
    await seedRelationship(db, topicB.id, topicA.id);

    const allTopics = await db.topics.toArray();
    const allRels = await db.topicRelationships.toArray();
    const densityMap = calculateDensity(allTopics);
    const sparseTopicIds = findSparseRegions(allTopics, allRels, densityMap);

    // Create KnowledgeGap records for sparse topics
    for (const topicId of sparseTopicIds) {
      const topic = allTopics.find((t) => t.id === topicId);
      if (!topic) continue;

      const gap: KnowledgeGap = {
        id: createId<GapId>("gap"),
        description: `Topic "${topic.label}" has low research density and limited connections to other topics.`,
        topicIds: [topicId],
        gapType: "density",
        significance: 1 - (densityMap.get(topicId) ?? 0),
        createdAt: Date.now(),
      };
      await db.knowledgeGaps.put(gap);
    }

    const gaps = await db.knowledgeGaps.toArray();
    expect(gaps.length).toBeGreaterThan(0);

    // All gap records should be density type
    for (const gap of gaps) {
      expect(gap.gapType).toBe("density");
      expect(gap.significance).toBeGreaterThan(0);
      expect(gap.topicIds.length).toBeGreaterThan(0);
    }
  });

  it("handles structural gap detection between disconnected clusters", async () => {
    // Two disconnected clusters
    const topicA = await seedTopic(db, "Cluster A Topic 1", 5);
    const topicB = await seedTopic(db, "Cluster A Topic 2", 5);
    const topicC = await seedTopic(db, "Cluster B Topic 1", 5);
    const topicD = await seedTopic(db, "Cluster B Topic 2", 5);

    // Only intra-cluster connections
    await seedRelationship(db, topicA.id, topicB.id);
    await seedRelationship(db, topicC.id, topicD.id);

    const allTopics = await db.topics.toArray();
    const allRels = await db.topicRelationships.toArray();

    // Build adjacency to detect disconnected pairs
    const adjacency = new Map<TopicId, Set<TopicId>>();
    for (const topic of allTopics) {
      adjacency.set(topic.id, new Set());
    }
    for (const rel of allRels) {
      adjacency.get(rel.sourceId)?.add(rel.targetId);
      adjacency.get(rel.targetId)?.add(rel.sourceId);
    }

    // Find pairs of topics that have no path between them
    const structuralGaps: Array<{ from: TopicId; to: TopicId }> = [];
    const topicIds = allTopics.map((t) => t.id);

    for (let i = 0; i < topicIds.length; i++) {
      for (let j = i + 1; j < topicIds.length; j++) {
        const neighbors = adjacency.get(topicIds[i]) ?? new Set<TopicId>();
        if (!neighbors.has(topicIds[j])) {
          // Check if different clusters (not connected at all)
          const visited = new Set<TopicId>();
          const stack = [topicIds[i]];
          while (stack.length > 0) {
            const current = stack.pop() as TopicId;
            if (visited.has(current)) continue;
            visited.add(current);
            for (const neighbor of adjacency.get(current) ?? []) {
              stack.push(neighbor);
            }
          }
          if (!visited.has(topicIds[j])) {
            structuralGaps.push({ from: topicIds[i], to: topicIds[j] });
          }
        }
      }
    }

    // There should be structural gaps between clusters
    expect(structuralGaps.length).toBeGreaterThan(0);

    // Store as KnowledgeGap records
    for (const gap of structuralGaps) {
      await db.knowledgeGaps.put({
        id: createId<GapId>("gap"),
        description: "Structural gap between disconnected topic clusters.",
        topicIds: [gap.from, gap.to],
        gapType: "structural",
        significance: 0.8,
        createdAt: Date.now(),
      });
    }

    const storedGaps = await db.knowledgeGaps
      .where("gapType")
      .equals("structural")
      .toArray();
    expect(storedGaps.length).toBeGreaterThan(0);
  });
});

describe("gap analysis: re-run idempotency", () => {
  it("clears previous gaps and questions before storing new ones", async () => {
    const topicA = await seedTopic(db, "Neural Networks", 10);
    const topicB = await seedTopic(db, "Image Classification", 1);

    // First run: store gaps and questions
    const gap1: KnowledgeGap = {
      id: createId<GapId>("gap"),
      description: "First run gap.",
      topicIds: [topicB.id],
      gapType: "density",
      significance: 0.9,
      createdAt: Date.now(),
    };
    await db.knowledgeGaps.bulkPut([gap1]);

    const question1: ResearchQuestion = {
      id: createId<QuestionId>("question"),
      gapId: gap1.id,
      question: "First run question?",
      rationale: "First run rationale.",
      impact: 8,
      feasibility: 7,
      overallScore: 8 * 0.6 + 7 * 0.4,
      createdAt: Date.now(),
    };
    await db.researchQuestions.bulkPut([question1]);

    let storedGaps = await db.knowledgeGaps.toArray();
    let storedQuestions = await db.researchQuestions.toArray();
    expect(storedGaps).toHaveLength(1);
    expect(storedQuestions).toHaveLength(1);

    // Second run: clear then store new results (simulating hook behavior)
    await db.knowledgeGaps.clear();
    await db.researchQuestions.clear();

    const gap2: KnowledgeGap = {
      id: createId<GapId>("gap"),
      description: "Second run gap.",
      topicIds: [topicA.id],
      gapType: "structural",
      significance: 0.7,
      createdAt: Date.now(),
    };
    await db.knowledgeGaps.bulkPut([gap2]);

    const question2: ResearchQuestion = {
      id: createId<QuestionId>("question"),
      gapId: gap2.id,
      question: "Second run question?",
      rationale: "Second run rationale.",
      impact: 6,
      feasibility: 9,
      overallScore: 6 * 0.6 + 9 * 0.4,
      createdAt: Date.now(),
    };
    await db.researchQuestions.bulkPut([question2]);

    storedGaps = await db.knowledgeGaps.toArray();
    storedQuestions = await db.researchQuestions.toArray();

    // Should have exactly 1 each, not accumulated
    expect(storedGaps).toHaveLength(1);
    expect(storedGaps[0].description).toBe("Second run gap.");
    expect(storedGaps[0].gapType).toBe("structural");

    expect(storedQuestions).toHaveLength(1);
    expect(storedQuestions[0].question).toBe("Second run question?");
  });

  it("ends with zero gaps and questions if second run finds none", async () => {
    await seedTopic(db, "Neural Networks", 10);

    // First run: store a gap and question
    const gap: KnowledgeGap = {
      id: createId<GapId>("gap"),
      description: "A gap.",
      topicIds: [],
      gapType: "density",
      significance: 0.5,
      createdAt: Date.now(),
    };
    await db.knowledgeGaps.bulkPut([gap]);

    const question: ResearchQuestion = {
      id: createId<QuestionId>("question"),
      gapId: gap.id,
      question: "A question?",
      rationale: "A rationale.",
      impact: 5,
      feasibility: 5,
      overallScore: 5,
      createdAt: Date.now(),
    };
    await db.researchQuestions.bulkPut([question]);

    let storedGaps = await db.knowledgeGaps.toArray();
    let storedQuestions = await db.researchQuestions.toArray();
    expect(storedGaps).toHaveLength(1);
    expect(storedQuestions).toHaveLength(1);

    // Second run: clear, but find no gaps
    await db.knowledgeGaps.clear();
    await db.researchQuestions.clear();
    // No bulkPut — analysis found nothing

    storedGaps = await db.knowledgeGaps.toArray();
    storedQuestions = await db.researchQuestions.toArray();
    expect(storedGaps).toHaveLength(0);
    expect(storedQuestions).toHaveLength(0);
  });

  it("replaces all previous results when re-running with different count", async () => {
    const topicA = await seedTopic(db, "Topic A", 10);
    const topicB = await seedTopic(db, "Topic B", 2);
    const topicC = await seedTopic(db, "Topic C", 1);

    // First run: 1 gap with 1 question
    const gap1: KnowledgeGap = {
      id: createId<GapId>("gap"),
      description: "Run 1 gap.",
      topicIds: [topicB.id],
      gapType: "density",
      significance: 0.8,
      createdAt: Date.now(),
    };
    await db.knowledgeGaps.bulkPut([gap1]);
    await db.researchQuestions.bulkPut([
      {
        id: createId<QuestionId>("question"),
        gapId: gap1.id,
        question: "Run 1 question?",
        rationale: "Run 1 rationale.",
        impact: 7,
        feasibility: 6,
        overallScore: 7 * 0.6 + 6 * 0.4,
        createdAt: Date.now(),
      },
    ]);

    // Second run: clear and store 2 gaps with 3 questions
    await db.knowledgeGaps.clear();
    await db.researchQuestions.clear();

    const gapA: KnowledgeGap = {
      id: createId<GapId>("gap"),
      description: "Run 2 gap A.",
      topicIds: [topicB.id],
      gapType: "density",
      significance: 0.6,
      createdAt: Date.now(),
    };
    const gapB: KnowledgeGap = {
      id: createId<GapId>("gap"),
      description: "Run 2 gap B.",
      topicIds: [topicC.id],
      gapType: "structural",
      significance: 0.9,
      createdAt: Date.now(),
    };
    await db.knowledgeGaps.bulkPut([gapA, gapB]);

    await db.researchQuestions.bulkPut([
      {
        id: createId<QuestionId>("question"),
        gapId: gapA.id,
        question: "Run 2 question 1?",
        rationale: "Rationale 1.",
        impact: 8,
        feasibility: 5,
        overallScore: 8 * 0.6 + 5 * 0.4,
        createdAt: Date.now(),
      },
      {
        id: createId<QuestionId>("question"),
        gapId: gapA.id,
        question: "Run 2 question 2?",
        rationale: "Rationale 2.",
        impact: 4,
        feasibility: 9,
        overallScore: 4 * 0.6 + 9 * 0.4,
        createdAt: Date.now(),
      },
      {
        id: createId<QuestionId>("question"),
        gapId: gapB.id,
        question: "Run 2 question 3?",
        rationale: "Rationale 3.",
        impact: 9,
        feasibility: 3,
        overallScore: 9 * 0.6 + 3 * 0.4,
        createdAt: Date.now(),
      },
    ]);

    const storedGaps = await db.knowledgeGaps.toArray();
    const storedQuestions = await db.researchQuestions.toArray();

    // Should have exactly 2 gaps and 3 questions, not accumulated from run 1
    expect(storedGaps).toHaveLength(2);
    expect(storedQuestions).toHaveLength(3);

    const gapDescriptions = storedGaps.map((g) => g.description).sort();
    expect(gapDescriptions).toEqual(["Run 2 gap A.", "Run 2 gap B."]);

    const questionTexts = storedQuestions.map((q) => q.question).sort();
    expect(questionTexts).toEqual([
      "Run 2 question 1?",
      "Run 2 question 2?",
      "Run 2 question 3?",
    ]);
  });

  it("clears questions even when they belong to gaps from previous run", async () => {
    const topicA = await seedTopic(db, "Topic A", 5);

    // First run: gap with 2 questions
    const gap1: KnowledgeGap = {
      id: createId<GapId>("gap"),
      description: "Old gap.",
      topicIds: [topicA.id],
      gapType: "density",
      significance: 0.5,
      createdAt: Date.now(),
    };
    await db.knowledgeGaps.bulkPut([gap1]);
    await db.researchQuestions.bulkPut([
      {
        id: createId<QuestionId>("question"),
        gapId: gap1.id,
        question: "Old question 1?",
        rationale: "Rationale.",
        impact: 5,
        feasibility: 5,
        overallScore: 5,
        createdAt: Date.now(),
      },
      {
        id: createId<QuestionId>("question"),
        gapId: gap1.id,
        question: "Old question 2?",
        rationale: "Rationale.",
        impact: 5,
        feasibility: 5,
        overallScore: 5,
        createdAt: Date.now(),
      },
    ]);

    expect(await db.researchQuestions.count()).toBe(2);

    // Second run: clear both tables, store a new gap with only 1 question
    await db.knowledgeGaps.clear();
    await db.researchQuestions.clear();

    const gap2: KnowledgeGap = {
      id: createId<GapId>("gap"),
      description: "New gap.",
      topicIds: [topicA.id],
      gapType: "methodological",
      significance: 0.7,
      createdAt: Date.now(),
    };
    await db.knowledgeGaps.bulkPut([gap2]);
    await db.researchQuestions.bulkPut([
      {
        id: createId<QuestionId>("question"),
        gapId: gap2.id,
        question: "New question?",
        rationale: "New rationale.",
        impact: 9,
        feasibility: 8,
        overallScore: 9 * 0.6 + 8 * 0.4,
        createdAt: Date.now(),
      },
    ]);

    const gaps = await db.knowledgeGaps.toArray();
    const questions = await db.researchQuestions.toArray();

    expect(gaps).toHaveLength(1);
    expect(gaps[0].description).toBe("New gap.");

    // Only the new question, not the 2 old ones
    expect(questions).toHaveLength(1);
    expect(questions[0].question).toBe("New question?");
    expect(questions[0].gapId).toBe(gap2.id);
  });
});
