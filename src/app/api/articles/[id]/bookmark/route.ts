import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";
import { bookmarks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: articleId } = await params;

    await db.insert(bookmarks).values({ articleId });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/articles/[id]/bookmark]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: articleId } = await params;

    await db.delete(bookmarks).where(eq(bookmarks.articleId, articleId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/articles/[id]/bookmark]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
