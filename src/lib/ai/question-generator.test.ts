import type { Claim, GapId, KnowledgeGap } from "@/types/domain";
import { createId } from "@/types/domain";
import type Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateQuestions } from "./question-generator";

const mockCreate = vi.fn();
const mockClient = {
  messages: { create: mockCreate },
} as unknown as Anthropic;

function makeResponse(text: string) {
  return { content: [{ type: "text", text }] };
}

const testGap: KnowledgeGap = {
  id: createId<GapId>("gap"),
  description: "Missing research on long-term effects",
  topicIds: [],
  gapType: "methodological",
  significance: 0.8,
  createdAt: Date.now(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateQuestions", () => {
  it("parses valid response into ResearchQuestion objects", async () => {
    const responseJson = JSON.stringify({
      questions: [
        {
          question: "What are the long-term effects of X?",
          rationale: "No longitudinal studies exist.",
          impact: 8,
          feasibility: 6,
        },
        {
          question: "How does Y change over time?",
          rationale: "Temporal data is lacking.",
          impact: 7,
          feasibility: 5,
        },
      ],
    });

    mockCreate.mockResolvedValueOnce(makeResponse(responseJson));

    const questions = await generateQuestions(
      testGap,
      [],
      [],
      mockClient,
      "test-model",
    );

    expect(questions).toHaveLength(2);
    expect(questions[0].question).toBe("What are the long-term effects of X?");
    expect(questions[0].rationale).toBe("No longitudinal studies exist.");
    expect(questions[0].impact).toBe(8);
    expect(questions[0].feasibility).toBe(6);
    expect(questions[0].gapId).toBe(testGap.id);
    expect(questions[0].id).toMatch(/^question_/);
    expect(questions[0].createdAt).toBeGreaterThan(0);

    expect(questions[1].question).toBe("How does Y change over time?");
  });

  it("calculates overallScore = impact * 0.6 + feasibility * 0.4", async () => {
    const responseJson = JSON.stringify({
      questions: [
        {
          question: "Test question",
          rationale: "Test rationale",
          impact: 10,
          feasibility: 5,
        },
      ],
    });

    mockCreate.mockResolvedValueOnce(makeResponse(responseJson));

    const questions = await generateQuestions(
      testGap,
      [],
      [],
      mockClient,
      "test-model",
    );

    expect(questions).toHaveLength(1);
    // overallScore = 10 * 0.6 + 5 * 0.4 = 6 + 2 = 8
    expect(questions[0].overallScore).toBe(8);
  });

  it("clamps impact and feasibility to 1-10", async () => {
    const responseJson = JSON.stringify({
      questions: [
        {
          question: "Question with extreme scores",
          rationale: "Testing clamping",
          impact: 15,
          feasibility: -3,
        },
      ],
    });

    mockCreate.mockResolvedValueOnce(makeResponse(responseJson));

    const questions = await generateQuestions(
      testGap,
      [],
      [],
      mockClient,
      "test-model",
    );

    expect(questions).toHaveLength(1);
    expect(questions[0].impact).toBe(10);
    expect(questions[0].feasibility).toBe(1);
    // overallScore = 10 * 0.6 + 1 * 0.4 = 6 + 0.4 = 6.4
    expect(questions[0].overallScore).toBeCloseTo(6.4);
  });

  it("returns empty on API error", async () => {
    mockCreate.mockRejectedValueOnce(new Error("API rate limited"));

    const questions = await generateQuestions(
      testGap,
      [],
      [],
      mockClient,
      "test-model",
    );

    expect(questions).toEqual([]);
  });

  it("filters questions with missing required fields", async () => {
    const responseJson = JSON.stringify({
      questions: [
        {
          question: "Valid question",
          rationale: "Valid rationale",
          impact: 7,
          feasibility: 6,
        },
        {
          // Missing question
          rationale: "Has rationale but no question",
          impact: 5,
          feasibility: 4,
        },
        {
          question: "Missing rationale",
          // Missing rationale
          impact: 6,
          feasibility: 5,
        },
        {
          question: "Missing impact",
          rationale: "Has rationale",
          // Missing impact
          feasibility: 5,
        },
      ],
    });

    mockCreate.mockResolvedValueOnce(makeResponse(responseJson));

    const questions = await generateQuestions(
      testGap,
      [],
      [],
      mockClient,
      "test-model",
    );

    expect(questions).toHaveLength(1);
    expect(questions[0].question).toBe("Valid question");
  });

  it("handles empty questions array", async () => {
    const responseJson = JSON.stringify({ questions: [] });

    mockCreate.mockResolvedValueOnce(makeResponse(responseJson));

    const questions = await generateQuestions(
      testGap,
      [],
      [],
      mockClient,
      "test-model",
    );

    expect(questions).toEqual([]);
  });

  it("handles response without questions key", async () => {
    const responseJson = JSON.stringify({ results: [] });

    mockCreate.mockResolvedValueOnce(makeResponse(responseJson));

    const questions = await generateQuestions(
      testGap,
      [],
      [],
      mockClient,
      "test-model",
    );

    expect(questions).toEqual([]);
  });

  it("passes surrounding claims to the prompt", async () => {
    const claims: Claim[] = [
      {
        id: createId("claim"),
        documentId: createId("doc"),
        chunkId: createId("chunk"),
        text: "Claim about long-term effects",
        type: "finding",
        confidence: 0.9,
        topicIds: [],
        createdAt: Date.now(),
      },
    ];

    const responseJson = JSON.stringify({ questions: [] });
    mockCreate.mockResolvedValueOnce(makeResponse(responseJson));

    await generateQuestions(testGap, claims, [], mockClient, "test-model");

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages[0].content).toContain(
      "Claim about long-term effects",
    );
  });

  it("handles markdown-wrapped JSON response", async () => {
    const responseText = `Here are the questions:
\`\`\`json
{
  "questions": [
    {
      "question": "Wrapped question?",
      "rationale": "Test",
      "impact": 7,
      "feasibility": 5
    }
  ]
}
\`\`\``;

    mockCreate.mockResolvedValueOnce(makeResponse(responseText));

    const questions = await generateQuestions(
      testGap,
      [],
      [],
      mockClient,
      "test-model",
    );

    expect(questions).toHaveLength(1);
    expect(questions[0].question).toBe("Wrapped question?");
  });
});
