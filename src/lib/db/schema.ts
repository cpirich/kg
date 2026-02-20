import type {
  AppSettings,
  Claim,
  Contradiction,
  Document,
  KnowledgeGap,
  ResearchQuestion,
  TextChunk,
  Topic,
  TopicRelationship,
} from "@/types/domain";
import Dexie, { type EntityTable } from "dexie";

export class KnowledgeGapDB extends Dexie {
  documents!: EntityTable<Document, "id">;
  textChunks!: EntityTable<TextChunk, "id">;
  claims!: EntityTable<Claim, "id">;
  topics!: EntityTable<Topic, "id">;
  topicRelationships!: EntityTable<TopicRelationship, "id">;
  contradictions!: EntityTable<Contradiction, "id">;
  knowledgeGaps!: EntityTable<KnowledgeGap, "id">;
  researchQuestions!: EntityTable<ResearchQuestion, "id">;
  appSettings!: EntityTable<AppSettings, "id">;

  constructor() {
    super("KnowledgeGapDB");
    this.version(1).stores({
      documents: "id, hash, status, createdAt",
      textChunks: "id, documentId, chunkIndex",
      claims: "id, documentId, chunkId, type, *topicIds",
      topics: "id, normalizedLabel, claimCount",
      topicRelationships: "id, sourceId, targetId, type",
      contradictions: "id, claimAId, claimBId, status, severity",
      knowledgeGaps: "id, gapType, significance",
      researchQuestions: "id, gapId, overallScore",
      appSettings: "id",
    });
  }
}

export const db = new KnowledgeGapDB();

/** Ensure the singleton settings row exists with defaults. */
export async function ensureSettings(): Promise<AppSettings> {
  const existing = await db.appSettings.get("settings");
  if (existing) return existing;

  const defaults: AppSettings = {
    id: "settings",
    model: "claude-sonnet-4-20250514",
    chunkSize: 1500,
    chunkOverlap: 200,
  };
  await db.appSettings.put(defaults);
  return defaults;
}
