import type {
  ChunkId,
  Claim,
  ClaimId,
  DocumentId,
  TopicId,
} from "@/types/domain";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectContradictions,
  generateContradictionCandidates,
  verifyContradiction,
} from "./contradiction-detector";

// Helper to create mock claims with properly branded IDs
function makeClaim(overrides: {
  id: string;
  documentId?: string;
  chunkId?: string;
  text?: string;
  type?: Claim["type"];
  confidence?: number;
  topicIds?: string[];
  createdAt?: number;
}): Claim {
  return {
    id: overrides.id as ClaimId,
    documentId: (overrides.documentId ?? "doc_1") as DocumentId,
    chunkId: (overrides.chunkId ?? "chunk_1") as ChunkId,
    text: overrides.text ?? "A test claim.",
    type: overrides.type ?? "finding",
    confidence: overrides.confidence ?? 0.9,
    topicIds: (overrides.topicIds ?? ["topic_1"]) as TopicId[],
    createdAt: overrides.createdAt ?? Date.now(),
  };
}

describe("generateContradictionCandidates", () => {
  it("returns pairs of claims that share topics and have the same type", () => {
    const claims: Claim[] = [
      makeClaim({
        id: "claim_a",
        type: "finding",
        topicIds: ["topic_1", "topic_2"],
      }),
      makeClaim({
        id: "claim_b",
        type: "finding",
        topicIds: ["topic_2", "topic_3"],
      }),
    ];

    const candidates = generateContradictionCandidates(claims);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toEqual(["claim_a", "claim_b"]);
  });

  it("excludes pairs with different types", () => {
    const claims: Claim[] = [
      makeClaim({
        id: "claim_a",
        type: "finding",
        topicIds: ["topic_1"],
      }),
      makeClaim({
        id: "claim_b",
        type: "methodology",
        topicIds: ["topic_1"],
      }),
    ];

    const candidates = generateContradictionCandidates(claims);
    expect(candidates).toHaveLength(0);
  });

  it("excludes pairs with no shared topics", () => {
    const claims: Claim[] = [
      makeClaim({
        id: "claim_a",
        type: "finding",
        topicIds: ["topic_1"],
      }),
      makeClaim({
        id: "claim_b",
        type: "finding",
        topicIds: ["topic_2"],
      }),
    ];

    const candidates = generateContradictionCandidates(claims);
    expect(candidates).toHaveLength(0);
  });

  it("handles multiple candidates correctly", () => {
    const claims: Claim[] = [
      makeClaim({
        id: "claim_a",
        type: "finding",
        topicIds: ["topic_1"],
      }),
      makeClaim({
        id: "claim_b",
        type: "finding",
        topicIds: ["topic_1"],
      }),
      makeClaim({
        id: "claim_c",
        type: "finding",
        topicIds: ["topic_1"],
      }),
    ];

    const candidates = generateContradictionCandidates(claims);
    // 3 choose 2 = 3 pairs
    expect(candidates).toHaveLength(3);
  });

  it("does not produce duplicate pairs", () => {
    const claims: Claim[] = [
      makeClaim({
        id: "claim_a",
        type: "finding",
        topicIds: ["topic_1", "topic_2"],
      }),
      makeClaim({
        id: "claim_b",
        type: "finding",
        topicIds: ["topic_1", "topic_2"],
      }),
    ];

    const candidates = generateContradictionCandidates(claims);
    expect(candidates).toHaveLength(1);
  });

  it("returns empty array for a single claim", () => {
    const claims: Claim[] = [
      makeClaim({
        id: "claim_a",
        type: "finding",
        topicIds: ["topic_1"],
      }),
    ];

    const candidates = generateContradictionCandidates(claims);
    expect(candidates).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    const candidates = generateContradictionCandidates([]);
    expect(candidates).toHaveLength(0);
  });
});

