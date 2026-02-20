declare module "cytoscape-cola" {
  // biome-ignore lint/correctness/noUnusedImports: used by cytoscape.Ext type reference
  import type cytoscape from "cytoscape";
  const register: cytoscape.Ext;
  export default register;
}

declare module "cytoscape-dagre" {
  // biome-ignore lint/correctness/noUnusedImports: used by cytoscape.Ext type reference
  import type cytoscape from "cytoscape";
  const register: cytoscape.Ext;
  export default register;
}
