import { calculateDensity } from "@/lib/graph/density";
import type { Topic, TopicId, TopicRelationship } from "@/types/domain";
import { createId } from "@/types/domain";
import type { GraphEdge, GraphElement, GraphNode } from "@/types/graph";
import { describe, expect, it } from "vitest";

/**
 * Build graph nodes from topics and a density map.
 * Gap-adjacent nodes are flagged if their topic ID appears in the gapTopicIds set.
 */
function buildGraphNodes(
  topics: Topic[],
  densityMap: Map<TopicId, number>,
  gapTopicIds: Set<TopicId>,
): GraphNode[] {
  return topics.map((topic) => ({
    data: {
      id: topic.id,
      label: topic.label,
      topicId: topic.id,
      claimCount: topic.claimCount,
      documentCount: topic.documentCount,
      density: densityMap.get(topic.id) ?? 0,
      isGapAdjacent: gapTopicIds.has(topic.id),
    },
  }));
}

/**
 * Build graph edges from topic relationships.
 */
function buildGraphEdges(relationships: TopicRelationship[]): GraphEdge[] {
  return relationships.map((rel) => ({
    data: {
      id: rel.id,
      source: rel.sourceId,
      target: rel.targetId,
      type: rel.type,
      weight: rel.weight,
    },
  }));
}

/**
 * Build the full graph from topics, relationships, density, and gap info.
 */
function buildGraph(
  topics: Topic[],
  relationships: TopicRelationship[],
  densityMap: Map<TopicId, number>,
  gapTopicIds: Set<TopicId>,
): GraphElement[] {
  const nodes = buildGraphNodes(topics, densityMap, gapTopicIds);
  const edges = buildGraphEdges(relationships);
  return [...nodes, ...edges];
}

function makeTopic(
  label: string,
  claimCount: number,
  documentCount = 1,
): Topic {
  return {
    id: createId<TopicId>("topic"),
    label,
    normalizedLabel: label.toLowerCase(),
    claimCount,
    documentCount,
  };
}

function makeRelationship(
  sourceId: TopicId,
  targetId: TopicId,
  type: TopicRelationship["type"] = "related",
  weight = 1.0,
): TopicRelationship {
  return {
    id: `rel_${crypto.randomUUID()}`,
    sourceId,
    targetId,
    type,
    weight,
  };
}

describe("graph construction: nodes", () => {
  it("maps topics to graph nodes with correct data", () => {
    const topicA = makeTopic("Neural Networks", 10, 3);
    const topicB = makeTopic("Image Classification", 5, 2);
    const topics = [topicA, topicB];

    const densityMap = calculateDensity(topics);
    const gapTopicIds = new Set<TopicId>();

    const nodes = buildGraphNodes(topics, densityMap, gapTopicIds);

    expect(nodes).toHaveLength(2);

    const nodeA = nodes.find((n) => n.data.topicId === topicA.id);
    expect(nodeA).toBeDefined();
    expect(nodeA?.data.label).toBe("Neural Networks");
    expect(nodeA?.data.claimCount).toBe(10);
    expect(nodeA?.data.documentCount).toBe(3);
    expect(nodeA?.data.density).toBe(1.0); // highest claim count
    expect(nodeA?.data.isGapAdjacent).toBe(false);

    const nodeB = nodes.find((n) => n.data.topicId === topicB.id);
    expect(nodeB).toBeDefined();
    expect(nodeB?.data.label).toBe("Image Classification");
    expect(nodeB?.data.claimCount).toBe(5);
    expect(nodeB?.data.density).toBe(0); // lowest claim count
  });

  it("flags gap-adjacent nodes correctly", () => {
    const topicA = makeTopic("Topic A", 5);
    const topicB = makeTopic("Topic B", 5);
    const topics = [topicA, topicB];

    const densityMap = calculateDensity(topics);
    const gapTopicIds = new Set<TopicId>([topicA.id]);

    const nodes = buildGraphNodes(topics, densityMap, gapTopicIds);

    const nodeA = nodes.find((n) => n.data.topicId === topicA.id);
    const nodeB = nodes.find((n) => n.data.topicId === topicB.id);

    expect(nodeA?.data.isGapAdjacent).toBe(true);
    expect(nodeB?.data.isGapAdjacent).toBe(false);
  });
});

describe("graph construction: edges", () => {
  it("maps relationships to graph edges", () => {
    const topicA = makeTopic("A", 5);
    const topicB = makeTopic("B", 5);

    const rel = makeRelationship(topicA.id, topicB.id, "related", 0.75);
    const edges = buildGraphEdges([rel]);

    expect(edges).toHaveLength(1);
    expect(edges[0].data.source).toBe(topicA.id);
    expect(edges[0].data.target).toBe(topicB.id);
    expect(edges[0].data.type).toBe("related");
    expect(edges[0].data.weight).toBe(0.75);
  });

  it("handles multiple edge types", () => {
    const topicA = makeTopic("A", 5);
    const topicB = makeTopic("B", 5);
    const topicC = makeTopic("C", 5);

    const rels = [
      makeRelationship(topicA.id, topicB.id, "related", 1.0),
      makeRelationship(topicA.id, topicC.id, "subtopic", 0.5),
      makeRelationship(topicB.id, topicC.id, "contradicts", 0.8),
    ];

    const edges = buildGraphEdges(rels);
    expect(edges).toHaveLength(3);

    const types = edges.map((e) => e.data.type);
    expect(types).toContain("related");
    expect(types).toContain("subtopic");
    expect(types).toContain("contradicts");
  });
});

describe("graph construction: full graph", () => {
  it("combines nodes and edges into a single elements array", () => {
    const topicA = makeTopic("Neural Networks", 10, 3);
    const topicB = makeTopic("Deep Learning", 8, 2);
    const rel = makeRelationship(topicA.id, topicB.id);

    const densityMap = calculateDensity([topicA, topicB]);
    const gapTopicIds = new Set<TopicId>([topicB.id]);

    const elements = buildGraph(
      [topicA, topicB],
      [rel],
      densityMap,
      gapTopicIds,
    );

    // 2 nodes + 1 edge
    expect(elements).toHaveLength(3);

    // Check that we can distinguish nodes from edges
    const nodes = elements.filter((el): el is GraphNode => "label" in el.data);
    const edges = elements.filter((el): el is GraphEdge => "source" in el.data);

    expect(nodes).toHaveLength(2);
    expect(edges).toHaveLength(1);
  });

  it("produces empty graph for empty input", () => {
    const densityMap = new Map<TopicId, number>();
    const gapTopicIds = new Set<TopicId>();

    const elements = buildGraph([], [], densityMap, gapTopicIds);

    expect(elements).toHaveLength(0);
  });

  it("handles topics with no relationships", () => {
    const topicA = makeTopic("Isolated Topic A", 3);
    const topicB = makeTopic("Isolated Topic B", 7);

    const densityMap = calculateDensity([topicA, topicB]);
    const gapTopicIds = new Set<TopicId>();

    const elements = buildGraph([topicA, topicB], [], densityMap, gapTopicIds);

    // Only nodes, no edges
    expect(elements).toHaveLength(2);
  });
});
