# CLAUDE.md — Knowledge Gap Finder

## Project Overview

Static Next.js 15 app (App Router) deployed to GitHub Pages. Researchers upload academic papers, and the app extracts claims, builds a knowledge graph, detects contradictions, identifies gaps, and generates research questions. All processing is client-side — users provide their own Anthropic API key.

## Key Constraints

- **Static export only**: `output: 'export'` in next.config.ts. No API routes, no server-side code, no `getServerSideProps`. Everything runs in the browser.
- **Client-side AI**: Anthropic JS SDK with `dangerouslyAllowBrowser: true`. API key stored in IndexedDB.
- **GitHub Pages**: Production base path is `/kg`. All links and assets must respect `basePath`.

## Commands

```bash
npm run dev        # Next.js dev server
npm run build      # Static export to out/
npm run check      # Biome lint + format check
npm run format     # Biome auto-fix + organize imports
npm run typecheck  # tsc --noEmit
npm run test       # Vitest
```

## Tech Stack

- **Next.js 15** (App Router, static export)
- **TypeScript** (strict mode)
- **shadcn/ui** + **Tailwind CSS v4**
- **Recharts** (via shadcn chart components)
- **Cytoscape.js** (dynamic import, no SSR)
- **Anthropic JS SDK** (client-side)
- **pdfjs-dist** (browser worker)
- **Dexie.js** (IndexedDB wrapper)
- **Vitest** + **Testing Library** + **fake-indexeddb**
- **Biome.js** (linting + formatting)

## Code Conventions

- **Formatting**: Biome.js — 2-space indent, double quotes, organize imports. Run `npm run check` before committing.
- **Types**: All domain types live in `src/types/domain.ts` — this is the canonical contract. Use branded ID types (`DocumentId`, `ClaimId`, `TopicId`, etc.) everywhere.
- **Components**: shadcn/ui primitives in `src/components/ui/`. Feature components organized by page: `layout/`, `dashboard/`, `ingest/`, `map/`, `contradictions/`, `gaps/`.
- **Hooks**: Custom hooks in `src/hooks/` wrap Dexie queries with `useLiveQuery` for reactive data.
- **AI module**: All prompt templates in `src/lib/ai/prompts.ts`. AI functions return typed results, never raw strings.
- **Graph**: Cytoscape.js must be dynamically imported (`ssr: false`). Graph builder functions in `src/lib/graph/`.
- **Tests**: Co-locate test files next to source or in `__tests__/`. Use fake-indexeddb for DB tests. Mock AI responses — never call real API in tests.

## Architecture Notes

- **Ingestion pipeline**: Upload → SHA-256 dedup → PDF extract (pdfjs worker) → chunk (sliding window) → AI claim extraction (concurrency limit 2) → normalize topics → store in IndexedDB.
- **Contradiction detection**: Two-phase — candidate generation (shared topics, same claim type) then AI verification (confidence > 0.6).
- **Gap detection**: Three approaches combined — structural (missing edges between high-degree topics), density-based (topics with below-average claim counts), AI-enhanced (domain-aware gap identification).
- **All data in IndexedDB**: Dexie.js schema in `src/lib/db/schema.ts`. Tables: documents, textChunks, claims, topics, topicRelationships, contradictions, knowledgeGaps, researchQuestions, appSettings.

## File Structure

```
src/
├── app/          # Next.js pages (dashboard, ingest, map, contradictions, gaps, settings)
├── components/   # UI components organized by feature
├── lib/          # Core logic (db, pdf, ai, graph, utils)
├── hooks/        # React hooks (data access, pipeline orchestration)
└── types/        # TypeScript type definitions (domain, graph, ai)
```

## Implementation Plan

See `plans/knowledge-gap-finder-implementation.md` for the full implementation plan with workstream breakdown.
