import type { GapAnalysisResult } from "@/types/ai";
import type {
  Claim,
  GapId,
  KnowledgeGap,
  Topic,
  TopicId,
  TopicRelationship,
} from "@/types/domain";
import { createId } from "@/types/domain";
import type Anthropic from "@anthropic-ai/sdk";
import { gapAnalysisPrompt } from "./prompts";
import { parseJsonResponse } from "./utils";

/**
 * Validate and normalize gap analysis results from AI.
 */
function validateGapResult(data: unknown): GapAnalysisResult {
  if (
    !data ||
    typeof data !== "object" ||
    !("gaps" in data) ||
    !Array.isArray((data as { gaps: unknown }).gaps)
  ) {
    return { gaps: [] };
  }

  const raw = data as { gaps: Array<Record<string, unknown>> };
  const validGapTypes = [
    "methodological",
    "temporal",
    "structural",
    "density",
  ] as const;

  const gaps = raw.gaps
    .filter(
      (g) =>
        typeof g.description === "string" &&
        Array.isArray(g.topicLabels) &&
        typeof g.gapType === "string" &&
        typeof g.significance === "number",
    )
    .map((g) => ({
      description: g.description as string,
      topicLabels: (g.topicLabels as unknown[]).filter(
        (t): t is string => typeof t === "string",
      ),
      gapType: validGapTypes.includes(
        g.gapType as (typeof validGapTypes)[number],
      )
        ? (g.gapType as GapAnalysisResult["gaps"][number]["gapType"])
        : ("structural" as const),
      significance: Math.max(0, Math.min(1, g.significance as number)),
    }));

  return { gaps };
}

/**
 * Find structural gaps — high-degree topics that lack mutual edges.
 * A structural gap exists when two high-degree topics (above median degree)
 * are not connected by any relationship.
 */
export function findStructuralGaps(
  topics: Topic[],
  relationships: TopicRelationship[],
): KnowledgeGap[] {
  if (topics.length < 2) {
    return [];
  }

  // Calculate degree (number of relationships) for each topic
  const degreeMap = new Map<TopicId, number>();
  for (const topic of topics) {
    degreeMap.set(topic.id, 0);
  }
  for (const rel of relationships) {
    degreeMap.set(rel.sourceId, (degreeMap.get(rel.sourceId) ?? 0) + 1);
    degreeMap.set(rel.targetId, (degreeMap.get(rel.targetId) ?? 0) + 1);
  }

  // Find high-degree topics (above median)
  const degrees = topics
    .map((t) => degreeMap.get(t.id) ?? 0)
    .sort((a, b) => a - b);
  const medianDegree = degrees[Math.floor(degrees.length / 2)];

  const highDegreeTopics = topics.filter(
    (t) => (degreeMap.get(t.id) ?? 0) > medianDegree,
  );

  // Build adjacency set for quick lookup
  const adjacencySet = new Set<string>();
  for (const rel of relationships) {
    adjacencySet.add(`${rel.sourceId}:${rel.targetId}`);
    adjacencySet.add(`${rel.targetId}:${rel.sourceId}`);
  }

  // Find pairs of high-degree topics that are not connected
  const gaps: KnowledgeGap[] = [];
  for (let i = 0; i < highDegreeTopics.length; i++) {
    for (let j = i + 1; j < highDegreeTopics.length; j++) {
      const topicA = highDegreeTopics[i];
      const topicB = highDegreeTopics[j];

      const key = `${topicA.id}:${topicB.id}`;
      if (!adjacencySet.has(key)) {
        gaps.push({
          id: createId<GapId>("gap"),
          description: `Structural gap: "${topicA.label}" and "${topicB.label}" are both well-studied topics but lack a direct relationship in the literature.`,
          topicIds: [topicA.id, topicB.id],
          gapType: "structural",
          significance:
            0.5 +
            0.5 *
              Math.min(
                1,
                ((degreeMap.get(topicA.id) ?? 0) +
                  (degreeMap.get(topicB.id) ?? 0)) /
                  (topics.length * 2),
              ),
          createdAt: Date.now(),
        });
      }
    }
  }

  // Return only the top 20 most significant structural gaps
  return gaps.sort((a, b) => b.significance - a.significance).slice(0, 20);
}

