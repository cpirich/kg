import type {
  ChunkId,
  Claim,
  ClaimId,
  DocumentId,
  Topic,
  TopicId,
  TopicRelationship,
} from "@/types/domain";
import { createId } from "@/types/domain";
import type Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  analyzeGaps,
  findAIGaps,
  findDensityGaps,
  findStructuralGaps,
} from "./gap-analyzer";

const mockCreate = vi.fn();
const mockClient = {
  messages: { create: mockCreate },
} as unknown as Anthropic;

function makeResponse(text: string) {
  return { content: [{ type: "text", text }] };
}

function makeTopic(label: string, claimCount: number, id?: TopicId): Topic {
  return {
    id: id ?? createId<TopicId>("topic"),
    label,
    normalizedLabel: label.toLowerCase(),
    claimCount,
    documentCount: 1,
  };
}

function makeRelationship(
  sourceId: TopicId,
  targetId: TopicId,
): TopicRelationship {
  return {
    id: `rel_${sourceId}_${targetId}`,
    sourceId,
    targetId,
    type: "related",
    weight: 1,
  };
}

function makeClaim(text: string, topicIds: TopicId[]): Claim {
  return {
    id: createId<ClaimId>("claim"),
    documentId: createId<DocumentId>("doc"),
    chunkId: createId<ChunkId>("chunk"),
    text,
    type: "finding",
    confidence: 0.9,
    topicIds,
    createdAt: Date.now(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findStructuralGaps", () => {
  it("returns empty for fewer than 2 topics", () => {
    const topic = makeTopic("solo", 5);
    expect(findStructuralGaps([topic], [])).toEqual([]);
    expect(findStructuralGaps([], [])).toEqual([]);
  });

  it("finds gaps between high-degree unconnected topics", () => {
    const tA = makeTopic("Machine Learning", 5);
    const tB = makeTopic("Statistics", 5);
    const tC = makeTopic("Ethics", 5);

    // A and B each have 2 relationships (to C), making them above median
    // C also has 2 relationships. With 3 topics and sorted degrees [2,2,2], median=2
    // All have degree 2, none are > median, so we need asymmetry.
    // Let's create a scenario where A and B are high-degree but not connected.
    const tD = makeTopic("Baseline", 2);
    const tE = makeTopic("Accuracy", 2);

    // A connects to C, D, E (degree 3)
    // B connects to C, D, E (degree 3)
    // C connects to A, B (degree 2)
    // D connects to A, B (degree 2)
    // E connects to A, B (degree 2)
    // Degrees sorted: [2,2,2,3,3], median at index 2 = 2
    // High-degree (>2): A, B
    // A and B are not directly connected → structural gap
    const rels = [
      makeRelationship(tA.id, tC.id),
      makeRelationship(tA.id, tD.id),
      makeRelationship(tA.id, tE.id),
      makeRelationship(tB.id, tC.id),
      makeRelationship(tB.id, tD.id),
      makeRelationship(tB.id, tE.id),
    ];

    const gaps = findStructuralGaps([tA, tB, tC, tD, tE], rels);

    expect(gaps).toHaveLength(1);
    expect(gaps[0].gapType).toBe("structural");
    expect(gaps[0].topicIds).toContain(tA.id);
    expect(gaps[0].topicIds).toContain(tB.id);
    expect(gaps[0].description).toContain("Machine Learning");
    expect(gaps[0].description).toContain("Statistics");
  });

  it("does not flag connected high-degree topics", () => {
    const tA = makeTopic("A", 5);
    const tB = makeTopic("B", 5);
    const tC = makeTopic("C", 1);
    const tD = makeTopic("D", 1);

    // A has degree 3 (connects to B, C, D)
    // B has degree 3 (connects to A, C, D)
    // C has degree 2 (connects to A, B)
    // D has degree 2 (connects to A, B)
    // Sorted: [2,2,3,3], median at index 2 = 3
    // High-degree (>3): none → no gaps
    // Actually median = sorted[2] = 3 for [2,2,3,3]
    // Let's use 5 topics for clearer median
    const tE = makeTopic("E", 1);

    // A connects to B, C, D, E (degree 4)
    // B connects to A, C, D, E (degree 4)
    // C, D, E each connect to A, B (degree 2)
    // Sorted: [2,2,2,4,4], median at index 2 = 2
    // High-degree (>2): A, B
    // But A and B ARE connected → no gap
    const rels = [
      makeRelationship(tA.id, tB.id),
      makeRelationship(tA.id, tC.id),
      makeRelationship(tA.id, tD.id),
      makeRelationship(tA.id, tE.id),
      makeRelationship(tB.id, tC.id),
      makeRelationship(tB.id, tD.id),
      makeRelationship(tB.id, tE.id),
    ];

    const gaps = findStructuralGaps([tA, tB, tC, tD, tE], rels);
    expect(gaps).toHaveLength(0);
  });

  it("significance scales with combined degree", () => {
    const tA = makeTopic("A", 5);
    const tB = makeTopic("B", 5);
    const tC = makeTopic("C", 1);

    // A connects to C (degree 1), B connects to C (degree 1), C has degree 2
    // Sorted: [1,1,2], median = 1. High-degree (>1): C
    // Only one high-degree topic, no pairs → no gaps
    // Need 2 high-degree topics not connected
    const tD = makeTopic("D", 1);
    const tE = makeTopic("E", 1);

    // Setup: A-C, A-D, A-E, B-C, B-D, B-E → A and B each have degree 3
    // C, D, E each have degree 2
    // Sorted: [2,2,2,3,3], median = 2. High-degree: A(3), B(3)
    // A and B not connected → gap
    const rels = [
      makeRelationship(tA.id, tC.id),
      makeRelationship(tA.id, tD.id),
      makeRelationship(tA.id, tE.id),
      makeRelationship(tB.id, tC.id),
      makeRelationship(tB.id, tD.id),
      makeRelationship(tB.id, tE.id),
    ];

    const gaps = findStructuralGaps([tA, tB, tC, tD, tE], rels);
    expect(gaps).toHaveLength(1);

    // significance = 0.5 + 0.5 * min(1, (3+3) / (5*2))
    // = 0.5 + 0.5 * min(1, 0.6) = 0.5 + 0.3 = 0.8
    expect(gaps[0].significance).toBeCloseTo(0.8, 5);
  });

  it("returns no gaps when all topics have the same degree", () => {
    // If all topics have the same degree, none are > median
    const tA = makeTopic("A", 3);
    const tB = makeTopic("B", 3);
    const tC = makeTopic("C", 3);

    // Each connects to the other two → all degree 2
    const rels = [
      makeRelationship(tA.id, tB.id),
      makeRelationship(tB.id, tC.id),
      makeRelationship(tA.id, tC.id),
    ];

    const gaps = findStructuralGaps([tA, tB, tC], rels);
    expect(gaps).toHaveLength(0);
  });
});

describe("findDensityGaps", () => {
  it("returns empty for empty topics", () => {
    expect(findDensityGaps([])).toEqual([]);
  });

  it("returns empty when average claims < 1", () => {
    const topics = [makeTopic("A", 0), makeTopic("B", 0)];
    expect(findDensityGaps(topics)).toEqual([]);
  });

  it("identifies topics below half the average", () => {
    const topics = [
      makeTopic("Well-studied", 10),
      makeTopic("Also-studied", 10),
      makeTopic("Under-studied", 1),
    ];
    // avg = 21/3 = 7, threshold = 3.5
    // "Under-studied" has 1 < 3.5 → gap

    const gaps = findDensityGaps(topics);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].gapType).toBe("density");
    expect(gaps[0].topicIds).toHaveLength(1);
    expect(gaps[0].description).toContain("Under-studied");
  });

  it("significance equals 1 minus ratio", () => {
    const topics = [makeTopic("A", 10), makeTopic("B", 10), makeTopic("C", 2)];
    // avg = 22/3 ≈ 7.333, threshold = 3.667
    // C: ratio = 2 / 7.333 ≈ 0.2727
    // significance = 1 - 0.2727 ≈ 0.7273

    const gaps = findDensityGaps(topics);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].significance).toBeCloseTo(1 - 2 / (22 / 3), 5);
  });

  it("does not flag topics above threshold", () => {
    const topics = [makeTopic("A", 10), makeTopic("B", 8), makeTopic("C", 6)];
    // avg = 24/3 = 8, threshold = 4
    // All topics >= 4 → no gaps

    const gaps = findDensityGaps(topics);
    expect(gaps).toHaveLength(0);
  });
});

