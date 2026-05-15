import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { articles, bookmarks, digests, sources } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [s, a, b, d] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(sources),
      db.select({ count: sql<number>`count(*)::int` }).from(articles),
      db.select({ count: sql<number>`count(*)::int` }).from(bookmarks),
      db.select({ count: sql<number>`count(*)::int` }).from(digests),
    ]);

    const withAi = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(articles)
      .where(sql`${articles.aiTitleJa} IS NOT NULL`);

    const recent = await db
      .select({
        title: articles.aiTitleJa,
        original: articles.originalTitle,
        score: articles.score,
        fetched: articles.fetchedAt,
      })
      .from(articles)
      .orderBy(sql`${articles.fetchedAt} DESC`)
      .limit(5);

    return NextResponse.json({
      sources: s[0]?.count ?? 0,
      articles: a[0]?.count ?? 0,
      articlesWithAi: withAi[0]?.count ?? 0,
      bookmarks: b[0]?.count ?? 0,
      digests: d[0]?.count ?? 0,
      recent,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
