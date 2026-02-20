# Knowledge Gap Finder

A web application that helps researchers identify gaps in scientific literature. Upload academic papers and get an interactive visual map of what's been studied vs. what hasn't, contradictions between papers, and promising unexplored research questions.

## How It Works

1. **Upload Papers** — Drop in PDFs or text files of academic papers
2. **AI Extraction** — Claims, findings, and methodologies are extracted from each paper using Claude
3. **Knowledge Map** — An interactive graph visualizes topics and their relationships
4. **Contradiction Detection** — Conflicting claims across papers are surfaced and compared
5. **Gap Analysis** — Under-explored areas and missing connections are identified
6. **Research Questions** — Promising questions are generated and ranked by impact and feasibility

## Architecture

This is a fully client-side static application deployed to GitHub Pages. There is no backend — all processing happens in the browser using the user's own Anthropic API key.

- **Framework**: Next.js 15 (App Router, static export)
- **AI**: Anthropic JS SDK (direct browser-to-API calls)
- **PDF Parsing**: pdfjs-dist (browser worker)
- **Graph Visualization**: Cytoscape.js
- **Charts**: Recharts
- **UI**: shadcn/ui + Tailwind CSS v4
- **Storage**: IndexedDB via Dexie.js (all data stays in browser)

## Development

```bash
npm install
npm run dev       # Start dev server
npm run build     # Static export to out/
npm run check     # Biome lint + format check
npm run format    # Biome auto-fix
npm run typecheck # TypeScript type checking
npm run test      # Run tests with Vitest
```

## Deployment

The app deploys automatically to GitHub Pages via GitHub Actions on push to `main`. It's served at `https://<username>.github.io/kg/`.

## Privacy

All data stays in your browser's IndexedDB. Your API key is stored locally and used only for direct calls to the Anthropic API. Nothing is sent to any server other than Anthropic's API.
