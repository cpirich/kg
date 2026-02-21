import type { ChunkId, DocumentId, TextChunk } from "@/types/domain";
import { createId } from "@/types/domain";

export interface ChunkerOptions {
  chunkSize: number;
  chunkOverlap: number;
}

const DEFAULT_OPTIONS: ChunkerOptions = {
  chunkSize: 1500,
  chunkOverlap: 200,
};

/**
 * Find the best break point near `target` within `text`,
 * searching backwards from `target`. Prefers:
 *   1. Paragraph boundary (double newline)
 *   2. Sentence boundary (period/question/exclamation + space)
 *   3. Word boundary (space)
 *   4. Falls back to exact target position
 */
function findBreakPoint(text: string, target: number): number {
  if (target >= text.length) return text.length;

  // Search window: look back up to 200 chars from the target
  const searchStart = Math.max(0, target - 200);
  const searchRegion = text.slice(searchStart, target);

  // 1. Paragraph boundary (double newline)
  const paraIndex = searchRegion.lastIndexOf("\n\n");
  if (paraIndex !== -1) {
    return searchStart + paraIndex + 2; // after the double newline
  }

  // 2. Sentence boundary (. or ? or ! followed by space or newline)
  // Use [\s\S] instead of the 's' flag for ES2017 compatibility
  const sentenceMatch = searchRegion.match(/[\s\S]*[.!?][\s]/);
  if (sentenceMatch) {
    return searchStart + sentenceMatch[0].length;
  }

  // 3. Word boundary (last space)
  const spaceIndex = searchRegion.lastIndexOf(" ");
  if (spaceIndex !== -1) {
    return searchStart + spaceIndex + 1; // after the space
  }

  // 4. Fall back to exact target
  return target;
}

/**
 * Split text into overlapping chunks using a sliding window approach.
 * Prefers breaking at paragraph, sentence, then word boundaries.
 */
export function chunkText(
  text: string,
  documentId: DocumentId,
  options: Partial<ChunkerOptions> = {},
): TextChunk[] {
  const { chunkSize, chunkOverlap } = { ...DEFAULT_OPTIONS, ...options };
  const chunks: TextChunk[] = [];

  if (!text || text.trim().length === 0) {
    return chunks;
  }

  let startOffset = 0;
  let chunkIndex = 0;

  while (startOffset < text.length) {
    // Calculate the raw end position
    const rawEnd = startOffset + chunkSize;

    let endOffset: number;
    if (rawEnd >= text.length) {
      // Last chunk: take everything remaining
      endOffset = text.length;
    } else {
      // Find a good break point near the raw end
      endOffset = findBreakPoint(text, rawEnd);
    }

    // Ensure we make progress (at least 1 char)
    if (endOffset <= startOffset) {
      endOffset = Math.min(startOffset + chunkSize, text.length);
    }

    const content = text.slice(startOffset, endOffset);

    chunks.push({
      id: createId<ChunkId>("chunk"),
      documentId,
      content,
      startOffset,
      endOffset,
      chunkIndex,
    });

    // Move to the next chunk start, respecting overlap
    if (endOffset >= text.length) {
      break;
    }

    const step = endOffset - startOffset - chunkOverlap;
    startOffset = startOffset + Math.max(step, 1);
    chunkIndex++;
  }

  return chunks;
}
