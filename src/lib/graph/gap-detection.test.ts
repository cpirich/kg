import type { Topic, TopicId, TopicRelationship } from "@/types/domain";
import { describe, expect, it } from "vitest";
import { findSparseRegions } from "./gap-detection";

function makeTopic(id: string, claimCount: number): Topic {
  return {
    id: id as TopicId,
    label: `Topic ${id}`,
    normalizedLabel: `topic ${id}`,
    claimCount,
    documentCount: 1,
  };
}

function makeRelationship(
  id: string,
  sourceId: string,
  targetId: string,
): TopicRelationship {
  return {
    id,
    sourceId: sourceId as TopicId,
    targetId: targetId as TopicId,
    type: "related",
    weight: 1,
  };
}

describe("findSparseRegions", () => {
  it("returns empty array for empty input", () => {
    const result = findSparseRegions([], [], new Map());
    expect(result).toEqual([]);
  });

  it("identifies topics with low density and low connectivity", () => {
    const topics: Topic[] = [
      makeTopic("a", 10),
      makeTopic("b", 10),
      makeTopic("c", 1), // low density
      makeTopic("d", 1), // low density
    ];

    const relationships: TopicRelationship[] = [
      makeRelationship("r1", "a", "b"),
      makeRelationship("r2", "a", "c"),
      makeRelationship("r3", "b", "c"),
    ];
    // Topic "d" has no relationships and low density

    const densityMap = new Map<TopicId, number>([
      ["a" as TopicId, 1.0],
      ["b" as TopicId, 1.0],
      ["c" as TopicId, 0.0],
      ["d" as TopicId, 0.0],
    ]);

    const sparse = findSparseRegions(topics, relationships, densityMap);

    // Topic "d" has 0 density and 0 connectivity (both low)
    expect(sparse).toContain("d" as TopicId);
  });

  it("does not flag high-density topics even with low connectivity", () => {
    const topics: Topic[] = [makeTopic("a", 10), makeTopic("b", 2)];

    const relationships: TopicRelationship[] = [];

    const densityMap = new Map<TopicId, number>([
      ["a" as TopicId, 1.0],
      ["b" as TopicId, 0.5],
    ]);

    const sparse = findSparseRegions(topics, relationships, densityMap);

    // Neither should be flagged since density threshold only captures bottom quartile
    // With 2 topics, quartile boundary is index 0; density at index 0 sorted = 0.5
    // Only topics <= 0.5 with connectivity < avg (0) qualify
    // Both have 0 connectivity but "a" has density 1.0 > 0.5
    // "b" has density 0.5 which is <= 0.5 threshold, connectivity 0 < avg 0? No, 0 is not < 0
    expect(sparse).toHaveLength(0);
  });

  it("handles all topics being well-connected", () => {
    const topics: Topic[] = [
      makeTopic("a", 5),
      makeTopic("b", 5),
      makeTopic("c", 5),
    ];

    const relationships: TopicRelationship[] = [
      makeRelationship("r1", "a", "b"),
      makeRelationship("r2", "b", "c"),
      makeRelationship("r3", "a", "c"),
    ];

    const densityMap = new Map<TopicId, number>([
      ["a" as TopicId, 1.0],
      ["b" as TopicId, 1.0],
      ["c" as TopicId, 1.0],
    ]);

    const sparse = findSparseRegions(topics, relationships, densityMap);

    expect(sparse).toHaveLength(0);
  });

  it("identifies multiple sparse topics", () => {
    const topics: Topic[] = [
      makeTopic("a", 20),
      makeTopic("b", 20),
      makeTopic("c", 20),
      makeTopic("d", 1),
      makeTopic("e", 1),
      makeTopic("f", 1),
      makeTopic("g", 1),
      makeTopic("h", 1),
    ];

    // Only a, b, c are well-connected
    const relationships: TopicRelationship[] = [
      makeRelationship("r1", "a", "b"),
      makeRelationship("r2", "b", "c"),
      makeRelationship("r3", "a", "c"),
      makeRelationship("r4", "a", "d"),
      makeRelationship("r5", "b", "e"),
    ];

    const densityMap = new Map<TopicId, number>([
      ["a" as TopicId, 1.0],
      ["b" as TopicId, 1.0],
      ["c" as TopicId, 1.0],
      ["d" as TopicId, 0.0],
      ["e" as TopicId, 0.0],
      ["f" as TopicId, 0.0],
      ["g" as TopicId, 0.0],
      ["h" as TopicId, 0.0],
    ]);

    const sparse = findSparseRegions(topics, relationships, densityMap);

    // f, g, h have 0 density and 0 connectivity
    expect(sparse).toContain("f" as TopicId);
    expect(sparse).toContain("g" as TopicId);
    expect(sparse).toContain("h" as TopicId);
  });
});
