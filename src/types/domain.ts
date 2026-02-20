// Branded ID types to prevent mixing
type Brand<T, B> = T & { __brand: B };
export type DocumentId = Brand<string, "DocumentId">;
export type ChunkId = Brand<string, "ChunkId">;
export type ClaimId = Brand<string, "ClaimId">;
export type TopicId = Brand<string, "TopicId">;
export type ContradictionId = Brand<string, "ContradictionId">;
export type GapId = Brand<string, "GapId">;
export type QuestionId = Brand<string, "QuestionId">;

// Helper to create branded IDs
export function createId<T>(prefix: string): T {
  return `${prefix}_${crypto.randomUUID()}` as T;
}

// Document status tracking
export type DocumentStatus =
  | "uploading"
  | "extracting"
  | "chunking"
  | "analyzing"
  | "complete"
  | "error";

export interface Document {
  id: DocumentId;
  name: string;
  hash: string; // SHA-256 for dedup
  size: number;
  type: "pdf" | "text";
  status: DocumentStatus;
  progress: number; // 0-100
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TextChunk {
  id: ChunkId;
  documentId: DocumentId;
  content: string;
  startOffset: number;
  endOffset: number;
  chunkIndex: number;
}

export type ClaimType =
  | "finding"
  | "methodology"
  | "claim"
  | "hypothesis"
  | "limitation";

export interface Claim {
  id: ClaimId;
  documentId: DocumentId;
  chunkId: ChunkId;
  text: string;
  type: ClaimType;
  confidence: number; // 0-1
  topicIds: TopicId[];
  createdAt: number;
}

export interface Topic {
  id: TopicId;
  label: string;
  normalizedLabel: string; // lowercase, singular
  claimCount: number;
  documentCount: number;
}

export type RelationshipType =
  | "related"
  | "subtopic"
  | "prerequisite"
  | "contradicts";

export interface TopicRelationship {
  id: string;
  sourceId: TopicId;
  targetId: TopicId;
  type: RelationshipType;
  weight: number; // co-occurrence strength
}

export type ContradictionSeverity = "low" | "medium" | "high";

export interface Contradiction {
  id: ContradictionId;
  claimAId: ClaimId;
  claimBId: ClaimId;
  description: string;
  severity: ContradictionSeverity;
  confidence: number;
  status: "pending" | "confirmed" | "dismissed";
  createdAt: number;
}

export interface KnowledgeGap {
  id: GapId;
  description: string;
  topicIds: TopicId[];
  gapType: "structural" | "density" | "methodological" | "temporal";
  significance: number; // 0-1
  createdAt: number;
}

export interface ResearchQuestion {
  id: QuestionId;
  gapId: GapId;
  question: string;
  rationale: string;
  impact: number; // 1-10
  feasibility: number; // 1-10
  overallScore: number; // impact * 0.6 + feasibility * 0.4
  createdAt: number;
}

export interface AppSettings {
  id: "settings"; // singleton
  apiKey?: string;
  model: string;
  chunkSize: number;
  chunkOverlap: number;
}
