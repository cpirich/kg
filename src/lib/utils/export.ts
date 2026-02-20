import { db } from "@/lib/db/schema";

/**
 * Export all data from the database as a JSON string.
 * Each table is a key with its rows as an array value.
 */
export async function exportAllData(): Promise<string> {
  const [
    documents,
    textChunks,
    claims,
    topics,
    topicRelationships,
    contradictions,
    knowledgeGaps,
    researchQuestions,
    appSettings,
  ] = await Promise.all([
    db.documents.toArray(),
    db.textChunks.toArray(),
    db.claims.toArray(),
    db.topics.toArray(),
    db.topicRelationships.toArray(),
    db.contradictions.toArray(),
    db.knowledgeGaps.toArray(),
    db.researchQuestions.toArray(),
    db.appSettings.toArray(),
  ]);

  return JSON.stringify({
    documents,
    textChunks,
    claims,
    topics,
    topicRelationships,
    contradictions,
    knowledgeGaps,
    researchQuestions,
    appSettings,
  });
}

/**
 * Import data from a JSON string, replacing all existing data.
 * Clears all tables first, then bulk-inserts from the parsed JSON.
 */
export async function importAllData(jsonString: string): Promise<void> {
  const data = JSON.parse(jsonString) as Record<string, unknown[]>;

  await clearAllData();

  await db.transaction(
    "rw",
    [
      db.documents,
      db.textChunks,
      db.claims,
      db.topics,
      db.topicRelationships,
      db.contradictions,
      db.knowledgeGaps,
      db.researchQuestions,
      db.appSettings,
    ],
    async () => {
      if (data.documents?.length)
        await db.documents.bulkPut(data.documents as never[]);
      if (data.textChunks?.length)
        await db.textChunks.bulkPut(data.textChunks as never[]);
      if (data.claims?.length) await db.claims.bulkPut(data.claims as never[]);
      if (data.topics?.length) await db.topics.bulkPut(data.topics as never[]);
      if (data.topicRelationships?.length)
        await db.topicRelationships.bulkPut(data.topicRelationships as never[]);
      if (data.contradictions?.length)
        await db.contradictions.bulkPut(data.contradictions as never[]);
      if (data.knowledgeGaps?.length)
        await db.knowledgeGaps.bulkPut(data.knowledgeGaps as never[]);
      if (data.researchQuestions?.length)
        await db.researchQuestions.bulkPut(data.researchQuestions as never[]);
      if (data.appSettings?.length)
        await db.appSettings.bulkPut(data.appSettings as never[]);
    },
  );
}

/**
 * Delete all records from all tables.
 * Keeps the database and schema intact — only clears data.
 */
export async function clearAllData(): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.documents,
      db.textChunks,
      db.claims,
      db.topics,
      db.topicRelationships,
      db.contradictions,
      db.knowledgeGaps,
      db.researchQuestions,
      db.appSettings,
    ],
    async () => {
      await db.documents.clear();
      await db.textChunks.clear();
      await db.claims.clear();
      await db.topics.clear();
      await db.topicRelationships.clear();
      await db.contradictions.clear();
      await db.knowledgeGaps.clear();
      await db.researchQuestions.clear();
      await db.appSettings.clear();
    },
  );
}