/**
 * Find density gaps — topics with claim count far below the average.
 * A density gap is identified when a topic's claim count is less than
 * half the average claim count across all topics.
 */
export function findDensityGaps(topics: Topic[]): KnowledgeGap[] {
  if (topics.length === 0) {
    return [];
  }

  const totalClaims = topics.reduce((sum, t) => sum + t.claimCount, 0);
  const avgClaims = totalClaims / topics.length;

  // Skip if average is too low to be meaningful
  if (avgClaims < 1) {
    return [];
  }

  const threshold = avgClaims * 0.5;

  const gaps: KnowledgeGap[] = [];
  for (const topic of topics) {
    if (topic.claimCount < threshold) {
      const ratio = topic.claimCount / avgClaims;
      gaps.push({
        id: createId<GapId>("gap"),
        description: `Density gap: "${topic.label}" has only ${topic.claimCount} claim(s), significantly below the average of ${avgClaims.toFixed(1)} claims per topic.`,
        topicIds: [topic.id],
        gapType: "density",
        significance: Math.max(0, Math.min(1, 1 - ratio)),
        createdAt: Date.now(),
      });
    }
  }

  // Return only the top 20 most significant density gaps
  return gaps.sort((a, b) => b.significance - a.significance).slice(0, 20);
}

/**
 * Find AI-enhanced gaps using Claude to identify domain-aware gaps.
 * Sends topics and their claims to the AI for analysis.
 */
export async function findAIGaps(
  topics: Topic[],
  claims: Claim[],
  client: Anthropic,
  model: string,
): Promise<KnowledgeGap[]> {
  if (topics.length === 0) {
    return [];
  }

  // Build topic-to-claims mapping
  const topicClaimsMap = new Map<TopicId, string[]>();
  for (const topic of topics) {
    topicClaimsMap.set(topic.id, []);
  }
  for (const claim of claims) {
    for (const topicId of claim.topicIds) {
      const existing = topicClaimsMap.get(topicId);
      if (existing) {
        existing.push(claim.text);
      }
    }
  }

  // Build prompt input
  const topicsWithClaims = topics.map((t) => ({
    topic: t.label,
    claims: topicClaimsMap.get(t.id) ?? [],
  }));

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: gapAnalysisPrompt(topicsWithClaims),
        },
      ],
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";

    const parsed = parseJsonResponse(responseText);
    const result = validateGapResult(parsed);

    // Build label-to-topic lookup for matching AI-returned labels to TopicIds
    const labelToTopic = new Map<string, Topic>();
    for (const topic of topics) {
      labelToTopic.set(topic.label.toLowerCase(), topic);
      labelToTopic.set(topic.normalizedLabel, topic);
    }

    // Convert AI results to KnowledgeGap objects
    return result.gaps.map((gap) => {
      const matchedTopicIds: TopicId[] = [];
      for (const label of gap.topicLabels) {
        const matched = labelToTopic.get(label.toLowerCase());
        if (matched) {
          matchedTopicIds.push(matched.id);
        }
      }

      return {
        id: createId<GapId>("gap"),
        description: gap.description,
        topicIds: matchedTopicIds,
        gapType: gap.gapType,
        significance: gap.significance,
        createdAt: Date.now(),
      };
    });
  } catch (error) {
    console.warn("AI gap analysis failed:", error);
    return [];
  }
}

/**
 * Run the full gap analysis pipeline combining all three approaches:
 * 1. Structural gaps (missing edges between high-degree topics)
 * 2. Density gaps (topics with below-average claim counts)
 * 3. AI-enhanced gaps (domain-aware gap identification)
 */
export async function analyzeGaps(
  topics: Topic[],
  relationships: TopicRelationship[],
  claims: Claim[],
  client: Anthropic,
  model: string,
): Promise<KnowledgeGap[]> {
  // Run structural and density analysis synchronously
  const structuralGaps = findStructuralGaps(topics, relationships);
  const densityGaps = findDensityGaps(topics);

  // Run AI analysis
  const aiGaps = await findAIGaps(topics, claims, client, model);

  return [...structuralGaps, ...densityGaps, ...aiGaps];
}
