import { db } from "@/lib/db/client";
import { articles, bookmarks, sources } from "@/lib/db/schema";
import { fetchFeed } from "@/lib/rss/fetch";
import { prefilter } from "@/lib/rss/prefilter";
import {
  scoreAndCategorize,
  selectTopForSummary,
  type ScoredArticle,
} from "@/lib/scoring/rule-scorer";
import { summarize } from "@/lib/ai/summarize";
import { RSS_SOURCES } from "@/lib/rss/sources";
import { and, lt, notInArray } from "drizzle-orm";

export type IngestSourceStatus = "ok" | "empty" | "failed" | "missing-source-id";

export interface IngestSourceDetail {
  source: string;
  status: IngestSourceStatus;
  count: number;
  aiSummarized: number;
  error?: string;
}

export interface IngestResult {
  ingested: number;
  aiSummarized: number;
  skipped: number;
  failed: number;
  details: IngestSourceDetail[];
}

const SOURCE_DELAY_MS = 2000;
const TOP_N_FOR_SUMMARY = 5;
const RETENTION_DAYS = 30;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface IngestOneSourceResult {
  ingested: number;
  aiSummarized: number;
}

/**
 * 1ソース分を取得 → ルールスコア → 上位 N 件 AI 要約 → 全件 DB 保存。
 * 失敗時は例外を投げる（呼び出し側でログ・続行を判断）。
 */
async function ingestOneSource(
  src: (typeof RSS_SOURCES)[number],
  dbSourceId: string,
  existingUrls: Set<string>,
): Promise<IngestOneSourceResult> {
  const rawArticles = await fetchFeed(src);
  const newArticles = rawArticles.filter((a) => !existingUrls.has(a.originalUrl));
  if (newArticles.length === 0) return { ingested: 0, aiSummarized: 0 };

  const candidates = prefilter(newArticles);
  if (candidates.length === 0) return { ingested: 0, aiSummarized: 0 };

  const scored = scoreAndCategorize(candidates);
  const topForAi = selectTopForSummary(scored, TOP_N_FOR_SUMMARY);
  const topUrls = new Set(topForAi.map((a) => a.originalUrl));

  // AI 要約は上位 N 件のみ。失敗した場合は空のまま保存して続行。
  let summarizedMap = new Map<string, { aiTitleJa: string; aiSummaryJa: string }>();
  if (topForAi.length > 0) {
    try {
      const summarized = await summarize(topForAi);
      summarizedMap = new Map(
        summarized
          .filter((a) => a.aiTitleJa || a.aiSummaryJa)
          .map((a) => [
            a.originalUrl,
            { aiTitleJa: a.aiTitleJa, aiSummaryJa: a.aiSummaryJa },
          ]),
      );
    } catch (err) {
      console.warn(`[ingest] summarize failed for ${src.id}, saving without AI title:`, err);
    }
  }

  let ingested = 0;
  let aiSummarized = 0;
  for (const article of scored as ScoredArticle[]) {
    if (!article.originalUrl) continue;
    const ai = topUrls.has(article.originalUrl)
      ? summarizedMap.get(article.originalUrl)
      : undefined;
    const aiTitleJa = ai?.aiTitleJa || null;
    const aiSummaryJa = ai?.aiSummaryJa || null;
    if (aiTitleJa) aiSummarized++;

    await db
      .insert(articles)
      .values({
        sourceId: dbSourceId,
        originalUrl: article.originalUrl,
        originalTitle: article.originalTitle,
        publishedAt: article.publishedAt,
        bodyText: article.bodyText,
        aiTitleJa,
        aiSummaryJa,
        score: article.score,
        category: article.category,
        isNoise: article.isNoise,
        keywords: article.keywords,
      })
      .onConflictDoUpdate({
        target: articles.originalUrl,
        set: {
          aiTitleJa,
          aiSummaryJa,
          score: article.score,
          category: article.category,
          isNoise: article.isNoise,
          keywords: article.keywords,
        },
      });
    ingested++;
  }
  return { ingested, aiSummarized };
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

  // 2. 既処理 URL セット（全 articles 対象。AI 未要約も再処理しない）
  const existingRows = await db
    .select({ originalUrl: articles.originalUrl })
    .from(articles);
  const existingUrls = new Set(existingRows.map((r) => r.originalUrl));

  // 3. ソースを 1 つずつ処理 → 各ソース終了直後に DB 保存
  //    1ソース失敗しても他は続行（部分結果が必ず DB に残る）
  let ingested = 0;
  let aiSummarized = 0;
  let failed = 0;
  let processed = 0;
  const details: IngestSourceDetail[] = [];

  for (const src of RSS_SOURCES) {
    const dbSourceId = sourceUrlToId.get(src.url);
    if (!dbSourceId) {
      failed++;
      details.push({
        source: src.id,
        status: "missing-source-id",
        count: 0,
        aiSummarized: 0,
      });
      continue;
    }
    try {
      const result = await ingestOneSource(src, dbSourceId, existingUrls);
      ingested += result.ingested;
      aiSummarized += result.aiSummarized;
      details.push({
        source: src.id,
        status: result.ingested > 0 ? "ok" : "empty",
        count: result.ingested,
        aiSummarized: result.aiSummarized,
      });
    } catch (err) {
      console.warn(`[ingest] source failed: ${src.id}`, err);
      failed++;
      details.push({
        source: src.id,
        status: "failed",
        count: 0,
        aiSummarized: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    processed++;
    if (processed < RSS_SOURCES.length) {
      await sleep(SOURCE_DELAY_MS);
    }
  }

  // 4. 30日超の記事を削除（bookmarks 参照中は除外）
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const bookmarkedArticleIds = db.select({ articleId: bookmarks.articleId }).from(bookmarks);
  await db
    .delete(articles)
    .where(and(lt(articles.publishedAt, cutoff), notInArray(articles.id, bookmarkedArticleIds)));

  return { ingested, aiSummarized, skipped: 0, failed, details };
}
