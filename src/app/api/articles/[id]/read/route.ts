import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";
import { reads } from "@/lib/db/schema";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: articleId } = await params;

    await db.insert(reads).values({ articleId });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/articles/[id]/read]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
