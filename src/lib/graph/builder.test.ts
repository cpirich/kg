import type {
  GapId,
  KnowledgeGap,
  Topic,
  TopicId,
  TopicRelationship,
} from "@/types/domain";
import type { GraphEdge, GraphNode } from "@/types/graph";
import { describe, expect, it } from "vitest";
import { buildGraphElements } from "./builder";

function makeTopic(
  id: string,
  label: string,
  claimCount: number,
  documentCount = 1,
): Topic {
  return {
    id: id as TopicId,
    label,
    normalizedLabel: label.toLowerCase(),
    claimCount,
    documentCount,
  };
}

function makeRelationship(
  id: string,
  sourceId: string,
  targetId: string,
  weight = 1,
): TopicRelationship {
  return {
    id,
    sourceId: sourceId as TopicId,
    targetId: targetId as TopicId,
    type: "related",
    weight,
  };
}

function makeGap(id: string, topicIds: string[]): KnowledgeGap {
  return {
    id: id as GapId,
    description: `Gap ${id}`,
    topicIds: topicIds as TopicId[],
    gapType: "structural",
    significance: 0.8,
    createdAt: Date.now(),
  };
}

function isNode(el: { data: { id: string } }): el is GraphNode {
  return "label" in el.data;
}

function isEdge(el: { data: { id: string } }): el is GraphEdge {
  return "source" in el.data;
}

describe("buildGraphElements", () => {
  it("creates nodes from topics", () => {
    const topics = [
      makeTopic("t1", "Neural Networks", 5, 2),
      makeTopic("t2", "Machine Learning", 3, 1),
    ];

    const elements = buildGraphElements(topics, [], []);
    const nodes = elements.filter(isNode);

    expect(nodes).toHaveLength(2);
    expect(nodes[0].data.id).toBe("t1");
    expect(nodes[0].data.label).toBe("Neural Networks");
    expect(nodes[0].data.topicId).toBe("t1");
    expect(nodes[0].data.claimCount).toBe(5);
    expect(nodes[0].data.documentCount).toBe(2);
  });

  it("creates edges from relationships", () => {
    const topics = [makeTopic("t1", "A", 1), makeTopic("t2", "B", 1)];
    const relationships = [makeRelationship("r1", "t1", "t2", 3)];

    const elements = buildGraphElements(topics, relationships, []);
    const edges = elements.filter(isEdge);

    expect(edges).toHaveLength(1);
    expect(edges[0].data.source).toBe("t1");
    expect(edges[0].data.target).toBe("t2");
    expect(edges[0].data.weight).toBe(3);
    expect(edges[0].data.type).toBe("related");
  });

  it("flags gap-adjacent nodes correctly", () => {
    const topics = [
      makeTopic("t1", "A", 5),
      makeTopic("t2", "B", 3),
      makeTopic("t3", "C", 1),
    ];
    const gaps = [makeGap("g1", ["t1", "t3"])];

    const elements = buildGraphElements(topics, [], gaps);
    const nodes = elements.filter(isNode);

    const nodeMap = new Map(nodes.map((n) => [n.data.id, n]));

    expect(nodeMap.get("t1")?.data.isGapAdjacent).toBe(true);
    expect(nodeMap.get("t2")?.data.isGapAdjacent).toBe(false);
    expect(nodeMap.get("t3")?.data.isGapAdjacent).toBe(true);
  });

  it("calculates density values for nodes", () => {
    const topics = [
      makeTopic("t1", "A", 1),
      makeTopic("t2", "B", 5),
      makeTopic("t3", "C", 10),
    ];

    const elements = buildGraphElements(topics, [], []);
    const nodes = elements.filter(isNode);

    const nodeMap = new Map(nodes.map((n) => [n.data.id, n]));

    expect(nodeMap.get("t1")?.data.density).toBeCloseTo(0.0);
    expect(nodeMap.get("t2")?.data.density).toBeCloseTo(4 / 9);
    expect(nodeMap.get("t3")?.data.density).toBeCloseTo(1.0);
  });

  it("returns empty array for empty inputs", () => {
    const elements = buildGraphElements([], [], []);
    expect(elements).toHaveLength(0);
  });

  it("handles topics with no relationships or gaps", () => {
    const topics = [makeTopic("t1", "Standalone", 2)];

    const elements = buildGraphElements(topics, [], []);

    expect(elements).toHaveLength(1);
    const node = elements[0] as GraphNode;
    expect(node.data.isGapAdjacent).toBe(false);
    expect(node.data.density).toBe(1.0); // Single topic = max density
  });

  it("includes the correct total number of elements", () => {
    const topics = [
      makeTopic("t1", "A", 1),
      makeTopic("t2", "B", 2),
      makeTopic("t3", "C", 3),
    ];
    const relationships = [
      makeRelationship("r1", "t1", "t2"),
      makeRelationship("r2", "t2", "t3"),
    ];
    const gaps = [makeGap("g1", ["t1"])];

    const elements = buildGraphElements(topics, relationships, gaps);

    // 3 nodes + 2 edges = 5 elements
    expect(elements).toHaveLength(5);
    expect(elements.filter(isNode)).toHaveLength(3);
    expect(elements.filter(isEdge)).toHaveLength(2);
  });
});
