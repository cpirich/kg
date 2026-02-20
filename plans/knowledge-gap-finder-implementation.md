# Knowledge Gap Finder — Implementation Plan

## Context

Build a web application that lets researchers upload academic papers, then generates an interactive visual map of what's been studied vs. what hasn't, identifies contradictions between papers, and surfaces promising unexplored research questions. The app deploys to GitHub Pages as a static export — all processing happens client-side with the user providing their own Anthropic API key.

## Architecture Overview

```
Static Next.js App (GitHub Pages)
├── Document Ingestion (client-side)
│   ├── PDF parsing (pdfjs-dist in browser)
│   ├── Text chunking
│   └── AI claim extraction (Anthropic JS SDK, user's API key)
├── Analysis Engine (client-side)
│   ├── Contradiction detection (AI-assisted pairwise comparison)
│   ├── Knowledge graph construction
│   ├── Gap detection (algorithmic + AI)
│   └── Research question generation
├── Visualization Layer
│   ├── Cytoscape.js — interactive knowledge map
│   ├── Recharts — statistical charts
│   └── shadcn/ui — dashboard, forms, layout
└── Persistence
    └── IndexedDB via Dexie.js (all data stays in browser)
```

**Key architectural constraint**: `output: 'export'` means no server-side API routes. The user provides their Anthropic API key in a settings page; it's stored in IndexedDB and used for direct browser-to-Anthropic API calls via `dangerouslyAllowBrowser: true`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, static export) |
| Language | TypeScript (strict) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Charts | Recharts (via shadcn chart components) |
| Graph viz | Cytoscape.js (dynamic import, no SSR) |
| AI | Anthropic JS SDK (client-side) |
| PDF | pdfjs-dist (browser worker) |
| Storage | Dexie.js (IndexedDB wrapper) |
| Testing | Vitest + Testing Library + fake-indexeddb |
| Linting | Biome.js |
| Node | v22.13.1 / npm 10.9.2 |

## Project Structure

