import { describe, expect, it } from "vitest";
import {
  colaLayout,
  concentricLayout,
  coseLayout,
  dagreLayout,
} from "./layouts";

describe("shared layout properties", () => {
  const layouts = [
    { config: colaLayout, expectedName: "cola" },
    { config: dagreLayout, expectedName: "dagre" },
    { config: coseLayout, expectedName: "cose" },
    { config: concentricLayout, expectedName: "concentric" },
  ];

  for (const { config, expectedName } of layouts) {
    describe(expectedName, () => {
      it(`has name "${expectedName}"`, () => {
        expect(config.name).toBe(expectedName);
      });

      it("has animate: true and animationDuration: 500", () => {
        expect(config.animate).toBe(true);
        expect(config.animationDuration).toBe(500);
      });

      it("has fit: true and padding: 40", () => {
        expect(config.fit).toBe(true);
        expect(config.padding).toBe(40);
      });
    });
  }
});

describe("colaLayout", () => {
  it("has avoidOverlap: true", () => {
    expect(colaLayout.avoidOverlap).toBe(true);
  });

  it("has handleDisconnected: true", () => {
    expect(colaLayout.handleDisconnected).toBe(true);
  });

  it("has nodeSpacing as a positive number", () => {
    expect(colaLayout.nodeSpacing).toBeGreaterThan(0);
  });

  it("has edgeLength as a positive number", () => {
    expect(colaLayout.edgeLength).toBeGreaterThan(0);
  });
});

describe("dagreLayout", () => {
  it('has rankDir: "TB"', () => {
    expect(dagreLayout.rankDir).toBe("TB");
  });

  it("has nodeSep as a positive number", () => {
    expect(dagreLayout.nodeSep).toBeGreaterThan(0);
  });

  it("has edgeSep as a positive number", () => {
    expect(dagreLayout.edgeSep).toBeGreaterThan(0);
  });

  it("has rankSep as a positive number", () => {
    expect(dagreLayout.rankSep).toBeGreaterThan(0);
  });
});

describe("coseLayout", () => {
  it("has nodeRepulsion as a positive number", () => {
    expect(coseLayout.nodeRepulsion).toBeGreaterThan(0);
  });

  it("has gravity between 0 and 1", () => {
    expect(coseLayout.gravity).toBeGreaterThan(0);
    expect(coseLayout.gravity).toBeLessThanOrEqual(1);
  });

  it("has numIter as a positive integer", () => {
    expect(coseLayout.numIter).toBeGreaterThan(0);
    expect(Number.isInteger(coseLayout.numIter)).toBe(true);
  });
});

describe("concentricLayout", () => {
  it("has clockwise: true", () => {
    expect(concentricLayout.clockwise).toBe(true);
  });

  it("concentric is a function that calls node.degree()", () => {
    const mockNode = { degree: () => 5 };
    expect(concentricLayout.concentric(mockNode)).toBe(5);
  });

  it("levelWidth is a function that returns 2", () => {
    expect(concentricLayout.levelWidth([])).toBe(2);
  });
});
