import { db } from "@/lib/db/client";
import { articles, bookmarks, sources } from "@/lib/db/schema";
import { fetchFeed } from "@/lib/rss/fetch";
import { scoreAndFilter } from "@/lib/ai/score";
import { summarize } from "@/lib/ai/summarize";
import { RSS_SOURCES } from "@/lib/rss/sources";
import { and, lt, notInArray, sql } from "drizzle-orm";

export interface IngestResult {
  ingested: number;
  skipped: number;
  failed: number;
}

const SOURCE_DELAY_MS = 2000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 1ソース分を取得 → AI処理 → DB保存。
 * 失敗時は例外を投げる（呼び出し側でログ・続行を判断）。
 */
async function ingestOneSource(
  src: (typeof RSS_SOURCES)[number],
  dbSourceId: string,
  existingUrls: Set<string>,
): Promise<number> {
  const rawArticles = await fetchFeed(src);
  const newArticles = rawArticles.filter((a) => !existingUrls.has(a.originalUrl));
  if (newArticles.length === 0) return 0;

  const scored = await scoreAndFilter(newArticles);
  const filtered = scored.filter((a) => !a.isNoise);
  if (filtered.length === 0) return 0;

  const summarized = await summarize(filtered);

  let ingested = 0;
  for (const article of summarized) {
    if (!article.originalUrl) continue;
    await db
      .insert(articles)
      .values({
        sourceId: dbSourceId,
        originalUrl: article.originalUrl,
        originalTitle: article.originalTitle,
        publishedAt: article.publishedAt,
        bodyText: article.bodyText,
        aiTitleJa: article.aiTitleJa || null,
        aiSummaryJa: article.aiSummaryJa || null,
        score: article.score,
        category: article.category,
        isNoise: article.isNoise,
        keywords: article.keywords,
      })
      .onConflictDoUpdate({
        target: articles.originalUrl,
        set: {
          aiTitleJa: article.aiTitleJa || null,
          aiSummaryJa: article.aiSummaryJa || null,
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

  // 2. AI 処理済み URL セット（全体で1回だけ取得）
  const existingRows = await db
    .select({ originalUrl: articles.originalUrl })
    .from(articles)
    .where(sql`${articles.aiTitleJa} IS NOT NULL`);
  const existingUrls = new Set(existingRows.map((r) => r.originalUrl));

  // 3. ソースを 1 つずつ処理 → 各ソース終了直後に DB 保存
  //    1ソース失敗しても他は続行（部分結果が必ず DB に残る）
  let ingested = 0;
  let failed = 0;
  let processed = 0;

  for (const src of RSS_SOURCES) {
    const dbSourceId = sourceUrlToId.get(src.url);
    if (!dbSourceId) {
      failed++;
      continue;
    }
    try {
      const count = await ingestOneSource(src, dbSourceId, existingUrls);
      ingested += count;
    } catch (err) {
      console.warn(`[ingest] source failed: ${src.id}`, err);
      failed++;
    }
    processed++;
    if (processed < RSS_SOURCES.length) {
      await sleep(SOURCE_DELAY_MS);
    }
  }

  // 4. 30日超の記事を削除（bookmarks 参照中は除外）
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const bookmarkedArticleIds = db.select({ articleId: bookmarks.articleId }).from(bookmarks);
  await db
    .delete(articles)
    .where(and(lt(articles.publishedAt, thirtyDaysAgo), notInArray(articles.id, bookmarkedArticleIds)));

  return { ingested, skipped: 0, failed };
}