```
kg/
├── .claude/settings.json
├── .github/workflows/
│   ├── format-lint.yml          # Biome check
│   ├── typecheck.yml            # tsc --noEmit
│   ├── test.yml                 # Vitest
│   ├── build.yml                # Next.js build
│   ├── deploy.yml               # GitHub Pages
│   ├── claude-code.yml          # Claude on issues/PRs
│   └── claude-review.yml        # Auto PR review
├── public/
│   └── pdf.worker.min.mjs       # pdfjs worker (copied via postinstall)
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx             # Dashboard
│   │   ├── globals.css
│   │   ├── ingest/page.tsx
│   │   ├── map/page.tsx
│   │   ├── contradictions/page.tsx
│   │   ├── gaps/page.tsx
│   │   └── settings/page.tsx
│   ├── components/
│   │   ├── ui/                  # shadcn primitives
│   │   ├── layout/              # sidebar, header, providers
│   │   ├── dashboard/           # stats-cards, charts, recent-docs
│   │   ├── ingest/              # file-dropzone, document-list, progress
│   │   ├── map/                 # knowledge-graph, controls, node-detail
│   │   ├── contradictions/      # contradiction-list, side-by-side-compare
│   │   └── gaps/                # gap-list, question-generator, matrix
│   ├── lib/
│   │   ├── db/schema.ts         # Dexie database + tables
│   │   ├── pdf/extract.ts       # PDF text extraction
│   │   ├── pdf/chunker.ts       # Text chunking
│   │   ├── ai/client.ts         # Anthropic SDK client factory
│   │   ├── ai/prompts.ts        # All prompt templates
│   │   ├── ai/claim-extractor.ts
│   │   ├── ai/contradiction-detector.ts
│   │   ├── ai/gap-analyzer.ts
│   │   ├── ai/question-generator.ts
│   │   ├── graph/builder.ts     # Cytoscape elements from DB data
│   │   ├── graph/layouts.ts     # Layout algorithm configs
│   │   ├── graph/density.ts     # Research density calculation
│   │   ├── graph/gap-detection.ts # Sparse region identification
│   │   └── utils/text.ts        # normalizeLabel, hashContent
│   ├── hooks/
│   │   ├── use-documents.ts
│   │   ├── use-claims.ts
│   │   ├── use-contradictions.ts
│   │   ├── use-gaps.ts
│   │   ├── use-graph-data.ts
│   │   ├── use-ai-client.ts
│   │   └── use-ingestion-pipeline.ts
│   ├── types/
│   │   ├── domain.ts            # Core domain types (THE contract)
│   │   ├── graph.ts             # Cytoscape element types
│   │   └── ai.ts                # AI request/response types
│   └── test/setup.ts
├── CLAUDE.md
├── README.md
├── biome.json
├── components.json
├── next.config.ts
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

## Data Models (Cross-Workstream Contract)

All types in `src/types/domain.ts` — the canonical contract file.

**Core entities**: `Document` (uploaded files with status tracking), `TextChunk` (segments with offsets), `Claim` (extracted findings/methodologies/claims with topic refs and confidence), `Topic` (graph nodes with claim/document counts), `TopicRelationship` (graph edges with type and weight), `Contradiction` (flagged conflicting claims with severity), `KnowledgeGap` (identified gaps with significance scores), `ResearchQuestion` (generated questions with impact/feasibility rankings), `AppSettings` (API key, model config, chunk settings).

**Branded IDs** (`DocumentId`, `ClaimId`, `TopicId`, etc.) prevent accidental mixing across tables.

**Dexie schema** in `src/lib/db/schema.ts` defines indexed tables for all entities.

## Parallel Workstreams

### Dependency Graph

```
WS1: Infrastructure ─────────────────────────┐
  │                                           │
  ├──→ WS2: Domain & Data ──→ WS3: Analysis  │
  │                                           │
  └──→ WS4: UI & Visualization ──────────────┘
                                              │
         WS5: Integration & QA ←──────────────┘
