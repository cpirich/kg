import type { DocumentId } from "@/types/domain";
import { describe, expect, it } from "vitest";
import { chunkText } from "./chunker";

const DOC_ID = "doc_test-123" as DocumentId;

describe("chunkText", () => {
  it("returns empty array for empty string", () => {
    const chunks = chunkText("", DOC_ID);
    expect(chunks).toHaveLength(0);
  });

  it("returns empty array for whitespace-only string", () => {
    const chunks = chunkText("   \n\n   ", DOC_ID);
    expect(chunks).toHaveLength(0);
  });

  it("returns single chunk for short text", () => {
    const text = "This is a short text.";
    const chunks = chunkText(text, DOC_ID, {
      chunkSize: 1500,
      chunkOverlap: 200,
    });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(text);
    expect(chunks[0].startOffset).toBe(0);
    expect(chunks[0].endOffset).toBe(text.length);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].documentId).toBe(DOC_ID);
  });

  it("splits text into multiple chunks with overlap", () => {
    // Create text longer than chunk size
    const sentence = "This is a test sentence. ";
    const text = sentence.repeat(100); // ~2500 chars
    const chunks = chunkText(text, DOC_ID, {
      chunkSize: 500,
      chunkOverlap: 100,
    });

    expect(chunks.length).toBeGreaterThan(1);

    // Verify chunk indexes are sequential
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].chunkIndex).toBe(i);
    }

    // Verify all text is covered (start of each chunk is before end of previous)
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].startOffset).toBeLessThan(chunks[i - 1].endOffset);
    }

    // Verify first chunk starts at 0 and last chunk ends at text length
    expect(chunks[0].startOffset).toBe(0);
    expect(chunks[chunks.length - 1].endOffset).toBe(text.length);
  });

  it("respects paragraph boundaries", () => {
    const para1 = "A".repeat(400);
    const para2 = "B".repeat(400);
    const text = `${para1}\n\n${para2}`;

    const chunks = chunkText(text, DOC_ID, {
      chunkSize: 500,
      chunkOverlap: 50,
    });

    // Should break at the paragraph boundary
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // First chunk should end at or near the paragraph boundary
    expect(chunks[0].content).not.toContain("B");
  });

  it("respects sentence boundaries when no paragraph break", () => {
    const text =
      "First sentence about topic A. Second sentence about topic B. Third sentence about topic C. Fourth sentence about topic D. Fifth sentence about topic E.";
    const chunks = chunkText(text, DOC_ID, { chunkSize: 80, chunkOverlap: 10 });

    // Each chunk should ideally end at a sentence boundary
    for (const chunk of chunks) {
      const trimmed = chunk.content.trim();
      if (chunk.endOffset < text.length) {
        // Non-final chunks should end at sentence boundary if possible
        expect(
          trimmed.endsWith(".") ||
            trimmed.endsWith("?") ||
            trimmed.endsWith("!") ||
            chunk.content.endsWith(" "),
        ).toBe(true);
      }
    }
  });

  it("assigns correct offsets", () => {
    const text = "Hello world. This is a test. Another sentence here.";
    const chunks = chunkText(text, DOC_ID, { chunkSize: 30, chunkOverlap: 5 });

    for (const chunk of chunks) {
      // The content should match the text at the given offsets
      expect(chunk.content).toBe(
        text.slice(chunk.startOffset, chunk.endOffset),
      );
    }
  });

  it("handles text with no natural break points", () => {
    // Single long word with no spaces
    const text = "a".repeat(3000);
    const chunks = chunkText(text, DOC_ID, {
      chunkSize: 1000,
      chunkOverlap: 100,
    });

    expect(chunks.length).toBeGreaterThan(1);
    // All text should still be covered
    expect(chunks[0].startOffset).toBe(0);
    expect(chunks[chunks.length - 1].endOffset).toBe(text.length);
  });

  it("all document IDs match the input", () => {
    const text = "Some sample text that spans multiple chunks when small.";
    const chunks = chunkText(text, DOC_ID, { chunkSize: 20, chunkOverlap: 5 });

    for (const chunk of chunks) {
      expect(chunk.documentId).toBe(DOC_ID);
    }
  });

  it("generates unique chunk IDs", () => {
    const text = "Sample text for testing unique IDs across all chunks.";
    const chunks = chunkText(text, DOC_ID, { chunkSize: 20, chunkOverlap: 5 });

    const ids = new Set(chunks.map((c) => c.id));
    expect(ids.size).toBe(chunks.length);
  });

  it("uses custom chunk size and overlap", () => {
    const text = "word ".repeat(200); // 1000 chars
    const chunks = chunkText(text, DOC_ID, {
      chunkSize: 200,
      chunkOverlap: 50,
    });

    expect(chunks.length).toBeGreaterThan(3);
  });
});
