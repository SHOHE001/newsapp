import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";
import { articles, reads, bookmarks, sources } from "@/lib/db/schema";
import { eq, and, isNull, desc, or, ilike } from "drizzle-orm";

const PAGE_SIZE = 20;
// score sort 時にラウンドロビンに使うバッファ件数。多くしすぎると遅くなる。
const SCORE_SORT_BUFFER = 200;

type ArticleRow = {
  id: string;
  aiTitleJa: string | null;
  aiSummaryJa: string | null;
  originalTitle: string;
  originalUrl: string;
  publishedAt: Date;
  score: number | null;
  category: string | null;
  keywords: string[] | null;
  readAt: Date | null;
  bookmarkedAt: Date | null;
  sourceName: string | null;
};

function roundRobinBySource(rows: ArticleRow[]): ArticleRow[] {
  // 最初に登場した順 (=最高スコア順) でソースを並べ、ラウンドロビンで取り出す。
  const buckets = new Map<string, ArticleRow[]>();
  const sourceOrder: string[] = [];
  for (const r of rows) {
    const key = r.sourceName ?? "_unknown";
    if (!buckets.has(key)) {
      buckets.set(key, []);
      sourceOrder.push(key);
    }
    buckets.get(key)!.push(r);
  }
  const result: ArticleRow[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const key of sourceOrder) {
      const next = buckets.get(key)!.shift();
      if (next) {
        result.push(next);
        added = true;
      }
    }
  }
  return result;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const category = searchParams.get("category"); // "ai" | "jp-it" | "foreign-tech" | null
    const sort = searchParams.get("sort") ?? "score"; // "score" | "newest"
    const cursor = searchParams.get("cursor"); // offset as string
    const q = searchParams.get("q"); // search query

    const offset = cursor ? parseInt(cursor, 10) : 0;

    // Build where conditions
    const conditions = [
      or(isNull(articles.isNoise), eq(articles.isNoise, false)),
    ];

    if (category && category !== "all") {
      conditions.push(eq(articles.category, category));
    }

    if (q && q.trim() !== "") {
      const like = `%${q.trim()}%`;
      conditions.push(
        or(
          ilike(articles.aiTitleJa, like),
          ilike(articles.aiSummaryJa, like),
          ilike(articles.originalTitle, like)
        )
      );
    }

    const selectFields = {
      id: articles.id,
      aiTitleJa: articles.aiTitleJa,
      aiSummaryJa: articles.aiSummaryJa,
      originalTitle: articles.originalTitle,
      originalUrl: articles.originalUrl,
      publishedAt: articles.publishedAt,
      score: articles.score,
      category: articles.category,
      keywords: articles.keywords,
      readAt: reads.readAt,
      bookmarkedAt: bookmarks.createdAt,
      sourceName: sources.name,
    };

    let pagedRows: ArticleRow[];
    let nextCursor: string | null;

    if (sort === "newest") {
      // 新着順: 単純な offset ページング。
      pagedRows = (await db
        .select(selectFields)
        .from(articles)
        .leftJoin(reads, eq(reads.articleId, articles.id))
        .leftJoin(bookmarks, eq(bookmarks.articleId, articles.id))
        .leftJoin(sources, eq(sources.id, articles.sourceId))
        .where(and(...conditions))
        .orderBy(desc(articles.publishedAt))
        .limit(PAGE_SIZE)
        .offset(offset)) as ArticleRow[];
      nextCursor =
        pagedRows.length === PAGE_SIZE ? String(offset + PAGE_SIZE) : null;
    } else {
      // スコア順: バッファ取得 → ソース別ラウンドロビン → offset スライス。
      // 同じソースの記事が連続して上位を埋めるのを防ぐ。
      const buffer = (await db
        .select(selectFields)
        .from(articles)
        .leftJoin(reads, eq(reads.articleId, articles.id))
        .leftJoin(bookmarks, eq(bookmarks.articleId, articles.id))
        .leftJoin(sources, eq(sources.id, articles.sourceId))
        .where(and(...conditions))
        .orderBy(desc(articles.score), desc(articles.publishedAt))
        .limit(SCORE_SORT_BUFFER)) as ArticleRow[];

      const interleaved = roundRobinBySource(buffer);
      pagedRows = interleaved.slice(offset, offset + PAGE_SIZE);
      nextCursor =
        offset + PAGE_SIZE < interleaved.length
          ? String(offset + PAGE_SIZE)
          : null;
    }

    return NextResponse.json({ articles: pagedRows, nextCursor });
  } catch (error) {
    console.error("[GET /api/articles]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
