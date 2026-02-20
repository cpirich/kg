import { describe, expect, it } from "vitest";
import { hashContent, normalizeLabel } from "./text";

describe("normalizeLabel", () => {
  it("lowercases the label", () => {
    expect(normalizeLabel("Neural Networks")).toBe("neural network");
  });

  it("trims whitespace", () => {
    expect(normalizeLabel("  machine learning  ")).toBe("machine learning");
  });

  it("collapses internal whitespace", () => {
    expect(normalizeLabel("gene   expression")).toBe("gene expression");
  });

  it("singularizes by removing trailing s when length > 3", () => {
    expect(normalizeLabel("methods")).toBe("method");
    expect(normalizeLabel("neurons")).toBe("neuron");
    expect(normalizeLabel("studies")).toBe("studie");
  });

  it("does not singularize short words", () => {
    expect(normalizeLabel("gas")).toBe("gas");
    expect(normalizeLabel("bus")).toBe("bus");
  });

  it("handles single word", () => {
    expect(normalizeLabel("Biology")).toBe("biology");
  });

  it("handles empty string", () => {
    expect(normalizeLabel("")).toBe("");
  });

  it("handles string of just whitespace", () => {
    expect(normalizeLabel("   ")).toBe("");
  });
});

describe("hashContent", () => {
  it("returns a 64-character hex string", async () => {
    const hash = await hashContent("hello world");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("returns same hash for same content", async () => {
    const hash1 = await hashContent("test content");
    const hash2 = await hashContent("test content");
    expect(hash1).toBe(hash2);
  });

  it("returns different hashes for different content", async () => {
    const hash1 = await hashContent("content A");
    const hash2 = await hashContent("content B");
    expect(hash1).not.toBe(hash2);
  });

  it("handles empty string", async () => {
    const hash = await hashContent("");
    expect(hash).toHaveLength(64);
  });

  it("produces known SHA-256 for 'hello'", async () => {
    const hash = await hashContent("hello");
    // Known SHA-256 of "hello"
    expect(hash).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });
});
