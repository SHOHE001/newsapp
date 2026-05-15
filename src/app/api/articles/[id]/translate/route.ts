import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";
import { articles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { translateBody } from "@/lib/ai/translate";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rows = await db
      .select({
        id: articles.id,
        bodyText: articles.bodyText,
        bodyTranslatedJa: articles.bodyTranslatedJa,
      })
      .from(articles)
      .where(eq(articles.id, id))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const article = rows[0];

    if (!article.bodyText) {
      return NextResponse.json(
        { error: "No body text available" },
        { status: 404 }
      );
    }

    // Return cached translation if available
    if (article.bodyTranslatedJa) {
      return NextResponse.json({ translatedBody: article.bodyTranslatedJa });
    }

    // Translate and persist
    const translatedBody = await translateBody(article.bodyText);

    await db
      .update(articles)
      .set({ bodyTranslatedJa: translatedBody })
      .where(eq(articles.id, id));

    return NextResponse.json({ translatedBody });
  } catch (error) {
    console.error("[POST /api/articles/[id]/translate]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
