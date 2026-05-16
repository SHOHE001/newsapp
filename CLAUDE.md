# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (see `pnpm-lock.yaml`, `pnpm-workspace.yaml`).

- `pnpm dev` — start Next.js dev server (http://localhost:3000)
- `pnpm build` — production build
- `pnpm start` — run production build locally
- `pnpm lint` — ESLint (flat config, `eslint.config.mjs`, extends `eslint-config-next`)
- `pnpm drizzle-kit generate` — generate SQL migrations from `src/lib/db/schema.ts` into `drizzle/`
- `pnpm drizzle-kit migrate` — apply migrations against `DATABASE_URL`

No test runner is configured.

## Architecture

Personal news aggregator: pulls Japanese/foreign tech RSS feeds, runs each article through a **hybrid scoring pipeline** (rule-based prefilter + rule-based scoring → AI summary for the top few only), stores results in Postgres (Neon), and serves a PWA UI. A daily digest is generated from top-scored articles.

### Runtime stack

- **Next.js 16 (App Router) + React 19**, deployed on Vercel
- **Postgres on Neon** via `@neondatabase/serverless` + `drizzle-orm` (HTTP driver, not pooled)
- **Tailwind v4** + shadcn (`components.json`)
- **PWA** with custom service worker (`public/sw.js`), web-push for notifications

### Ingest pipeline (`src/lib/cron/ingest.ts`)

Designed to keep AI quota usage tiny and survive partial failures within Vercel's function timeout. Per source, **AI is called at most once** (for summary of top 5 articles); scoring/categorization is rule-based and free.

1. UPSERT all `RSS_SOURCES` (`src/lib/rss/sources.ts`) into the `sources` table.
2. Load the set of already-ingested article URLs once (full `articles.original_url` set, not just AI-processed).
3. For each source **sequentially** (with 2s `SOURCE_DELAY_MS` between sources):
   - `fetchFeed` — latest 30 items per feed (`src/lib/rss/fetch.ts`)
   - filter out URLs already in `existingUrls`
   - `prefilter` (`src/lib/rss/prefilter.ts`) — drop articles whose title matches the JA/EN noise keyword list (芸能/スキャンダル/celebrity/gossip 等). Bypassed for high-signal sources (`arxiv-*`, `anthropic-news`, `openai-blog`, `deepmind-blog`, `google-research-blog`).
   - `scoreAndCategorize` (`src/lib/scoring/rule-scorer.ts`) — rule-based: source base score (60–80) + keyword boost (+3 per hit, max 4 hits, capped at 95). No LLM call.
   - `selectTopForSummary(scored, 5)` — pick the 5 highest-scored articles for AI summary.
   - `summarize` (`src/lib/ai/summarize.ts`) — single batched LLM call (batch size 30, but in practice ≤5 here) returns `aiTitleJa` + `aiSummaryJa`. **Failure is caught**; the source's articles are still saved without AI fields.
   - UPSERT every scored article — top 5 with AI fields, the rest with `aiTitleJa = aiSummaryJa = null`. Per-source DB commit, so a later failure doesn't lose earlier sources' work.
4. Delete articles older than 30 days that are not bookmarked.

Single-source variant: `POST /api/ingest/source?index=N` runs the same pipeline for just `RSS_SOURCES[N]` and returns counters (total / new / prefiltered / topForAi / ingested / aiSummarized). Used to debug or work around timeouts/rate limits one source at a time.

### Digest (`src/lib/ai/digest.ts`, `src/app/api/cron/digest/route.ts`)

Selects the top **20** articles from the last **24h** with `score >= 50`, sorted by score descending, then asks the LLM to produce a Japanese Markdown summary ("今日のポイント" + "ハイライト" sections). UPSERTs into the `digests` table keyed by `date`.

### Per-article translation

`POST /api/articles/[id]/translate` (no Bearer needed — covered by Basic Auth) translates the article body to Japanese on demand and caches the result in `articles.body_translated_ja`. Subsequent calls return the cached value.

### AI providers (`src/lib/ai/providers.ts`)

`generateText` / `generateJSON` cascade through providers in order until one succeeds on retryable errors (429, 5xx, missing API key):

1. **Gemini** (`gemini-2.5-flash-lite`) — `GEMINI_API_KEY`
2. **Groq** (`llama-3.3-70b-versatile`) — `GROQ_API_KEY`
3. **Cloudflare Workers AI** (`@cf/meta/llama-3.1-8b-instruct-fast`) — `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` (note: `.env.local.example` lists `CF_ACCOUNT_ID` / `CF_WORKERS_AI_TOKEN` — the code uses `CLOUDFLARE_*`)

Non-retryable errors are rethrown. `generateJSON` strips markdown code fences before `JSON.parse`. Cloudflare responses are normalized — string, `{content}`, `{text}`, or a raw object/array (which gets `JSON.stringify`'d) are all handled.

**Known quota constraints** (2026-05 時点): Gemini free tier 20 req/day, Groq 100k TPD, Cloudflare 10k Neurons/day. The hybrid-scoring design is sized to fit within these.

### Auth (`src/middleware.ts`)

- `/api/cron/*`, `/api/ingest/*`, **and `/api/debug/*`** → Bearer `CRON_SECRET`
- All other matched routes → HTTP Basic Auth (`APP_BASIC_USER` / `APP_BASIC_PASS`, `src/lib/auth/basic.ts`)
- Excluded from matcher: `_next/static`, `_next/image`, `/icons/`, `/manifest.webmanifest`, `/sw.js`

### Cron schedules

`vercel.json`:
- `/api/cron/ingest` — daily 20:00 UTC (JST 05:00), `maxDuration: 300`
- `/api/cron/digest` — daily 21:00 UTC (JST 06:00), `maxDuration: 300`
- `/api/ingest/manual` — no schedule here, but `maxDuration: 300`

Supplementary GitHub Actions cron (`.github/workflows/cron-ingest.yml`) hits `/api/ingest/manual` at UTC 03:00 & 12:00 using `CRON_SECRET` + `APP_URL` secrets — three ingests/day total on Vercel Hobby.

### Database (`src/lib/db/`)

- `client.ts` — lazy Proxy singleton over `drizzle(neon(DATABASE_URL))`; do not import at module top level expecting connection at build time.
- `schema.ts` — tables: `sources`, `articles`, `reads`, `bookmarks`, `digests`, `pushSubscriptions`.
- `articles` columns of note:
  - `score`, `category`, `isNoise`, `keywords` — **set for every ingested article** by rule-based scoring (nullable in schema, but practically always populated post-ingest).
  - `aiTitleJa`, `aiSummaryJa` — **null unless the article was in the per-source top 5** for AI summary. `null` here means "not picked for AI", not "not yet processed".
  - `bodyTranslatedJa` — null until `/api/articles/[id]/translate` is called once.

### Debug endpoints (Bearer `CRON_SECRET`)

- `GET /api/debug/stats` — row counts (`sources`, `articles`, `articlesWithAi`, `bookmarks`, `digests`) + 5 most recent articles.
- `GET /api/debug/test-pipeline?stage=<name>` — run individual pipeline stages without writing to DB. Valid stages:
  - `fetch1` — fetch one feed (`RSS_SOURCES[0]`) and report count + first item.
  - `fetchAll` — fetch every feed, report total and per-source counts.
  - `ai1` — fetch one feed and run a single-article AI scoring call (cost: 1 LLM request) — diagnostic only; production no longer uses LLM for scoring.
  - `rule5` — run rule-based scoring on the first 5 items of one feed (no LLM).

## Environment variables

See `.env.local.example`. Required for full functionality:
`DATABASE_URL`, `APP_BASIC_USER`, `APP_BASIC_PASS`, `CRON_SECRET`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`.