describe("findAIGaps", () => {
  it("parses valid AI response into KnowledgeGap objects", async () => {
    const tA = makeTopic("Machine Learning", 5);
    const tB = makeTopic("Ethics", 3);
    const claim = makeClaim("ML models can be biased.", [tA.id]);

    const responseJson = JSON.stringify({
      gaps: [
        {
          description: "Lack of ethical frameworks for ML",
          topicLabels: ["Machine Learning", "Ethics"],
          gapType: "methodological",
          significance: 0.85,
        },
      ],
    });

    mockCreate.mockResolvedValueOnce(makeResponse(responseJson));

    const gaps = await findAIGaps([tA, tB], [claim], mockClient, "test-model");

    expect(gaps).toHaveLength(1);
    expect(gaps[0].description).toBe("Lack of ethical frameworks for ML");
    expect(gaps[0].gapType).toBe("methodological");
    expect(gaps[0].significance).toBe(0.85);
    expect(gaps[0].topicIds).toContain(tA.id);
    expect(gaps[0].topicIds).toContain(tB.id);
    expect(gaps[0].id).toMatch(/^gap_/);
    expect(gaps[0].createdAt).toBeGreaterThan(0);
  });

  it("maps topic labels case-insensitively", async () => {
    const topic = makeTopic("Neural Networks", 4);

    const responseJson = JSON.stringify({
      gaps: [
        {
          description: "Gap in neural network research",
          topicLabels: ["neural networks"],
          gapType: "structural",
          significance: 0.7,
        },
      ],
    });

    mockCreate.mockResolvedValueOnce(makeResponse(responseJson));

    const gaps = await findAIGaps([topic], [], mockClient, "test-model");

    expect(gaps).toHaveLength(1);
    expect(gaps[0].topicIds).toContain(topic.id);
  });

  it("handles unknown topic labels with empty topicIds", async () => {
    const topic = makeTopic("Known Topic", 3);

    const responseJson = JSON.stringify({
      gaps: [
        {
          description: "Gap involving unknown topic",
          topicLabels: ["Unknown Topic", "Another Unknown"],
          gapType: "temporal",
          significance: 0.5,
        },
      ],
    });

    mockCreate.mockResolvedValueOnce(makeResponse(responseJson));

    const gaps = await findAIGaps([topic], [], mockClient, "test-model");

    expect(gaps).toHaveLength(1);
    expect(gaps[0].topicIds).toEqual([]);
  });

  it("returns empty on API error", async () => {
    const topic = makeTopic("Test", 2);

    mockCreate.mockRejectedValueOnce(new Error("API rate limited"));

    const gaps = await findAIGaps([topic], [], mockClient, "test-model");

    expect(gaps).toEqual([]);
  });

  it("returns empty for empty topics", async () => {
    const gaps = await findAIGaps([], [], mockClient, "test-model");

    expect(gaps).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("defaults invalid gap types to structural", async () => {
    const topic = makeTopic("Test Topic", 3);

    const responseJson = JSON.stringify({
      gaps: [
        {
          description: "A gap with bad type",
          topicLabels: ["Test Topic"],
          gapType: "invalid_type",
          significance: 0.6,
        },
      ],
    });

    mockCreate.mockResolvedValueOnce(makeResponse(responseJson));

    const gaps = await findAIGaps([topic], [], mockClient, "test-model");

    expect(gaps).toHaveLength(1);
    expect(gaps[0].gapType).toBe("structural");
  });

  it("clamps significance to 0-1", async () => {
    const topic = makeTopic("Test", 3);

    const responseJson = JSON.stringify({
      gaps: [
        {
          description: "Over-significant",
          topicLabels: ["Test"],
          gapType: "structural",
          significance: 1.5,
        },
        {
          description: "Under-significant",
          topicLabels: ["Test"],
          gapType: "density",
          significance: -0.3,
        },
      ],
    });

    mockCreate.mockResolvedValueOnce(makeResponse(responseJson));

    const gaps = await findAIGaps([topic], [], mockClient, "test-model");

    expect(gaps).toHaveLength(2);
    expect(gaps[0].significance).toBe(1);
    expect(gaps[1].significance).toBe(0);
  });

  it("filters gaps with missing required fields", async () => {
    const topic = makeTopic("Test", 3);

    const responseJson = JSON.stringify({
      gaps: [
        {
          description: "Valid gap",
          topicLabels: ["Test"],
          gapType: "structural",
          significance: 0.7,
        },
        {
          // Missing description
          topicLabels: ["Test"],
          gapType: "structural",
          significance: 0.5,
        },
        {
          description: "Missing significance",
          topicLabels: ["Test"],
          gapType: "density",
          // Missing significance
        },
      ],
    });

    mockCreate.mockResolvedValueOnce(makeResponse(responseJson));

    const gaps = await findAIGaps([topic], [], mockClient, "test-model");

    expect(gaps).toHaveLength(1);
    expect(gaps[0].description).toBe("Valid gap");
  });

  it("handles response without gaps key", async () => {
    const topic = makeTopic("Test", 3);

    const responseJson = JSON.stringify({ results: [] });

    mockCreate.mockResolvedValueOnce(makeResponse(responseJson));

    const gaps = await findAIGaps([topic], [], mockClient, "test-model");

    expect(gaps).toEqual([]);
  });

  it("matches topics via normalizedLabel", async () => {
    const topic: Topic = {
      id: createId<TopicId>("topic"),
      label: "Neural Networks",
      normalizedLabel: "neural network",
      claimCount: 4,
      documentCount: 1,
    };

    const responseJson = JSON.stringify({
      gaps: [
        {
          description: "A gap",
          topicLabels: ["neural network"],
          gapType: "structural",
          significance: 0.6,
        },
      ],
    });

    mockCreate.mockResolvedValueOnce(makeResponse(responseJson));

    const gaps = await findAIGaps([topic], [], mockClient, "test-model");

    expect(gaps).toHaveLength(1);
    expect(gaps[0].topicIds).toContain(topic.id);
  });
});

describe("analyzeGaps", () => {
  it("combines structural, density, and AI gaps", async () => {
    // Setup topics where:
    // - A and B are high-degree but not connected (structural gap)
    // - E has low claims (density gap)
    // - AI returns one gap
    const tA = makeTopic("A", 5);
    const tB = makeTopic("B", 5);
    const tC = makeTopic("C", 5);
    const tD = makeTopic("D", 5);
    const tE = makeTopic("E", 1);

    // A has degree 3, B has degree 3, C/D/E have degree 2
    // Sorted: [2,2,2,3,3], median = 2
    // High-degree: A(3), B(3) — not connected → structural gap
    const rels = [
      makeRelationship(tA.id, tC.id),
      makeRelationship(tA.id, tD.id),
      makeRelationship(tA.id, tE.id),
      makeRelationship(tB.id, tC.id),
      makeRelationship(tB.id, tD.id),
      makeRelationship(tB.id, tE.id),
    ];

    // avg claims = 21/5 = 4.2, threshold = 2.1
    // E has 1 < 2.1 → density gap

    const aiResponseJson = JSON.stringify({
      gaps: [
        {
          description: "AI-detected gap",
          topicLabels: ["A"],
          gapType: "methodological",
          significance: 0.9,
        },
      ],
    });

    mockCreate.mockResolvedValueOnce(makeResponse(aiResponseJson));

    const claims = [makeClaim("Test claim", [tA.id])];
    const gaps = await analyzeGaps(
      [tA, tB, tC, tD, tE],
      rels,
      claims,
      mockClient,
      "test-model",
    );

    const structural = gaps.filter((g) => g.gapType === "structural");
    const density = gaps.filter((g) => g.gapType === "density");
    const methodological = gaps.filter((g) => g.gapType === "methodological");

    expect(structural.length).toBeGreaterThanOrEqual(1);
    expect(density.length).toBeGreaterThanOrEqual(1);
    expect(methodological).toHaveLength(1);
    expect(gaps.length).toBe(
      structural.length + density.length + methodological.length,
    );
  });
});
