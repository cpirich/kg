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

  describe("singularization exceptions (explicit list)", () => {
    it("preserves 'class'", () => {
      expect(normalizeLabel("class")).toBe("class");
    });

    it("preserves 'process'", () => {
      expect(normalizeLabel("process")).toBe("process");
    });

    it("preserves 'bias'", () => {
      expect(normalizeLabel("bias")).toBe("bias");
    });

    it("preserves 'loss'", () => {
      expect(normalizeLabel("loss")).toBe("loss");
    });

    it("preserves 'axis'", () => {
      expect(normalizeLabel("axis")).toBe("axis");
    });

    it("preserves 'analysis'", () => {
      expect(normalizeLabel("analysis")).toBe("analysis");
    });

    it("preserves 'hypothesis'", () => {
      expect(normalizeLabel("hypothesis")).toBe("hypothesis");
    });

    it("preserves 'stress'", () => {
      expect(normalizeLabel("stress")).toBe("stress");
    });

    it("preserves 'access'", () => {
      expect(normalizeLabel("access")).toBe("access");
    });

    it("preserves 'focus'", () => {
      expect(normalizeLabel("focus")).toBe("focus");
    });

    it("preserves 'status'", () => {
      expect(normalizeLabel("status")).toBe("status");
    });

    it("preserves 'consensus'", () => {
      expect(normalizeLabel("consensus")).toBe("consensus");
    });

    it("preserves 'synthesis'", () => {
      expect(normalizeLabel("synthesis")).toBe("synthesis");
    });

    it("preserves 'basis'", () => {
      expect(normalizeLabel("basis")).toBe("basis");
    });

    it("preserves 'crisis'", () => {
      expect(normalizeLabel("crisis")).toBe("crisis");
    });

    it("preserves 'diagnosis'", () => {
      expect(normalizeLabel("diagnosis")).toBe("diagnosis");
    });

    it("preserves 'thesis'", () => {
      expect(normalizeLabel("thesis")).toBe("thesis");
    });

    it("preserves 'virus'", () => {
      expect(normalizeLabel("virus")).toBe("virus");
    });

    it("preserves 'success'", () => {
      expect(normalizeLabel("success")).toBe("success");
    });

    it("preserves 'progress'", () => {
      expect(normalizeLabel("progress")).toBe("progress");
    });

    it("preserves 'address'", () => {
      expect(normalizeLabel("address")).toBe("address");
    });

    it("preserves 'mass'", () => {
      expect(normalizeLabel("mass")).toBe("mass");
    });

    it("preserves 'glass'", () => {
      expect(normalizeLabel("glass")).toBe("glass");
    });

    it("preserves 'cross'", () => {
      expect(normalizeLabel("cross")).toBe("cross");
    });

    it("preserves 'boss'", () => {
      expect(normalizeLabel("boss")).toBe("boss");
    });

    it("preserves 'moss'", () => {
      expect(normalizeLabel("moss")).toBe("moss");
    });
  });

  describe("singularization exceptions (pattern-based)", () => {
    it("preserves words ending in 'ss' (not in explicit list)", () => {
      expect(normalizeLabel("abyss")).toBe("abyss");
      expect(normalizeLabel("bliss")).toBe("bliss");
      expect(normalizeLabel("compass")).toBe("compass");
    });

    it("preserves words ending in 'us'", () => {
      expect(normalizeLabel("campus")).toBe("campus");
      expect(normalizeLabel("census")).toBe("census");
      expect(normalizeLabel("nexus")).toBe("nexus");
      expect(normalizeLabel("apparatus")).toBe("apparatus");
      expect(normalizeLabel("corpus")).toBe("corpus");
    });

    it("preserves words ending in 'is'", () => {
      expect(normalizeLabel("oasis")).toBe("oasis");
      expect(normalizeLabel("parenthesis")).toBe("parenthesis");
      expect(normalizeLabel("metamorphosis")).toBe("metamorphosis");
      expect(normalizeLabel("genesis")).toBe("genesis");
    });

    it("preserves words ending in 'sis'", () => {
      expect(normalizeLabel("osmosis")).toBe("osmosis");
      expect(normalizeLabel("paralysis")).toBe("paralysis");
      expect(normalizeLabel("photosynthesis")).toBe("photosynthesis");
    });

    it("preserves words ending in 'ous'", () => {
      expect(normalizeLabel("nervous")).toBe("nervous");
      expect(normalizeLabel("curious")).toBe("curious");
      expect(normalizeLabel("ambiguous")).toBe("ambiguous");
      expect(normalizeLabel("continuous")).toBe("continuous");
      expect(normalizeLabel("dangerous")).toBe("dangerous");
    });
  });

  describe("singularization still works for true plurals", () => {
    it("singularizes standard plural words", () => {
      expect(normalizeLabel("methods")).toBe("method");
      expect(normalizeLabel("neurons")).toBe("neuron");
      expect(normalizeLabel("papers")).toBe("paper");
      expect(normalizeLabel("results")).toBe("result");
      expect(normalizeLabel("experiments")).toBe("experiment");
    });
  });

  describe("singularization exceptions with mixed case and whitespace", () => {
    it("preserves exceptions after lowercasing", () => {
      expect(normalizeLabel("ANALYSIS")).toBe("analysis");
      expect(normalizeLabel("Process")).toBe("process");
      expect(normalizeLabel("  HYPOTHESIS  ")).toBe("hypothesis");
    });

    it("preserves pattern-based exceptions after lowercasing", () => {
      expect(normalizeLabel("NERVOUS")).toBe("nervous");
      expect(normalizeLabel("Campus")).toBe("campus");
      expect(normalizeLabel("  GENESIS  ")).toBe("genesis");
    });
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
