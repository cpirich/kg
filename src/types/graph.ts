import type { TopicId } from "./domain";

export interface GraphNode {
  data: {
    id: string;
    label: string;
    topicId: TopicId;
    claimCount: number;
    documentCount: number;
    density: number; // normalized 0-1
    isGapAdjacent: boolean;
  };
}

export interface GraphEdge {
  data: {
    id: string;
    source: string;
    target: string;
    type: string;
    weight: number;
  };
}

export type GraphElement = GraphNode | GraphEdge;
