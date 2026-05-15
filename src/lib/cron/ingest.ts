import { db } from "@/lib/db/client";
import { articles, bookmarks, sources } from "@/lib/db/schema";
import { fetchAllFeeds } from "@/lib/rss/fetch";
import { scoreAndFilter } from "@/lib/ai/score";
import { summarize } from "@/lib/ai/summarize";
import { RSS_SOURCES } from "@/lib/rss/sources";
import { and, lt, notInArray, sql } from "drizzle-orm";

export interface IngestResult {
  ingested: number;
  skipped: number;
}

export async function runIngest(): Promise<IngestResult> {
  // 1. sources テーブルへ RSS_SOURCES を先に upsert してFKエラーを防ぐ
  for (const src of RSS_SOURCES) {
    await db
      .insert(sources)
      .values({
        name: src.name,
        url: src.url,
        category: src.category,
      })
      .onConflictDoUpdate({
        target: sources.url,
        set: {
          name: src.name,
          category: src.category,
        },
      });
  }

  // sources テーブルから url → id のマップを取得
  const sourcesInDb = await db
    .select({ id: sources.id, url: sources.url })
    .from(sources);
  const sourceUrlToId = new Map(sourcesInDb.map((s) => [s.url, s.id]));

  // 2. フィード取得
  const rawArticles = await fetchAllFeeds();

  // 既存記事（AI処理済み）の URL セットを取得してスキップ
  const existingRows = await db
    .select({ originalUrl: articles.originalUrl })
    .from(articles)
    .where(sql`${articles.aiTitleJa} IS NOT NULL`);
  const existingUrls = new Set(existingRows.map((r) => r.originalUrl));
  const newArticles = rawArticles.filter((a) => !existingUrls.has(a.originalUrl));

  if (newArticles.length === 0) {
    return { ingested: 0, skipped: rawArticles.length };
  }

  // 3. スコアリング（新着分のみ）
  const scored = await scoreAndFilter(newArticles);

  // 4. ノイズ除外
  const filtered = scored.filter((a) => !a.isNoise);

  if (filtered.length === 0) {
    return { ingested: 0, skipped: rawArticles.length };
  }

  // 5. 要約
  const summarized = await summarize(filtered);

  // 6. UPSERT
  let ingested = 0;

  for (const article of summarized) {
    // sourceId を RSS_SOURCES の url から引く
    const rssSource = RSS_SOURCES.find((s) => s.id === article.sourceId);
    if (!rssSource) continue;

    const dbSourceId = sourceUrlToId.get(rssSource.url);
    if (!dbSourceId) continue;

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

  // 7. 30日超の記事を削除（bookmarks に含まれるものは除外）
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const bookmarkedArticleIds = db
    .select({ articleId: bookmarks.articleId })
    .from(bookmarks);

  await db.delete(articles).where(
    and(
      lt(articles.publishedAt, thirtyDaysAgo),
      notInArray(articles.id, bookmarkedArticleIds)
    )
  );

  const skipped = rawArticles.length - ingested;

  return { ingested, skipped };
}
