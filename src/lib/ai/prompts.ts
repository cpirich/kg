/**
 * Prompt for extracting claims from a text chunk of an academic paper.
 */
export function claimExtractionPrompt(chunkText: string): string {
  return `You are an expert academic researcher analyzing a passage from a scientific paper. Extract all distinct claims, findings, methodologies, hypotheses, and limitations from the text below.

For each item, provide:
- "text": The claim or finding stated clearly and concisely (1-2 sentences).
- "type": One of "finding", "methodology", "claim", "hypothesis", or "limitation".
- "confidence": A number from 0 to 1 indicating how clearly the claim is stated (1 = explicitly stated, 0.5 = implied, <0.5 = very uncertain).
- "topics": An array of 1-4 topic labels that this claim relates to (use short, specific noun phrases like "neural networks", "gene expression", "sample size").

Return ONLY a valid JSON object in this exact format:
{
  "claims": [
    {
      "text": "...",
      "type": "finding",
      "confidence": 0.9,
      "topics": ["topic1", "topic2"]
    }
  ]
}

If the text contains no extractable claims, return: {"claims": []}

TEXT:
${chunkText}`;
}

/**
 * Prompt for checking whether two claims contradict each other.
 */
export function contradictionCheckPrompt(
  claimA: string,
  claimB: string,
): string {
  return `You are an expert at identifying contradictions in academic literature. Analyze whether these two claims contradict each other.

CLAIM A: ${claimA}

CLAIM B: ${claimB}

Determine if these claims are contradictory (not merely different — they must make incompatible assertions about the same topic).

Return ONLY a valid JSON object:
{
  "isContradiction": true/false,
  "description": "Brief explanation of the contradiction or why they are not contradictory",
  "severity": "low" | "medium" | "high",
  "confidence": 0.0 to 1.0
}

Severity guide:
- "low": Minor disagreement on details or magnitude
- "medium": Conflicting conclusions from similar approaches
- "high": Directly opposing claims on the same phenomenon`;
}

/**
 * Prompt for AI-enhanced gap analysis given a set of topics and their claims.
 */
export function gapAnalysisPrompt(
  topicsWithClaims: Array<{ topic: string; claims: string[] }>,
): string {
  const topicSummary = topicsWithClaims
    .map(
      ({ topic, claims }) =>
        `Topic: ${topic}\nClaims:\n${claims.map((c) => `  - ${c}`).join("\n")}`,
    )
    .join("\n\n");

  return `You are an expert research strategist identifying gaps in the current body of knowledge. Analyze the following topics and their associated claims from academic papers.

${topicSummary}

Identify knowledge gaps — areas where research is missing, incomplete, or methodologically limited. Focus on:
1. Methodological gaps: Important approaches not yet applied to a topic
2. Temporal gaps: Topics lacking recent or longitudinal studies
3. Structural gaps: Disconnected topics that should be studied together
4. Density gaps: Topics with surprisingly few claims relative to their importance

Return ONLY a valid JSON object:
{
  "gaps": [
    {
      "description": "Clear description of the knowledge gap",
      "topicLabels": ["related topic 1", "related topic 2"],
      "gapType": "methodological" | "temporal" | "structural" | "density",
      "significance": 0.0 to 1.0
    }
  ]
}`;
}

/**
 * Prompt for generating research questions from an identified knowledge gap.
 */
export function questionGenerationPrompt(
  gapDescription: string,
  relatedClaims: string[],
): string {
  const claimsList = relatedClaims.map((c) => `- ${c}`).join("\n");

  return `You are an expert research advisor generating high-quality research questions. Based on the identified knowledge gap and related existing claims, generate 3-5 research questions that would address this gap.

KNOWLEDGE GAP: ${gapDescription}

RELATED EXISTING CLAIMS:
${claimsList}

For each question provide:
- "question": A clear, specific, and testable research question
- "rationale": Why this question is important and how it addresses the gap (1-2 sentences)
- "impact": Score from 1-10 (10 = transformative if answered)
- "feasibility": Score from 1-10 (10 = easily achievable with current methods)

Return ONLY a valid JSON object:
{
  "questions": [
    {
      "question": "...",
      "rationale": "...",
      "impact": 8,
      "feasibility": 6
    }
  ]
}`;
}
