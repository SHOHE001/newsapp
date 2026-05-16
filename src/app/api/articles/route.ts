import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";
import { articles, reads, bookmarks, sources } from "@/lib/db/schema";
import { eq, and, isNull, desc, or, ilike } from "drizzle-orm";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const category = searchParams.get("category"); // "ai" | "jp-it" | "foreign-tech" | null
    const sort = searchParams.get("sort") ?? "score"; // "score" | "personalized" | "newest"
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

    // Determine order
    const orderBy =
      sort === "newest"
        ? desc(articles.publishedAt)
        : desc(articles.score);

    const rows = await db
      .select({
        id: articles.id,
        aiTitleJa: articles.aiTitleJa,
        aiSummaryJa: articles.aiSummaryJa,
        originalTitle: articles.originalTitle,
        originalUrl: articles.originalUrl,
        publishedAt: articles.publishedAt,
        score: articles.score,
        category: articles.category,
        keywords: articles.keywords,
        // left join reads: readAt will be null if not read
        readAt: reads.readAt,
        // left join bookmarks
        bookmarkedAt: bookmarks.createdAt,
        sourceName: sources.name,
      })
      .from(articles)
      .leftJoin(reads, eq(reads.articleId, articles.id))
      .leftJoin(bookmarks, eq(bookmarks.articleId, articles.id))
      .leftJoin(sources, eq(sources.id, articles.sourceId))
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(PAGE_SIZE)
      .offset(offset);

    const nextCursor =
      rows.length === PAGE_SIZE ? String(offset + PAGE_SIZE) : null;

    return NextResponse.json({ articles: rows, nextCursor });
  } catch (error) {
    console.error("[GET /api/articles]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
