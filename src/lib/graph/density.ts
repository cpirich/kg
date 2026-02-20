import type { Topic, TopicId } from "@/types/domain";

/**
 * Calculate normalized research density for each topic.
 * Normalizes claim counts across all topics to a 0-1 range.
 * Topics with the most claims = 1.0, fewest = 0.0.
 * If all topics have equal claim counts, all densities are 1.0.
 * Returns an empty map for an empty topic list.
 */
export function calculateDensity(topics: Topic[]): Map<TopicId, number> {
  const densityMap = new Map<TopicId, number>();

  if (topics.length === 0) {
    return densityMap;
  }

  const counts = topics.map((t) => t.claimCount);
  const maxCount = Math.max(...counts);
  const minCount = Math.min(...counts);
  const range = maxCount - minCount;

  for (const topic of topics) {
    if (range === 0) {
      // All topics have the same claim count
      densityMap.set(topic.id, 1.0);
    } else {
      densityMap.set(topic.id, (topic.claimCount - minCount) / range);
    }
  }

  return densityMap;
}
