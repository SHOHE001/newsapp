import { NextResponse } from "next/server";
import { fetchAllFeeds, fetchFeed } from "@/lib/rss/fetch";
import { RSS_SOURCES } from "@/lib/rss/sources";
import { scoreAndFilter } from "@/lib/ai/score";
import { generateJSON } from "@/lib/ai/providers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage") ?? "fetch1";

  try {
    if (stage === "fetch1") {
      // 1ソースだけRSS取得
      const src = RSS_SOURCES[0];
      const items = await fetchFeed(src);
      return NextResponse.json({
        source: src.name,
        count: items.length,
        first: items[0] ? { title: items[0].originalTitle, body: items[0].bodyText.slice(0, 100) } : null,
      });
    }

    if (stage === "fetchAll") {
      const all = await fetchAllFeeds();
      const bySource: Record<string, number> = {};
      for (const a of all) {
        const src = RSS_SOURCES.find((s) => s.id === a.sourceId);
        if (src) bySource[src.name] = (bySource[src.name] ?? 0) + 1;
      }
      return NextResponse.json({ total: all.length, bySource });
    }

    if (stage === "ai1") {
      // 1記事だけAI処理
      const src = RSS_SOURCES[0];
      const items = await fetchFeed(src);
      if (items.length === 0) return NextResponse.json({ error: "no items" });
      const start = Date.now();
      const result = await generateJSON<{ id: number; is_noise: boolean; score: number; category: string; keywords: string[] }[]>(
        `以下の記事を評価してください。is_noise(boolean), score(0-100), category, keywords を返してください。\n\n記事: ${JSON.stringify({ id: 0, title: items[0].originalTitle, body: items[0].bodyText.slice(0, 200) })}\n\n[{"id":<number>,"is_noise":<boolean>,"score":<number>,"category":<string>,"keywords":[<string>]}]`
      );
      return NextResponse.json({ elapsedMs: Date.now() - start, result });
    }

    if (stage === "ai5") {
      // 5記事AI処理
      const src = RSS_SOURCES[0];
      const items = (await fetchFeed(src)).slice(0, 5);
      const start = Date.now();
      const scored = await scoreAndFilter(items);
      return NextResponse.json({
        elapsedMs: Date.now() - start,
        input: items.length,
        output: scored.length,
        sample: scored.slice(0, 3).map((a) => ({ title: a.originalTitle, score: a.score, isNoise: a.isNoise })),
      });
    }

    return NextResponse.json({ error: "unknown stage", validStages: ["fetch1", "fetchAll", "ai1", "ai5"] }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message, stack: err instanceof Error ? err.stack : undefined }, { status: 500 });
  }
}