```

WS1 delivers scaffolding first. WS2 and WS4 start in parallel (WS4 uses mock data until hooks are ready). WS3 starts once WS2 delivers types + schema. WS5 begins after core logic from WS2/WS3 is testable.

**Shared contract**: `src/types/domain.ts` is written first as part of WS2, and all workstreams code against it.

---

### WS1: Infrastructure & DevOps

**Scope**: Project scaffolding, all config files, CI/CD, GitHub workflows, shadcn/ui initialization.

**Files**:
- `.claude/settings.json` — permissions (Read, Edit, Write, Grep, Glob, WebSearch, WebFetch, scoped Bash commands), env (CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS, ENABLE_LSP_TOOL), plansDirectory, enabledPlugins
- `package.json` — all deps, scripts (dev, build, check, format, typecheck, test)
- `next.config.ts` — `output: 'export'`, `basePath: isProd ? '/kg' : ''`, `images: { unoptimized: true }`
- `tsconfig.json` — strict, `@/*` path alias, bundler moduleResolution
- `biome.json` — 2-space indent, double quotes, recommended rules, organize imports
- `vitest.config.ts` — jsdom, globals, setupFiles, react + tsconfigPaths plugins
- `components.json` — shadcn/ui config
- `postcss.config.mjs` — Tailwind v4 postcss plugin
- `src/app/layout.tsx`, `src/app/globals.css`, `src/components/layout/providers.tsx`
- `.gitignore`, `.nojekyll` handling
- All 7 GitHub Actions workflows (format-lint, typecheck, test, build, deploy, claude-code, claude-review)
- `CLAUDE.md`, `README.md`

**GitHub Pages deploy workflow**: Two-job pattern (build → deploy). Build produces `out/`, adds `.nojekyll`, uploads as pages artifact. Deploy uses `actions/deploy-pages@v4`.

**Claude workflows**: Both use `CLAUDE_CODE_OAUTH_TOKEN` secret. `claude-code.yml` triggers on issue/PR comments with `@claude`. `claude-review.yml` triggers on PR open/sync with review prompt.

---

### WS2: Domain & Data

**Scope**: Type definitions, database schema, PDF extraction, text chunking, AI claim extraction, document hooks.

**Files**: `src/types/domain.ts`, `src/types/ai.ts`, `src/lib/db/schema.ts`, `src/lib/pdf/extract.ts`, `src/lib/pdf/chunker.ts`, `src/lib/ai/client.ts`, `src/lib/ai/prompts.ts`, `src/lib/ai/claim-extractor.ts`, `src/lib/utils/text.ts`, `src/hooks/use-documents.ts`, `src/hooks/use-claims.ts`, `src/hooks/use-ai-client.ts`, `src/hooks/use-ingestion-pipeline.ts`

**Ingestion pipeline flow**:
1. File upload → compute SHA-256 hash (dedup check)
2. PDF: pdfjs-dist extraction with web worker; Text: FileReader
3. Chunk text (sliding window, prefer paragraph/sentence boundaries)
4. For each chunk: call Claude for claim extraction (sequential, concurrency limit of 2)
5. Normalize topic labels, upsert topics, store claims with topic refs
6. Update document status at each stage (progress tracking)

**Tests**: Unit tests for chunker (overlap, boundaries, offsets), schema (CRUD, indexes), claim extraction (mocked AI responses, JSON parsing, error handling). Fixtures: sample text, pre-extracted claims, mocked Claude responses.

---

### WS3: Analysis Engine

**Scope**: Contradiction detection, graph construction, gap analysis algorithms, research question generation.

**Files**: `src/lib/ai/contradiction-detector.ts`, `src/lib/ai/gap-analyzer.ts`, `src/lib/ai/question-generator.ts`, `src/lib/graph/builder.ts`, `src/lib/graph/layouts.ts`, `src/lib/graph/density.ts`, `src/lib/graph/gap-detection.ts`, `src/types/graph.ts`, `src/hooks/use-contradictions.ts`, `src/hooks/use-gaps.ts`, `src/hooks/use-graph-data.ts`

**Contradiction detection**: Two-phase — (1) candidate generation (group claims by shared topics, same ClaimType pairs) then (2) AI verification via Claude (confidence threshold >0.6).

**Gap detection**: Three approaches combined — (1) structural: high-degree topic pairs lacking mutual edge, (2) density-based: topics with claim count far below cluster average, (3) AI-enhanced: Claude identifies methodological/temporal gaps requiring domain knowledge.

**Question generation**: Per gap, send gap description + surrounding claims to Claude. Generate 3-5 ranked questions with impact/feasibility scores. `overallScore = impact * 0.6 + feasibility * 0.4`.

**Graph construction**: `buildGraphElements()` maps Topics → Cytoscape nodes (size = claim count, color = density) and TopicRelationships → edges (width = weight). Gap-adjacent nodes flagged with dashed red border.

**Tests**: Unit tests for candidate pair generation, density normalization, sparse region algorithm, graph element construction. All with deterministic fixture data.

---

### WS4: UI & Visualization

**Scope**: All pages, shadcn/ui components, Cytoscape knowledge map, Recharts dashboard, file upload UX.

**Pages**: Dashboard (`/`), Ingest (`/ingest`), Map (`/map`), Contradictions (`/contradictions`), Gaps (`/gaps`), Settings (`/settings`)

**Key components**:
- **App sidebar**: Navigation with icons and badge counts from DB queries
- **Dashboard**: 4 stat cards (documents, claims, contradictions, gaps) + RadarChart topic density + recent documents table + activity feed
- **File dropzone**: Native drag-and-drop, accepts PDF/TXT, triggers ingestion pipeline, multi-step progress indicator
- **Knowledge graph**: Cytoscape.js loaded via `dynamic()` with `ssr: false`. Cola/dagre/cose/concentric layouts. Click node → detail panel showing contributing papers and claims. Gap highlight overlay toggle.
- **Contradiction viewer**: Card list sorted by severity, side-by-side claim comparison with source passages, confirm/dismiss actions
- **Gap analysis**: Ranked gap cards, generated research questions with scores, topic intersection heatmap (Recharts)
- **Settings**: API key input, model selector, chunk config, data export/import/clear

**Component tests**: Testing Library for dropzone interactions, document list rendering, contradiction viewer state changes.

---

### WS5: Integration & QA

**Scope**: Integration tests, E2E flow validation, edge cases, error boundaries, data export/import.

**Integration tests** (all use fake-indexeddb + mocked AI):
- `ingestion-flow.test.ts`: File → Document → Chunks → Claims → Topics in DB
- `contradiction-flow.test.ts`: Seeded claims → detection → Contradiction records
- `gap-analysis-flow.test.ts`: Seeded topic graph → gaps → research questions
- `graph-construction.test.ts`: DB data → graph elements → structure verification

**Edge cases**: Duplicate uploads (same hash), empty PDFs, corrupted PDFs, no API key set, API rate limiting mid-pipeline, claims with no topics, topic label dedup (case/plural variants), single-paper uploads, large batches.

**Additional deliverables**: `src/lib/utils/export.ts` (JSON export/import all DB tables), React error boundaries per feature section.

---

## Configuration Details

### .claude/settings.json
```json
{
  "permissions": {
    "allow": [
      "Read", "Edit", "Write", "Grep", "Glob", "WebSearch", "WebFetch",
      "Bash(git:*)", "Bash(gh:*)", "Bash(curl:*)", "Bash(ls:*)",
      "Bash(mkdir:*)", "Bash(cp:*)", "Bash(mv:*)", "Bash(rm:*)",
      "Bash(cat:*)", "Bash(echo:*)", "Bash(npx:*)", "Bash(npm:*)",
      "Bash(node:*)"
    ]
  },
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1",
    "ENABLE_LSP_TOOL": "1"
  },
  "plansDirectory": "plans",
  "enabledPlugins": [
    "superpowers@superpowers-marketplace",
    "typescript-lsp@claude-plugins-official",
    "chrome-devtools-mcp@chrome-devtools-plugins"
  ]
}
```

### next.config.ts
```typescript
import type { NextConfig } from "next";
const isProd = process.env.NODE_ENV === "production";
const nextConfig: NextConfig = {
  output: "export",
  basePath: isProd ? "/kg" : "",
  assetPrefix: isProd ? "/kg/" : "",
  images: { unoptimized: true },
  reactStrictMode: true,
};
export default nextConfig;
```

### GitHub Actions (Claude workflows)
Both use `claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}`. `claude-code.yml` triggers on `@claude` mentions in issues/PRs. `claude-review.yml` auto-reviews every PR with a focused review prompt.

## Verification Plan

1. **After WS1**: `npm run build` produces `out/` directory. `npm run check` passes. `npm run typecheck` passes. `npm run test` discovers setup file. All CI workflows parse correctly.
2. **After WS2**: Unit tests pass for chunker, schema, claim extractor. Can upload a text file and see structured claims in IndexedDB (browser dev tools).
3. **After WS3**: Unit tests pass for contradiction detection, density calculation, graph builder, gap detection. Can run analysis on seeded data and see results in DB.
4. **After WS4**: All pages render without errors. Knowledge graph displays with mock data. Dashboard shows stats. File upload triggers pipeline with progress indicator. Responsive layout works.
5. **After WS5**: All integration tests pass. Edge cases covered. `npm run test` shows meaningful coverage. Full flow works: upload PDF → see claims → view knowledge map → detect contradictions → analyze gaps → generate questions.
6. **End-to-end manual test**: Deploy to GitHub Pages, load at `https://<user>.github.io/kg/`, enter API key, upload a real PDF, verify full pipeline works in production static build.
