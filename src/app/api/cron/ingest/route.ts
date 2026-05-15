import { NextRequest, NextResponse } from "next/server";
import { runIngest } from "@/lib/cron/ingest";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runIngest();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/ingest] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
