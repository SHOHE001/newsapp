import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { articles, sources } from "@/lib/db/schema";
import { fetchFeed } from "@/lib/rss/fetch";
import { prefilter } from "@/lib/rss/prefilter";
import { scoreAndCategorize, type ScoredArticle } from "@/lib/scoring/rule-scorer";
import { RSS_SOURCES } from "@/lib/rss/sources";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const indexParam = searchParams.get("index");
  const index = indexParam ? parseInt(indexParam, 10) : NaN;

  if (isNaN(index) || index < 0 || index >= RSS_SOURCES.length) {
    return NextResponse.json(
      { error: `Invalid index. Must be 0 to ${RSS_SOURCES.length - 1}`, totalSources: RSS_SOURCES.length },
      { status: 400 },
    );
  }

  const src = RSS_SOURCES[index];

  try {
    // 1. ソースを UPSERT
    await db
      .insert(sources)
      .values({ name: src.name, url: src.url, category: src.category })
      .onConflictDoUpdate({
        target: sources.url,
        set: { name: src.name, category: src.category },
      });

    const sourceRow = await db
      .select({ id: sources.id })
      .from(sources)
      .where(sql`${sources.url} = ${src.url}`)
      .limit(1);
    const dbSourceId = sourceRow[0]?.id;
    if (!dbSourceId) {
      return NextResponse.json({ error: "Source not found in DB" }, { status: 500 });
    }

    // 2. RSS 取得
    const rawArticles = await fetchFeed(src);

    // 3. 既存記事を除外
    const existing = await db
      .select({ originalUrl: articles.originalUrl })
      .from(articles);
    const existingUrls = new Set(existing.map((r) => r.originalUrl));
    const newArticles = rawArticles.filter((a) => !existingUrls.has(a.originalUrl));

    if (newArticles.length === 0) {
      return NextResponse.json({
        source: src.name,
        index,
        total: rawArticles.length,
        new: 0,
        ingested: 0,
        message: "全件取込済み",
      });
    }

    // 4. 事前フィルタ (ルールベース)
    const candidates = prefilter(newArticles);
    if (candidates.length === 0) {
      return NextResponse.json({
        source: src.name,
        index,
        total: rawArticles.length,
        new: newArticles.length,
        prefiltered: 0,
        ingested: 0,
        message: "全件 prefilter で除外",
      });
    }

    // 5. ルールベース・スコアリング
    const scored = scoreAndCategorize(candidates);

    // 6. UPSERT (AI 要約はもう行わない)
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

    return NextResponse.json({
      source: src.name,
      index,
      total: rawArticles.length,
      new: newArticles.length,
      prefiltered: candidates.length,
      ingested,
      nextIndex: index + 1 < RSS_SOURCES.length ? index + 1 : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ source: src.name, index, error: message }, { status: 500 });
  }
}