describe("verifyContradiction", () => {
  const mockCreate = vi.fn();
  const mockClient = {
    messages: { create: mockCreate },
  } as unknown as import("@anthropic-ai/sdk").default;
  const model = "claude-sonnet-4-20250514";

  afterEach(() => {
    vi.clearAllMocks();
  });

  function makeResponse(text: string) {
    return {
      content: [{ type: "text", text }],
    };
  }

  it("returns a valid contradiction result", async () => {
    const responseJson = JSON.stringify({
      isContradiction: true,
      description: "These claims directly oppose each other on efficacy.",
      severity: "high",
      confidence: 0.85,
    });
    mockCreate.mockResolvedValueOnce(makeResponse(responseJson));

    const claimA = makeClaim({
      id: "claim_a",
      text: "Drug X is effective.",
    });
    const claimB = makeClaim({
      id: "claim_b",
      text: "Drug X is ineffective.",
    });

    const result = await verifyContradiction(claimA, claimB, mockClient, model);

    expect(result.isContradiction).toBe(true);
    expect(result.description).toBe(
      "These claims directly oppose each other on efficacy.",
    );
    expect(result.severity).toBe("high");
    expect(result.confidence).toBe(0.85);
  });

  it("returns non-contradiction for compatible claims", async () => {
    const responseJson = JSON.stringify({
      isContradiction: false,
      description: "These claims are about different aspects.",
      severity: "low",
      confidence: 0.2,
    });
    mockCreate.mockResolvedValueOnce(makeResponse(responseJson));

    const claimA = makeClaim({
      id: "claim_a",
      text: "Drug X reduces fever.",
    });
    const claimB = makeClaim({
      id: "claim_b",
      text: "Drug X causes drowsiness.",
    });

    const result = await verifyContradiction(claimA, claimB, mockClient, model);

    expect(result.isContradiction).toBe(false);
  });

  it("handles API error gracefully", async () => {
    mockCreate.mockRejectedValueOnce(new Error("Rate limited"));

    const claimA = makeClaim({ id: "claim_a" });
    const claimB = makeClaim({ id: "claim_b" });

    const result = await verifyContradiction(claimA, claimB, mockClient, model);

    expect(result.isContradiction).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it("handles invalid JSON response", async () => {
    mockCreate.mockResolvedValueOnce(makeResponse("not valid json"));

    const claimA = makeClaim({ id: "claim_a" });
    const claimB = makeClaim({ id: "claim_b" });

    const result = await verifyContradiction(claimA, claimB, mockClient, model);

    expect(result.isContradiction).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it("parses response from markdown code block", async () => {
    const responseText = `Here's my analysis:\n\`\`\`json\n${JSON.stringify({
      isContradiction: true,
      description: "Contradiction found",
      severity: "medium",
      confidence: 0.75,
    })}\n\`\`\``;
    mockCreate.mockResolvedValueOnce(makeResponse(responseText));

    const claimA = makeClaim({ id: "claim_a", text: "A is true." });
    const claimB = makeClaim({ id: "claim_b", text: "A is false." });

    const result = await verifyContradiction(claimA, claimB, mockClient, model);

    expect(result.isContradiction).toBe(true);
    expect(result.severity).toBe("medium");
    expect(result.confidence).toBe(0.75);
  });
});

describe("detectContradictions", () => {
  const mockCreate = vi.fn();
  const mockClient = {
    messages: { create: mockCreate },
  } as unknown as import("@anthropic-ai/sdk").default;
  const model = "claude-sonnet-4-20250514";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeResponse(text: string) {
    return {
      content: [{ type: "text", text }],
    };
  }

  it("detects contradictions above confidence threshold", async () => {
    const claims: Claim[] = [
      makeClaim({
        id: "claim_a",
        type: "finding",
        topicIds: ["topic_1"],
        text: "X increases Y.",
      }),
      makeClaim({
        id: "claim_b",
        type: "finding",
        topicIds: ["topic_1"],
        text: "X decreases Y.",
      }),
    ];

    mockCreate.mockResolvedValueOnce(
      makeResponse(
        JSON.stringify({
          isContradiction: true,
          description: "Opposing effects on Y",
          severity: "high",
          confidence: 0.9,
        }),
      ),
    );

    const result = await detectContradictions(claims, mockClient, model);

    expect(result).toHaveLength(1);
    expect(result[0].claimAId).toBe("claim_a");
    expect(result[0].claimBId).toBe("claim_b");
    expect(result[0].severity).toBe("high");
    expect(result[0].status).toBe("pending");
  });

  it("excludes contradictions below confidence threshold", async () => {
    const claims: Claim[] = [
      makeClaim({
        id: "claim_a",
        type: "finding",
        topicIds: ["topic_1"],
      }),
      makeClaim({
        id: "claim_b",
        type: "finding",
        topicIds: ["topic_1"],
      }),
    ];

    mockCreate.mockResolvedValueOnce(
      makeResponse(
        JSON.stringify({
          isContradiction: true,
          description: "Weak contradiction",
          severity: "low",
          confidence: 0.4, // Below 0.6 threshold
        }),
      ),
    );

    const result = await detectContradictions(claims, mockClient, model);

    expect(result).toHaveLength(0);
  });

  it("returns empty array when no candidates exist", async () => {
    const claims: Claim[] = [
      makeClaim({
        id: "claim_a",
        type: "finding",
        topicIds: ["topic_1"],
      }),
      makeClaim({
        id: "claim_b",
        type: "methodology",
        topicIds: ["topic_2"],
      }),
    ];

    const result = await detectContradictions(claims, mockClient, model);

    expect(result).toHaveLength(0);
    // Should not have called the AI at all
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns empty array for empty claims", async () => {
    const result = await detectContradictions([], mockClient, model);
    expect(result).toHaveLength(0);
  });
});
