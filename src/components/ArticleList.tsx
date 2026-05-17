"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bookmark, BookmarkCheck, ExternalLink } from "lucide-react";

type Article = {
  id: string;
  aiTitleJa: string | null;
  aiSummaryJa: string | null;
  originalTitle: string;
  originalUrl: string;
  publishedAt: string;
  score: number | null;
  category: string | null;
  keywords: string[] | null;
  readAt: string | null;
  bookmarkedAt: string | null;
  sourceName: string | null;
};

type Tab = "all" | "ai" | "jp-it";
type Sort = "score" | "newest";

const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "全て" },
  { value: "ai", label: "AI" },
  { value: "jp-it", label: "日本IT" },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ArticleCard({
  article,
  onRead,
  onBookmark,
}: {
  article: Article;
  onRead: (id: string) => void;
  onBookmark: (id: string, bookmarked: boolean) => void;
}) {
  const [bookmarked, setBookmarked] = useState(!!article.bookmarkedAt);
  const [loading, setLoading] = useState(false);

  const handleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    const next = !bookmarked;
    setBookmarked(next);
    try {
      await fetch(`/api/articles/${article.id}/bookmark`, {
        method: next ? "POST" : "DELETE",
        credentials: "include",
      });
      onBookmark(article.id, next);
    } catch {
      setBookmarked(!next);
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = () => {
    onRead(article.id);
  };

  return (
    <article
      className={`relative rounded-xl border bg-white p-4 shadow-sm transition-colors dark:bg-zinc-900 ${
        article.readAt
          ? "border-zinc-100 dark:border-zinc-800"
          : "border-zinc-200 dark:border-zinc-700"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Title & meta */}
        <div className="flex-1 min-w-0">
          <a
            href={article.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-1"
            onClick={handleCardClick}
          >
            <h2
              className={`text-[15px] font-semibold leading-snug group-hover:underline ${
                article.readAt
                  ? "text-zinc-400 dark:text-zinc-500"
                  : "text-zinc-900 dark:text-zinc-50"
              }`}
            >
              {article.aiTitleJa ?? article.originalTitle}
            </h2>
            <ExternalLink
              size={12}
              className="mt-1 shrink-0 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </a>
          {article.aiSummaryJa && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400 line-clamp-2">
              {article.aiSummaryJa}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-400">
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
            <div className="mt-2 flex flex-wrap gap-1">
              {article.keywords.slice(0, 4).map((kw) => (
                <span
                  key={kw}
                  className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-600 dark:bg-blue-950 dark:text-blue-300"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Bookmark button */}
        <button
          onClick={handleBookmark}
          disabled={loading}
          aria-label={bookmarked ? "ブックマーク解除" : "ブックマーク追加"}
          className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          {bookmarked ? (
            <BookmarkCheck size={18} className="text-blue-500" />
          ) : (
            <Bookmark size={18} />
          )}
        </button>
      </div>
    </article>
  );
}

export default function ArticleList() {
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<Sort>("score");
  const [articles, setArticles] = useState<Article[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  const fetchArticles = useCallback(
    async (cursor: string | null, reset: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ sort });
        if (tab !== "all") params.set("category", tab);
        if (cursor) params.set("cursor", cursor);

        const res = await fetch(`/api/articles?${params.toString()}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { articles: Article[]; nextCursor: string | null } =
          await res.json();

        setArticles((prev) =>
          reset ? data.articles : [...prev, ...data.articles]
        );
        setNextCursor(data.nextCursor);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
        setInitialLoaded(true);
      }
    },
    [tab, sort]
  );

  // Reset on tab/sort change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInitialLoaded(false);
    setArticles([]);
    setNextCursor(null);
    fetchArticles(null, true);
  }, [tab, sort, fetchArticles]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!loaderRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor && !loading) {
          fetchArticles(nextCursor, false);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [nextCursor, loading, fetchArticles]);

  const handleRead = async (id: string) => {
    try {
      await fetch(`/api/articles/${id}/read`, {
        method: "POST",
        credentials: "include",
      });
      setArticles((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, readAt: new Date().toISOString() } : a
        )
      );
    } catch {
      // silent
    }
  };

  const handleBookmark = (id: string, bookmarked: boolean) => {
    setArticles((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              bookmarkedAt: bookmarked ? new Date().toISOString() : null,
            }
          : a
      )
    );
  };

  return (
    <div className="mx-auto max-w-lg px-3 pt-4">
      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
              tab === value
                ? "bg-blue-600 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sort toggle */}
      <div className="mt-3 flex items-center justify-end gap-2">
        <span className="text-[11px] text-zinc-400">並び替え:</span>
        <button
          onClick={() => setSort(sort === "score" ? "newest" : "score")}
          className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          {sort === "score" ? "スコア順" : "新着順"}
        </button>
      </div>

      {/* Article list */}
      <div className="mt-3 flex flex-col gap-3">
        {articles.map((article) => (
          <ArticleCard
            key={article.id}
            article={article}
            onRead={handleRead}
            onBookmark={handleBookmark}
          />
        ))}

        {/* Empty state */}
        {initialLoaded && articles.length === 0 && !loading && (
          <div className="py-16 text-center text-sm text-zinc-400">
            記事が見つかりませんでした
          </div>
        )}

        {/* Loader trigger */}
        <div ref={loaderRef} className="h-10" />

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-500" />
          </div>
        )}
      </div>
    </div>
  );
}
