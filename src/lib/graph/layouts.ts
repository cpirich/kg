/**
 * Cytoscape.js layout configuration presets.
 * Each export is a layout options object suitable for cy.layout(options).run().
 */

/** Cola (force-directed) layout — good for general-purpose graphs. */
export const colaLayout = {
  name: "cola",
  animate: true,
  animationDuration: 500,
  maxSimulationTime: 3000,
  fit: true,
  padding: 40,
  nodeSpacing: 30,
  edgeLength: 150,
  randomize: false,
  avoidOverlap: true,
  convergenceThreshold: 0.01,
  handleDisconnected: true,
};

/** Dagre (hierarchical) layout — good for directed acyclic graphs. */
export const dagreLayout = {
  name: "dagre",
  animate: true,
  animationDuration: 500,
  fit: true,
  padding: 40,
  nodeSep: 50,
  edgeSep: 10,
  rankSep: 80,
  rankDir: "TB" as const,
  spacingFactor: 1.2,
};

/** COSE (Compound Spring Embedder) layout — built-in force-directed. */
export const coseLayout = {
  name: "cose",
  animate: true,
  animationDuration: 500,
  fit: true,
  padding: 40,
  nodeRepulsion: 8000,
  idealEdgeLength: 100,
  edgeElasticity: 100,
  nestingFactor: 1.2,
  gravity: 0.25,
  numIter: 1000,
  randomize: false,
  componentSpacing: 100,
  nodeOverlap: 20,
};

/** Concentric layout — arranges nodes in concentric circles by degree. */
export const concentricLayout = {
  name: "concentric",
  animate: true,
  animationDuration: 500,
  fit: true,
  padding: 40,
  startAngle: (3 / 2) * Math.PI,
  sweep: 2 * Math.PI,
  clockwise: true,
  equidistant: false,
  minNodeSpacing: 40,
  avoidOverlap: true,
  concentric: (node: { degree: () => number }) => node.degree(),
  levelWidth: (_nodes: unknown[]) => 2,
};
