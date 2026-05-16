import { db } from "@/lib/db/client";
import { digests } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import ArticleList from "@/components/ArticleList";
import { DigestCard } from "@/components/DigestCard";

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
      {digest && <DigestCard date={digest.date} markdown={digest.markdown} />}

      {/* Article list (Client Component) */}
      <ArticleList />
    </div>
  );
}
