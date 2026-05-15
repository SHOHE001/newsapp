import { db } from "@/lib/db/client";
import { digests } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import ArticleList from "@/components/ArticleList";

export const dynamic = "force-dynamic";

async function getLatestDigest() {
  try {
    const rows = await db
      .select({ date: digests.date, markdown: digests.markdown })
      .from(digests)
      .orderBy(desc(digests.date))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const digest = await getLatestDigest();

  return (
    <div>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            NewsApp
          </h1>
        </div>
      </header>

      {/* Digest banner */}
      {digest && (
        <section className="mx-auto max-w-lg px-3 pt-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/40">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-500">
              {digest.date} のダイジェスト
            </p>
            <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300">
              {digest.markdown.replace(/^#+\s/gm, "").slice(0, 200)}…
            </p>
          </div>
        </section>
      )}

      {/* Article list (Client Component) */}
      <ArticleList />
    </div>
  );
}
