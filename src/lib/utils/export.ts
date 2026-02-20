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

  // Redact API keys from appSettings to prevent accidental leakage
  const redactedAppSettings = appSettings.map((setting) => {
    if ("apiKey" in setting) {
      return { ...setting, apiKey: undefined };
    }
    return setting;
  });

  return JSON.stringify({
    documents,
    textChunks,
    claims,
    topics,
    topicRelationships,
    contradictions,
    knowledgeGaps,
    researchQuestions,
    appSettings: redactedAppSettings,
  });
}

const EXPECTED_TABLES = [
  "documents",
  "textChunks",
  "claims",
  "topics",
  "topicRelationships",
  "contradictions",
  "knowledgeGaps",
  "researchQuestions",
  "appSettings",
] as const;

/**
 * Import data from a JSON string, replacing all existing data.
 * Clears all tables first, then bulk-inserts from the parsed JSON.
 * Validates the structural integrity of the imported data before processing.
 */
export async function importAllData(jsonString: string): Promise<void> {
  const parsed: unknown = JSON.parse(jsonString);

  // Validate that the parsed result is an object
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      "Invalid import data: expected a JSON object with table names as keys.",
    );
  }

  const data = parsed as Record<string, unknown>;

  // Validate that it contains at least some expected table names
  const presentTables = EXPECTED_TABLES.filter((table) => table in data);
  if (presentTables.length === 0) {
    throw new Error(
      `Invalid import data: expected at least one of the following tables: ${EXPECTED_TABLES.join(", ")}.`,
    );
  }

  // Validate that each present table value is an array
  for (const table of presentTables) {
    if (!Array.isArray(data[table])) {
      throw new Error(
        `Invalid import data: table "${table}" must be an array, got ${typeof data[table]}.`,
      );
    }
  }

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
      const d = data as Record<string, unknown[]>;
      if (d.documents?.length)
        await db.documents.bulkPut(d.documents as never[]);
      if (d.textChunks?.length)
        await db.textChunks.bulkPut(d.textChunks as never[]);
      if (d.claims?.length) await db.claims.bulkPut(d.claims as never[]);
      if (d.topics?.length) await db.topics.bulkPut(d.topics as never[]);
      if (d.topicRelationships?.length)
        await db.topicRelationships.bulkPut(d.topicRelationships as never[]);
      if (d.contradictions?.length)
        await db.contradictions.bulkPut(d.contradictions as never[]);
      if (d.knowledgeGaps?.length)
        await db.knowledgeGaps.bulkPut(d.knowledgeGaps as never[]);
      if (d.researchQuestions?.length)
        await db.researchQuestions.bulkPut(d.researchQuestions as never[]);
      if (d.appSettings?.length)
        await db.appSettings.bulkPut(d.appSettings as never[]);
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
