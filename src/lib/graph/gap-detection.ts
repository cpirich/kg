import type { Topic, TopicId, TopicRelationship } from "@/types/domain";

/**
 * Find sparse regions in the knowledge graph — topic clusters where
 * density is below threshold and connectivity is low.
 *
 * A topic is considered "sparse" if:
 * 1. Its density is in the bottom quartile (below 25th percentile), AND
 * 2. Its connectivity (number of relationships) is below the average connectivity.
 *
 * Returns an array of TopicIds that are in sparse regions.
 */
export function findSparseRegions(
  topics: Topic[],
  relationships: TopicRelationship[],
  densityMap: Map<TopicId, number>,
): TopicId[] {
  if (topics.length === 0) {
    return [];
  }

  // Calculate connectivity for each topic (number of relationships it participates in)
  const connectivityMap = new Map<TopicId, number>();
  for (const topic of topics) {
    connectivityMap.set(topic.id, 0);
  }
  for (const rel of relationships) {
    connectivityMap.set(
      rel.sourceId,
      (connectivityMap.get(rel.sourceId) ?? 0) + 1,
    );
    connectivityMap.set(
      rel.targetId,
      (connectivityMap.get(rel.targetId) ?? 0) + 1,
    );
  }

  // Calculate thresholds
  const densityValues = topics
    .map((t) => densityMap.get(t.id) ?? 0)
    .sort((a, b) => a - b);
  const densityThreshold = densityValues[Math.floor(densityValues.length / 4)];

  const connectivityValues = topics.map((t) => connectivityMap.get(t.id) ?? 0);
  const avgConnectivity =
    connectivityValues.reduce((sum, v) => sum + v, 0) /
    connectivityValues.length;

  // Find sparse topics
  const sparseTopics: TopicId[] = [];
  for (const topic of topics) {
    const density = densityMap.get(topic.id) ?? 0;
    const connectivity = connectivityMap.get(topic.id) ?? 0;

    if (density <= densityThreshold && connectivity < avgConnectivity) {
      sparseTopics.push(topic.id);
    }
  }

  return sparseTopics;
}
