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

- **Pre-commit checks**: Always run `npm run test` and `npm run typecheck` before committing and pushing. All tests must pass.
- **Formatting**: Biome.js — 2-space indent, double quotes, organize imports. Run `npm run check` before committing.
- **Types**: All domain types live in `src/types/domain.ts` — this is the canonical contract. Use branded ID types (`DocumentId`, `ClaimId`, `TopicId`, etc.) everywhere.
- **Components**: shadcn/ui primitives in `src/components/ui/`. Feature components organized by page: `layout/`, `dashboard/`, `ingest/`, `map/`, `contradictions/`, `gaps/`.
- **Hooks**: Custom hooks in `src/hooks/` wrap Dexie queries with `useLiveQuery` for reactive data.
- **AI module**: All prompt templates in `src/lib/ai/prompts.ts`. AI functions return typed results, never raw strings. Shared utilities (e.g., `parseJsonResponse`) live in `src/lib/ai/utils.ts`.
- **Graph**: Cytoscape.js must be dynamically imported (`ssr: false`). Graph builder functions in `src/lib/graph/`. Cytoscape extension type declarations in `src/types/cytoscape-extensions.d.ts`. Use `as unknown as` casts for cytoscape style properties that accept runtime expressions (e.g., `mapData()`) but have narrow TS types.
- **Tests**: Co-locate test files next to source or in `__tests__/`. Use fake-indexeddb for DB tests. Mock AI responses — never call real API in tests.

## Architecture Notes

- **Ingestion pipeline**: Upload → SHA-256 dedup → PDF extract (pdfjs worker) → chunk (sliding window) → AI claim extraction (concurrency limit 2) → normalize topics → store in IndexedDB → create topic relationships (co-occurrence edges).
- **Topic relationships**: Created during ingestion by pairing topics that co-occur within the same claim or across claims in the same document. Relationships are upserted with incrementing weights. Orphaned topics and relationships are cleaned up on document deletion.
- **Contradiction detection**: Two-phase — candidate generation (shared topics, same claim type) then AI verification (confidence > 0.6). Re-running clears previous results before storing new ones.
- **Gap detection**: Three approaches combined — structural (missing edges between high-degree topics), density-based (topics with below-average claim counts), AI-enhanced (domain-aware gap identification). Re-running clears previous results before storing new ones.
- **All data in IndexedDB**: Dexie.js schema in `src/lib/db/schema.ts`. Tables: documents, textChunks, claims, topics, topicRelationships, contradictions, knowledgeGaps, researchQuestions, appSettings.
- **Settings persistence**: Settings page reads/writes to IndexedDB via `ensureSettings()` and `db.appSettings.put()`. API key is redacted from data exports to prevent accidental leakage.
- **Data import validation**: `importAllData` validates that the JSON is a non-null object, contains expected table names, and each table value is an array. Validation happens before clearing existing data.
- **Knowledge graph visualization**: Cytoscape.js with `cytoscape-cola` and `cytoscape-dagre` layout extensions, dynamically imported at runtime. Node size scales with claim count; edge width scales with relationship weight. Supports cola, dagre, cose, and concentric layouts.

## File Structure

```
src/
├── app/          # Next.js pages (dashboard, ingest, map, contradictions, gaps, settings)
├── components/   # UI components organized by feature
├── lib/          # Core logic (db, pdf, ai, graph, utils)
├── hooks/        # React hooks (data access, pipeline orchestration)
└── types/        # TypeScript type definitions (domain, graph, ai)
```

## Common Pitfalls

- **Wiring UI to DB**: Every form input that displays persisted data must load on mount and save on change. Placeholder-only UIs (no `onClick`, no `useEffect` to load) are easy to miss.
- **Referential integrity on delete**: When deleting a record, update or remove all dependent records (counts on related entities, orphaned children, relationship edges).
- **Idempotent re-runs**: Detection/analysis functions that store results must clear previous results before inserting new ones, or use deterministic IDs with upsert.
- **Sensitive data in exports**: Always redact secrets (API keys, tokens) from data export functions.
- **Topic normalization**: Naive singularization (strip trailing 's') breaks on many English words. Use pattern-based exceptions (words ending in "ss", "us", "is", "sis", "ous") and an explicit exception list.
- **DRY in AI modules**: Shared parsing/utility functions should live in `src/lib/ai/utils.ts`, not be duplicated across each AI file.
- **Linter-modified files**: The biome PostToolUse hook auto-formats files after edits. Always run `git status` after committing to check for unstaged changes left by the linter, and stage/commit them before switching branches or pushing.

## Implementation Plan

See `plans/knowledge-gap-finder-implementation.md` for the full implementation plan with workstream breakdown.
