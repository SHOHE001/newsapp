import { db } from "@/lib/db/client";
import { bookmarks, articles } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import BookmarkList from "./BookmarkList";

export const dynamic = "force-dynamic";

export default async function BookmarksPage() {
  const rows = await db
    .select({
      bookmarkId: bookmarks.id,
      createdAt: bookmarks.createdAt,
      id: articles.id,
      aiTitleJa: articles.aiTitleJa,
      aiSummaryJa: articles.aiSummaryJa,
      originalUrl: articles.originalUrl,
      originalTitle: articles.originalTitle,
      publishedAt: articles.publishedAt,
      category: articles.category,
    })
    .from(bookmarks)
    .innerJoin(articles, eq(articles.id, bookmarks.articleId))
    .orderBy(desc(bookmarks.createdAt));

  return (
    <div>
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="mx-auto flex max-w-lg items-center px-4 py-3">
          <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            ブックマーク
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-3 pt-4">
        {rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-400">
            ブックマークがありません
          </div>
        ) : (
          <BookmarkList initialItems={rows} />
        )}
      </div>
    </div>
  );
}
