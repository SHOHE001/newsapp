import { db } from "@/lib/db/client";
import { articles, sources } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ExternalLink, ArrowLeft } from "lucide-react";
import Link from "next/link";
import TranslateButton from "./TranslateButton";

export const dynamic = "force-dynamic";

function formatDate(date: Date | string) {
  const d = new Date(date);
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const rows = await db
    .select({
      id: articles.id,
      aiTitleJa: articles.aiTitleJa,
      aiSummaryJa: articles.aiSummaryJa,
      originalUrl: articles.originalUrl,
      originalTitle: articles.originalTitle,
      publishedAt: articles.publishedAt,
      category: articles.category,
      keywords: articles.keywords,
      score: articles.score,
      bodyTranslatedJa: articles.bodyTranslatedJa,
      sourceName: sources.name,
    })
    .from(articles)
    .leftJoin(sources, eq(sources.id, articles.sourceId))
    .where(eq(articles.id, id))
    .limit(1);

  if (rows.length === 0) {
    notFound();
  }

  const article = rows[0];

  return (
    <div>
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Link
            href="/"
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            aria-label="ホームへ戻る"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="flex-1 truncate text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">
            {article.aiTitleJa ?? article.originalTitle}
          </h1>
        </div>
      </header>

      <article className="mx-auto max-w-lg px-4 py-6">
        {/* Title */}
        <h2 className="text-xl font-bold leading-snug text-zinc-900 dark:text-zinc-50">
          {article.aiTitleJa ?? article.originalTitle}
        </h2>

        {/* Meta */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-zinc-400">
          {article.sourceName && <span>{article.sourceName}</span>}
          <span>·</span>
          <span>{formatDate(article.publishedAt)}</span>
          {article.score != null && (
            <>
              <span>·</span>
              <span className="text-blue-500">★{article.score}</span>
            </>
          )}
          {article.category && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {article.category}
            </span>
          )}
        </div>

        {/* Keywords */}
        {article.keywords && article.keywords.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {article.keywords.slice(0, 6).map((kw) => (
              <span
                key={kw}
                className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-600 dark:bg-blue-950 dark:text-blue-300"
              >
                {kw}
              </span>
            ))}
          </div>
        )}

        {/* AI Summary */}
        {article.aiSummaryJa && (
          <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 mb-1.5">
              AI 要約
            </p>
            <p className="text-[14px] leading-relaxed text-zinc-700 dark:text-zinc-300">
              {article.aiSummaryJa}
            </p>
          </div>
        )}

        {/* "今読む" external link button */}
        <div className="mt-5">
          <a
            href={article.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-blue-700"
          >
            今読む
            <ExternalLink size={15} />
          </a>
        </div>

        {/* Translation button (Client Component) */}
        <TranslateButton
          articleId={article.id}
          initialTranslation={article.bodyTranslatedJa}
        />
      </article>
    </div>
  );
}
