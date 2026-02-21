import type { KnowledgeGap, Topic, TopicRelationship } from "@/types/domain";
import type { GraphEdge, GraphElement, GraphNode } from "@/types/graph";
import { calculateDensity } from "./density";

/**
 * Build Cytoscape.js graph elements from topics, relationships, and gaps.
 *
 * - Topics become nodes with size proportional to claim count.
 * - TopicRelationships become edges with width proportional to weight.
 * - Nodes adjacent to knowledge gaps are flagged with isGapAdjacent.
 */
export function buildGraphElements(
  topics: Topic[],
  relationships: TopicRelationship[],
  gaps: KnowledgeGap[],
): GraphElement[] {
  const elements: GraphElement[] = [];

  // Calculate density for all topics
  const densityMap = calculateDensity(topics);

  // Collect all topic IDs that are adjacent to gaps
  const gapAdjacentTopicIds = new Set<string>();
  for (const gap of gaps) {
    for (const topicId of gap.topicIds) {
      gapAdjacentTopicIds.add(topicId);
    }
  }

  // Build nodes from topics
  for (const topic of topics) {
    const node: GraphNode = {
      data: {
        id: topic.id,
        label: topic.label,
        topicId: topic.id,
        claimCount: topic.claimCount,
        documentCount: topic.documentCount,
        density: densityMap.get(topic.id) ?? 0,
        isGapAdjacent: gapAdjacentTopicIds.has(topic.id),
      },
    };
    elements.push(node);
  }

  // Build edges from relationships
  for (const rel of relationships) {
    const edge: GraphEdge = {
      data: {
        id: rel.id,
        source: rel.sourceId,
        target: rel.targetId,
        type: rel.type,
        weight: rel.weight,
      },
    };
    elements.push(edge);
  }

  return elements;
}
