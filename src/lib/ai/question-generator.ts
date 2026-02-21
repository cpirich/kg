import type { GeneratedQuestion } from "@/types/ai";
import type {
  Claim,
  KnowledgeGap,
  QuestionId,
  ResearchQuestion,
  Topic,
} from "@/types/domain";
import { createId } from "@/types/domain";
import type Anthropic from "@anthropic-ai/sdk";
import { questionGenerationPrompt } from "./prompts";
import { parseJsonResponse } from "./utils";

/**
 * Validate and normalize generated questions from AI.
 */
function validateQuestions(data: unknown): GeneratedQuestion[] {
  if (
    !data ||
    typeof data !== "object" ||
    !("questions" in data) ||
    !Array.isArray((data as { questions: unknown }).questions)
  ) {
    return [];
  }

  const raw = data as { questions: Array<Record<string, unknown>> };

  return raw.questions
    .filter(
      (q) =>
        typeof q.question === "string" &&
        typeof q.rationale === "string" &&
        typeof q.impact === "number" &&
        typeof q.feasibility === "number",
    )
    .map((q) => ({
      question: q.question as string,
      rationale: q.rationale as string,
      impact: Math.max(1, Math.min(10, q.impact as number)),
      feasibility: Math.max(1, Math.min(10, q.feasibility as number)),
    }));
}

/**
 * Generate research questions for a knowledge gap.
 * Sends the gap description and surrounding claims to Claude.
 * Generates 3-5 ranked questions with overallScore = impact * 0.6 + feasibility * 0.4.
 */
export async function generateQuestions(
  gap: KnowledgeGap,
  surroundingClaims: Claim[],
  _topics: Topic[],
  client: Anthropic,
  model: string,
): Promise<ResearchQuestion[]> {
  const claimTexts = surroundingClaims.map((c) => c.text);

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: questionGenerationPrompt(gap.description, claimTexts),
        },
      ],
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";

    const parsed = parseJsonResponse(responseText);
    const questions = validateQuestions(parsed);

    return questions.map((q) => ({
      id: createId<QuestionId>("question"),
      gapId: gap.id,
      question: q.question,
      rationale: q.rationale,
      impact: q.impact,
      feasibility: q.feasibility,
      overallScore: q.impact * 0.6 + q.feasibility * 0.4,
      createdAt: Date.now(),
    }));
  } catch (error) {
    console.warn("Question generation failed:", error);
    return [];
  }
}
