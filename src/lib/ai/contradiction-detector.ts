import type { ContradictionCheckResult } from "@/types/ai";
import type {
  Claim,
  ClaimId,
  Contradiction,
  ContradictionId,
} from "@/types/domain";
import { createId } from "@/types/domain";
import type Anthropic from "@anthropic-ai/sdk";
import { contradictionCheckPrompt } from "./prompts";

/**
 * Try to parse a JSON response from the AI, extracting from markdown code blocks if needed.
 */
function parseJsonResponse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1].trim());
    }
    throw new Error(`Failed to parse JSON response: ${text.slice(0, 200)}`);
  }
}

/**
 * Validate and normalize a contradiction check result from AI.
 */
function validateContradictionResult(data: unknown): ContradictionCheckResult {
  if (
    !data ||
    typeof data !== "object" ||
    !("isContradiction" in data) ||
    !("description" in data) ||
    !("severity" in data) ||
    !("confidence" in data)
  ) {
    return {
      isContradiction: false,
      description: "Invalid response structure",
      severity: "low",
      confidence: 0,
    };
  }

  const raw = data as Record<string, unknown>;
  const severityValues = ["low", "medium", "high"] as const;
  const severity = severityValues.includes(
    raw.severity as (typeof severityValues)[number],
  )
    ? (raw.severity as ContradictionCheckResult["severity"])
    : "low";

  return {
    isContradiction: Boolean(raw.isContradiction),
    description: typeof raw.description === "string" ? raw.description : "",
    severity,
    confidence: Math.max(
      0,
      Math.min(1, typeof raw.confidence === "number" ? raw.confidence : 0),
    ),
  };
}

/**
 * Generate candidate contradiction pairs from a set of claims.
 * Two claims are candidates if they share at least one topic and have the same claim type.
 * This is a pure function — no AI calls.
 */
export function generateContradictionCandidates(
  claims: Claim[],
): Array<[ClaimId, ClaimId]> {
  const candidates: Array<[ClaimId, ClaimId]> = [];
  const seen = new Set<string>();

  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const claimA = claims[i];
      const claimB = claims[j];

      // Must have the same claim type
      if (claimA.type !== claimB.type) {
        continue;
      }

      // Must share at least one topic
      const sharedTopic = claimA.topicIds.some((topicId) =>
        claimB.topicIds.includes(topicId),
      );
      if (!sharedTopic) {
        continue;
      }

      // Avoid duplicates (order-independent key)
      const key =
        claimA.id < claimB.id
          ? `${claimA.id}:${claimB.id}`
          : `${claimB.id}:${claimA.id}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      candidates.push([claimA.id, claimB.id]);
    }
  }

  return candidates;
}

/**
 * Verify whether two claims contradict each other using Claude.
 * Sends both claim texts to the AI and returns the result.
 */
export async function verifyContradiction(
  claimA: Claim,
  claimB: Claim,
  client: Anthropic,
  model: string,
): Promise<ContradictionCheckResult> {
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: contradictionCheckPrompt(claimA.text, claimB.text),
        },
      ],
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";

    const parsed = parseJsonResponse(responseText);
    return validateContradictionResult(parsed);
  } catch (error) {
    console.warn("Contradiction verification failed:", error);
    return {
      isContradiction: false,
      description:
        error instanceof Error ? error.message : "Verification failed",
      severity: "low",
      confidence: 0,
    };
  }
}

/**
 * Orchestrate the full contradiction detection pipeline.
 * 1. Generate candidate pairs from claims (shared topics, same type).
 * 2. Verify each candidate pair with Claude.
 * 3. Return Contradiction objects for pairs with confidence > 0.6.
 */
export async function detectContradictions(
  claims: Claim[],
  client: Anthropic,
  model: string,
): Promise<Contradiction[]> {
  const candidates = generateContradictionCandidates(claims);

  if (candidates.length === 0) {
    return [];
  }

  // Build a lookup map for claims by ID
  const claimMap = new Map<ClaimId, Claim>();
  for (const claim of claims) {
    claimMap.set(claim.id, claim);
  }

  const contradictions: Contradiction[] = [];

  // Process candidates sequentially to avoid rate limiting
  for (const [idA, idB] of candidates) {
    const claimA = claimMap.get(idA);
    const claimB = claimMap.get(idB);

    if (!claimA || !claimB) {
      continue;
    }

    const result = await verifyContradiction(claimA, claimB, client, model);

    if (result.isContradiction && result.confidence > 0.6) {
      contradictions.push({
        id: createId<ContradictionId>("contra"),
        claimAId: idA,
        claimBId: idB,
        description: result.description,
        severity: result.severity,
        confidence: result.confidence,
        status: "pending",
        createdAt: Date.now(),
      });
    }
  }

  return contradictions;
}
