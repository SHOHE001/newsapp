import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";
import { articles, digests } from "@/lib/db/schema";
import { generateDailyDigest } from "@/lib/ai/digest";
import { and, gte, desc, sql } from "drizzle-orm";
import type { SummarizedArticle } from "@/lib/ai/summarize";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 直近24hのスコア>=50の上位20件を取得
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const rows = await db
      .select()
      .from(articles)
      .where(
        and(
          gte(articles.publishedAt, since),
          gte(articles.score, 50)
        )
      )
      .orderBy(desc(articles.score))
      .limit(20);

    // SummarizedArticle 形式に変換
    const summarizedArticles: SummarizedArticle[] = rows.map((row) => ({
      sourceId: row.sourceId,
      originalUrl: row.originalUrl,
      originalTitle: row.originalTitle,
      publishedAt: row.publishedAt,
      bodyText: row.bodyText,
      isNoise: row.isNoise ?? false,
      score: row.score ?? 0,
      category: row.category ?? "unknown",
      keywords: row.keywords ?? [],
      aiTitleJa: row.aiTitleJa ?? "",
      aiSummaryJa: row.aiSummaryJa ?? "",
    }));

    // ダイジェスト生成
    const markdown = await generateDailyDigest(summarizedArticles);

    // digests テーブルへ UPSERT
    const today = new Date().toISOString().slice(0, 10);

    await db
      .insert(digests)
      .values({
        date: today,
        markdown,
      })
      .onConflictDoUpdate({
        target: digests.date,
        set: {
          markdown,
          createdAt: sql`now()`,
        },
      });

    return NextResponse.json({ date: today, length: markdown.length });
  } catch (err) {
    console.error("[cron/digest] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
