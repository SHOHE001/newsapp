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

Personal news aggregator: pulls 9 Japanese-IT + AI-vendor RSS feeds, scores each article with a **rule-based pipeline only** (prefilter + rule-based scoring — no LLM in the ingest path), stores results in Postgres (Neon), and serves a PWA UI. A daily digest is the **only** AI-generated content in the regular pipeline.

### Runtime stack

- **Next.js 16 (App Router) + React 19**, deployed on Vercel
- **Postgres on Neon** via `@neondatabase/serverless` + `drizzle-orm` (HTTP driver, not pooled)
- **Tailwind v4** + shadcn (`components.json`)
- **PWA** with custom service worker (`public/sw.js`), web-push for notifications

### Sources (`src/lib/rss/sources.ts`)

9 feeds total:
- **日本IT (5)**: はてブIT / Publickey / ITmedia NEWS / Zenn Trending / Qiita Trending
- **AI ベンダー一次情報 (4)**: Anthropic News / OpenAI Blog / DeepMind Blog / Google Research Blog

英語ソース (Hacker News / The Verge / Ars Technica / MIT Tech Review / arXiv) は AI 要約廃止と同時に削除済み。AI ベンダー 4 件のみ英語のまま残し、読みたい記事だけ `/api/articles/[id]/translate` でタップ翻訳する運用。

### Ingest pipeline (`src/lib/cron/ingest.ts`)

No LLM call in the ingest path. 1 ソース ≈ 数秒で完走し、9 ソース全体でも 1 分以内。

1. UPSERT all `RSS_SOURCES` into the `sources` table.
2. Load the set of already-ingested article URLs once (full `articles.original_url` set).
3. For each source **sequentially** (with 2s `SOURCE_DELAY_MS` between sources):
   - `fetchFeed` — latest 30 items per feed (`src/lib/rss/fetch.ts`)
   - filter out URLs already in `existingUrls`
   - `prefilter` (`src/lib/rss/prefilter.ts`) — drop articles whose title matches the JA noise keyword list (芸能/スキャンダル/結婚/不倫 等). Bypassed for AI vendor sources (`anthropic-news`, `openai-blog`, `deepmind-blog`, `google-research-blog`).
   - `scoreAndCategorize` (`src/lib/scoring/rule-scorer.ts`) — rule-based: source base score (60–80) + keyword boost (+3 per hit, max 4 hits, capped at 95). No LLM call.
   - UPSERT every scored article — `aiTitleJa = aiSummaryJa = null` で常に保存。Per-source DB commit, so a later failure doesn't lose earlier sources' work.
4. Delete articles older than 30 days that are not bookmarked.

Single-source variant: `POST /api/ingest/source?index=N` runs the same pipeline for just `RSS_SOURCES[N]` and returns counters (total / new / prefiltered / ingested). Used to debug or work around timeouts/rate limits one source at a time.

### Digest (`src/lib/ai/digest.ts`, `src/app/api/cron/digest/route.ts`)

**唯一の AI 呼び出し**。Selects the top **20** articles from the last **24h** with `score >= 50`, sorted by score descending, then asks the LLM to produce a Japanese Markdown summary ("今日のポイント" + "ハイライト" sections). UPSERTs into the `digests` table keyed by `date`.

`aiTitleJa` / `aiSummaryJa` は常に空文字なので、digest プロンプト内では `originalTitle` / `bodyText.slice(0, 200)` にフォールバックして英語のまま LLM に渡す。LLM 側で日本語に整理してくれる。

### Per-article translation

`POST /api/articles/[id]/translate` (Basic Auth でカバーされる) translates the article body to Japanese on demand and caches the result in `articles.body_translated_ja`. Subsequent calls return the cached value. **英語ソース (AI ベンダー 4 件) を読むときの主な日本語化手段**。

### AI providers (`src/lib/ai/providers.ts`)

ダイジェスト生成と on-demand 翻訳でのみ使われる。`generateText` / `generateJSON` cascade through providers in order until one succeeds on retryable errors (429, 5xx, missing API key):

1. **Gemini** (`gemini-2.5-flash-lite`) — `GEMINI_API_KEY`
2. **Groq** (`llama-3.3-70b-versatile`) — `GROQ_API_KEY`
3. **Cloudflare Workers AI** (`@cf/meta/llama-3.1-8b-instruct-fast`) — `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` (note: `.env.local.example` lists `CF_ACCOUNT_ID` / `CF_WORKERS_AI_TOKEN` — the code uses `CLOUDFLARE_*`)

**Known quota constraints** (2026-05 時点): Gemini free tier 20 req/day, Groq 100k TPD, Cloudflare 10k Neurons/day. ダイジェスト 1 日 1 回 + on-demand 翻訳のみなので、Gemini 無料枠で余裕で収まる。

### Auth (`src/middleware.ts`)

- `/api/cron/*`, `/api/ingest/*`, **and `/api/debug/*`** → Bearer `CRON_SECRET`
- All other matched routes → HTTP Basic Auth (`APP_BASIC_USER` / `APP_BASIC_PASS`, `src/lib/auth/basic.ts`)
- Excluded from matcher: `_next/static`, `_next/image`, `/icons/`, `/manifest.webmanifest`, `/sw.js`

### Cron schedules

`vercel.json`:
- `/api/cron/ingest` — daily 20:00 UTC (JST 05:00), `maxDuration: 300`
- `/api/cron/digest` — daily 21:00 UTC (JST 06:00), `maxDuration: 300`
- `/api/ingest/manual` — no schedule here, but `maxDuration: 300`

`.github/workflows/cron-ingest.yml` は現在 `workflow_dispatch` のみ (手動補助用)。9 ソースが 1 分以内で完走するため定期実行は Vercel cron 1 本で足りる。

### Database (`src/lib/db/`)

- `client.ts` — lazy Proxy singleton over `drizzle(neon(DATABASE_URL))`; do not import at module top level expecting connection at build time.
- `schema.ts` — tables: `sources`, `articles`, `reads`, `bookmarks`, `digests`, `pushSubscriptions`.
- `articles` columns of note:
  - `score`, `category`, `isNoise`, `keywords` — **set for every ingested article** by rule-based scoring (nullable in schema, but practically always populated post-ingest).
  - `aiTitleJa`, `aiSummaryJa` — **常に null** (AI 要約廃止後)。スキーマは過去データ温存のため変更していない。UI は `aiTitleJa ?? originalTitle` でフォールバック。
  - `bodyTranslatedJa` — null until `/api/articles/[id]/translate` is called once.

### Debug endpoints (Bearer `CRON_SECRET`)

- `GET /api/debug/stats` — row counts (`sources`, `articles`, `articlesWithAi`, `bookmarks`, `digests`) + 5 most recent articles。`articlesWithAi` は過去データの残骸を示すレガシー指標。
- `GET /api/debug/test-pipeline?stage=<name>` — run individual pipeline stages without writing to DB. Valid stages:
  - `fetch1` — fetch one feed (`RSS_SOURCES[0]`) and report count + first item.
  - `fetchAll` — fetch every feed, report total and per-source counts.
  - `ai1` — fetch one feed and run a single-article AI scoring call (cost: 1 LLM request) — diagnostic only; not used in production.
  - `rule5` — run rule-based scoring on the first 5 items of one feed (no LLM).

## Environment variables

See `.env.local.example`. Required for full functionality:
`DATABASE_URL`, `APP_BASIC_USER`, `APP_BASIC_PASS`, `CRON_SECRET`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`.
