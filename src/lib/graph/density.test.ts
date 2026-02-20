import type { Topic, TopicId } from "@/types/domain";
import { describe, expect, it } from "vitest";
import { calculateDensity } from "./density";

function makeTopic(id: string, claimCount: number): Topic {
  return {
    id: id as TopicId,
    label: `Topic ${id}`,
    normalizedLabel: `topic ${id}`,
    claimCount,
    documentCount: 1,
  };
}

describe("calculateDensity", () => {
  it("normalizes claim counts to 0-1 range", () => {
    const topics: Topic[] = [
      makeTopic("a", 1),
      makeTopic("b", 5),
      makeTopic("c", 10),
    ];

    const density = calculateDensity(topics);

    expect(density.get("a" as TopicId)).toBeCloseTo(0.0);
    expect(density.get("b" as TopicId)).toBeCloseTo(4 / 9);
    expect(density.get("c" as TopicId)).toBeCloseTo(1.0);
  });

  it("returns 1.0 for all topics when all have equal claim counts", () => {
    const topics: Topic[] = [
      makeTopic("a", 5),
      makeTopic("b", 5),
      makeTopic("c", 5),
    ];

    const density = calculateDensity(topics);

    expect(density.get("a" as TopicId)).toBe(1.0);
    expect(density.get("b" as TopicId)).toBe(1.0);
    expect(density.get("c" as TopicId)).toBe(1.0);
  });

  it("returns empty map for empty topic list", () => {
    const density = calculateDensity([]);
    expect(density.size).toBe(0);
  });

  it("handles single topic (density 1.0)", () => {
    const topics: Topic[] = [makeTopic("a", 3)];
    const density = calculateDensity(topics);
    expect(density.get("a" as TopicId)).toBe(1.0);
  });

  it("handles one dominant topic correctly", () => {
    const topics: Topic[] = [
      makeTopic("a", 1),
      makeTopic("b", 1),
      makeTopic("c", 100),
    ];

    const density = calculateDensity(topics);

    expect(density.get("a" as TopicId)).toBeCloseTo(0.0);
    expect(density.get("b" as TopicId)).toBeCloseTo(0.0);
    expect(density.get("c" as TopicId)).toBeCloseTo(1.0);
  });

  it("handles topics with zero claims", () => {
    const topics: Topic[] = [
      makeTopic("a", 0),
      makeTopic("b", 0),
      makeTopic("c", 10),
    ];

    const density = calculateDensity(topics);

    expect(density.get("a" as TopicId)).toBeCloseTo(0.0);
    expect(density.get("b" as TopicId)).toBeCloseTo(0.0);
    expect(density.get("c" as TopicId)).toBeCloseTo(1.0);
  });

  it("returns a map with entries for every topic", () => {
    const topics: Topic[] = [
      makeTopic("a", 2),
      makeTopic("b", 4),
      makeTopic("c", 6),
      makeTopic("d", 8),
    ];

    const density = calculateDensity(topics);

    expect(density.size).toBe(4);
    for (const topic of topics) {
      expect(density.has(topic.id)).toBe(true);
    }
  });
});
