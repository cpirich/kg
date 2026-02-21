import type { ClaimExtractionResult } from "@/types/ai";
import { getAIClient, getModelName } from "./client";
import { claimExtractionPrompt } from "./prompts";
import { parseJsonResponse } from "./utils";

/**
 * Validate and normalize the parsed claims data.
 */
function validateClaims(data: unknown): ClaimExtractionResult {
  if (
    !data ||
    typeof data !== "object" ||
    !("claims" in data) ||
    !Array.isArray((data as { claims: unknown }).claims)
  ) {
    return { claims: [], error: "Invalid response structure" };
  }

  const raw = data as { claims: Array<Record<string, unknown>> };
  const claims = raw.claims
    .filter(
      (c) =>
        typeof c.text === "string" &&
        typeof c.type === "string" &&
        typeof c.confidence === "number" &&
        Array.isArray(c.topics),
    )
    .map((c) => ({
      text: c.text as string,
      type: c.type as ClaimExtractionResult["claims"][number]["type"],
      confidence: Math.max(0, Math.min(1, c.confidence as number)),
      topics: (c.topics as unknown[]).filter(
        (t): t is string => typeof t === "string",
      ),
    }));

  return { claims };
}

/**
 * Extract claims from a text chunk using the AI model.
 * Retries once with a corrective prompt if JSON parsing fails.
 */
export async function extractClaims(
  chunkText: string,
): Promise<ClaimExtractionResult> {
  const client = await getAIClient();
  const model = await getModelName();

  try {
    // First attempt
    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      messages: [{ role: "user", content: claimExtractionPrompt(chunkText) }],
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";

    try {
      const parsed = parseJsonResponse(responseText);
      return validateClaims(parsed);
    } catch {
      // Retry with a corrective prompt
      const retryResponse = await client.messages.create({
        model,
        max_tokens: 2048,
        messages: [
          { role: "user", content: claimExtractionPrompt(chunkText) },
          { role: "assistant", content: responseText },
          {
            role: "user",
            content:
              "Your previous response was not valid JSON. Please return ONLY a valid JSON object with the exact format specified, with no additional text before or after the JSON.",
          },
        ],
      });

      const retryText =
        retryResponse.content[0].type === "text"
          ? retryResponse.content[0].text
          : "";

      try {
        const parsed = parseJsonResponse(retryText);
        return validateClaims(parsed);
      } catch {
        return {
          claims: [],
          error: "Failed to parse AI response after retry",
        };
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI error";
    return { claims: [], error: message };
  }
}
