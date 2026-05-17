import { db } from "@/lib/db/client";
import { articles, bookmarks, sources } from "@/lib/db/schema";
import { fetchFeed } from "@/lib/rss/fetch";
import { prefilter } from "@/lib/rss/prefilter";
import { scoreAndCategorize, type ScoredArticle } from "@/lib/scoring/rule-scorer";
import { RSS_SOURCES } from "@/lib/rss/sources";
import { and, lt, notInArray } from "drizzle-orm";

export type IngestSourceStatus = "ok" | "empty" | "failed" | "missing-source-id";

export interface IngestSourceDetail {
  source: string;
  status: IngestSourceStatus;
  count: number;
  error?: string;
}

export interface IngestResult {
  ingested: number;
  skipped: number;
  failed: number;
  details: IngestSourceDetail[];
}

const SOURCE_DELAY_MS = 2000;
const RETENTION_DAYS = 30;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 1ソース分を取得 → ルールスコア → DB 保存。
 * AI 要約はもう行わない (aiTitleJa/aiSummaryJa は常に null)。
 * 翻訳は /api/articles/[id]/translate のタップ翻訳に委譲。
 */
async function ingestOneSource(
  src: (typeof RSS_SOURCES)[number],
  dbSourceId: string,
  existingUrls: Set<string>,
): Promise<number> {
  const rawArticles = await fetchFeed(src);
  const newArticles = rawArticles.filter((a) => !existingUrls.has(a.originalUrl));
  if (newArticles.length === 0) return 0;

  const candidates = prefilter(newArticles);
  if (candidates.length === 0) return 0;

  const scored = scoreAndCategorize(candidates);

  let ingested = 0;
  for (const article of scored as ScoredArticle[]) {
    if (!article.originalUrl) continue;

    await db
      .insert(articles)
      .values({
        sourceId: dbSourceId,
        originalUrl: article.originalUrl,
        originalTitle: article.originalTitle,
        publishedAt: article.publishedAt,
        bodyText: article.bodyText,
        aiTitleJa: null,
        aiSummaryJa: null,
        score: article.score,
        category: article.category,
        isNoise: article.isNoise,
        keywords: article.keywords,
      })
      .onConflictDoUpdate({
        target: articles.originalUrl,
        set: {
          score: article.score,
          category: article.category,
          isNoise: article.isNoise,
          keywords: article.keywords,
        },
      });
    ingested++;
  }
  return ingested;
}

export async function runIngest(): Promise<IngestResult> {
  // 1. sources を upsert
  for (const src of RSS_SOURCES) {
    await db
      .insert(sources)
      .values({ name: src.name, url: src.url, category: src.category })
      .onConflictDoUpdate({
        target: sources.url,
        set: { name: src.name, category: src.category },
      });
  }

  const sourcesInDb = await db.select({ id: sources.id, url: sources.url }).from(sources);
  const sourceUrlToId = new Map(sourcesInDb.map((s) => [s.url, s.id]));

  // 2. 既処理 URL セット
  const existingRows = await db
    .select({ originalUrl: articles.originalUrl })
    .from(articles);
  const existingUrls = new Set(existingRows.map((r) => r.originalUrl));

  // 3. ソースを 1 つずつ処理 (1 ソース失敗しても他は続行)
  let ingested = 0;
  let failed = 0;
  let processed = 0;
  const details: IngestSourceDetail[] = [];

  for (const src of RSS_SOURCES) {
    const dbSourceId = sourceUrlToId.get(src.url);
    if (!dbSourceId) {
      failed++;
      details.push({ source: src.id, status: "missing-source-id", count: 0 });
      continue;
    }
    try {
      const count = await ingestOneSource(src, dbSourceId, existingUrls);
      ingested += count;
      details.push({
        source: src.id,
        status: count > 0 ? "ok" : "empty",
        count,
      });
    } catch (err) {
      console.warn(`[ingest] source failed: ${src.id}`, err);
      failed++;
      details.push({
        source: src.id,
        status: "failed",
        count: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    processed++;
    if (processed < RSS_SOURCES.length) {
      await sleep(SOURCE_DELAY_MS);
    }
  }

  // 4. 30日超の記事を削除 (bookmarks 参照中は除外)
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const bookmarkedArticleIds = db.select({ articleId: bookmarks.articleId }).from(bookmarks);
  await db
    .delete(articles)
    .where(and(lt(articles.publishedAt, cutoff), notInArray(articles.id, bookmarkedArticleIds)));

  return { ingested, skipped: 0, failed, details };
}
