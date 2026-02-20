import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the AI client module
vi.mock("@/lib/ai/client", () => ({
  getAIClient: vi.fn(),
  getModelName: vi.fn().mockResolvedValue("claude-sonnet-4-20250514"),
}));

import { getAIClient } from "@/lib/ai/client";
import { extractClaims } from "./claim-extractor";

const mockCreate = vi.fn();

beforeEach(() => {
  vi.mocked(getAIClient).mockResolvedValue({
    messages: {
      create: mockCreate,
    },
  } as unknown as Awaited<ReturnType<typeof getAIClient>>);
});

afterEach(() => {
  vi.clearAllMocks();
});

function makeResponse(text: string) {
  return {
    content: [{ type: "text", text }],
  };
}

describe("extractClaims", () => {
  it("parses a valid JSON response", async () => {
    const responseJson = JSON.stringify({
      claims: [
        {
          text: "Neural networks achieve 95% accuracy.",
          type: "finding",
          confidence: 0.9,
          topics: ["neural networks", "accuracy"],
        },
        {
          text: "We used a random forest baseline.",
          type: "methodology",
          confidence: 0.85,
          topics: ["random forest", "baseline"],
        },
      ],
    });

    mockCreate.mockResolvedValueOnce(makeResponse(responseJson));

    const result = await extractClaims("Some text about neural networks...");

    expect(result.claims).toHaveLength(2);
    expect(result.claims[0].text).toBe("Neural networks achieve 95% accuracy.");
    expect(result.claims[0].type).toBe("finding");
    expect(result.claims[0].confidence).toBe(0.9);
    expect(result.claims[0].topics).toEqual(["neural networks", "accuracy"]);
    expect(result.error).toBeUndefined();
  });

  it("handles response wrapped in markdown code block", async () => {
    const responseText = `Here is the extracted data:
\`\`\`json
{
  "claims": [
    {
      "text": "Sample size was insufficient.",
      "type": "limitation",
      "confidence": 0.7,
      "topics": ["sample size"]
    }
  ]
}
\`\`\``;

    mockCreate.mockResolvedValueOnce(makeResponse(responseText));

    const result = await extractClaims("Some text...");

    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].type).toBe("limitation");
    expect(result.error).toBeUndefined();
  });

  it("retries on invalid JSON and succeeds", async () => {
    // First response: invalid JSON
    mockCreate.mockResolvedValueOnce(
      makeResponse("I found some claims: not valid json"),
    );

    // Retry response: valid JSON
    const validJson = JSON.stringify({
      claims: [
        {
          text: "The hypothesis was confirmed.",
          type: "hypothesis",
          confidence: 0.6,
          topics: ["hypothesis testing"],
        },
      ],
    });
    mockCreate.mockResolvedValueOnce(makeResponse(validJson));

    const result = await extractClaims("Some text...");

    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].type).toBe("hypothesis");
    // Should have called create twice (original + retry)
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("returns error when both attempts fail to parse", async () => {
    mockCreate.mockResolvedValueOnce(makeResponse("not json at all"));
    mockCreate.mockResolvedValueOnce(makeResponse("still not json"));

    const result = await extractClaims("Some text...");

    expect(result.claims).toHaveLength(0);
    expect(result.error).toBe("Failed to parse AI response after retry");
  });

  it("returns error when API call throws", async () => {
    mockCreate.mockRejectedValueOnce(new Error("API rate limited"));

    const result = await extractClaims("Some text...");

    expect(result.claims).toHaveLength(0);
    expect(result.error).toBe("API rate limited");
  });

  it("handles empty claims array", async () => {
    mockCreate.mockResolvedValueOnce(
      makeResponse(JSON.stringify({ claims: [] })),
    );

    const result = await extractClaims("No claims here.");

    expect(result.claims).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  it("clamps confidence to 0-1 range", async () => {
    mockCreate.mockResolvedValueOnce(
      makeResponse(
        JSON.stringify({
          claims: [
            {
              text: "Overconfident claim.",
              type: "claim",
              confidence: 1.5,
              topics: ["test"],
            },
            {
              text: "Underconfident claim.",
              type: "claim",
              confidence: -0.3,
              topics: ["test"],
            },
          ],
        }),
      ),
    );

    const result = await extractClaims("Some text...");

    expect(result.claims[0].confidence).toBe(1);
    expect(result.claims[1].confidence).toBe(0);
  });

  it("filters out claims with missing required fields", async () => {
    mockCreate.mockResolvedValueOnce(
      makeResponse(
        JSON.stringify({
          claims: [
            {
              text: "Valid claim.",
              type: "finding",
              confidence: 0.9,
              topics: ["valid"],
            },
            {
              // Missing text
              type: "finding",
              confidence: 0.8,
              topics: ["invalid"],
            },
            {
              text: "Missing topics.",
              type: "claim",
              confidence: 0.7,
              // Missing topics array
            },
          ],
        }),
      ),
    );

    const result = await extractClaims("Some text...");

    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].text).toBe("Valid claim.");
  });

  it("filters non-string values from topics array", async () => {
    mockCreate.mockResolvedValueOnce(
      makeResponse(
        JSON.stringify({
          claims: [
            {
              text: "Claim with mixed topics.",
              type: "finding",
              confidence: 0.9,
              topics: ["valid topic", 42, null, "another topic"],
            },
          ],
        }),
      ),
    );

    const result = await extractClaims("Some text...");

    expect(result.claims[0].topics).toEqual(["valid topic", "another topic"]);
  });

  it("handles invalid response structure gracefully", async () => {
    mockCreate.mockResolvedValueOnce(
      makeResponse(JSON.stringify({ results: [] })),
    );

    // This will fail on first attempt (invalid structure), then retry
    mockCreate.mockResolvedValueOnce(
      makeResponse(JSON.stringify({ claims: [] })),
    );

    const result = await extractClaims("Some text...");

    // First parse succeeds as JSON but has invalid structure
    // validateClaims handles this
    expect(result.claims).toHaveLength(0);
  });
});
