"use client";

import { useState, useCallback, useRef } from "react";
import { Search, ExternalLink } from "lucide-react";

type Article = {
  id: string;
  aiTitleJa: string | null;
  aiSummaryJa: string | null;
  originalUrl: string;
  publishedAt: string;
  score: number | null;
  category: string | null;
  sourceName: string | null;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <a
        href={article.originalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-start gap-1"
      >
        <h2 className="flex-1 text-[15px] font-semibold leading-snug text-zinc-900 group-hover:underline dark:text-zinc-50">
          {article.aiTitleJa ?? article.originalUrl}
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
    </article>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    // Cancel previous in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(
        `/api/articles?q=${encodeURIComponent(q.trim())}`,
        { credentials: "include", signal: controller.signal }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { articles: Article[] } = await res.json();
      setResults(data.articles);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  return (
    <div>
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="mx-auto flex max-w-lg items-center px-4 py-3">
          <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            検索
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-3 pt-4">
        {/* Search form */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="キーワードを入力…"
              className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-9 pr-4 text-[14px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-blue-500 dark:focus:ring-blue-900/40"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            検索
          </button>
        </form>

        {/* Results */}
        <div className="mt-4 flex flex-col gap-3">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-500" />
            </div>
          )}

          {!loading && searched && results.length === 0 && (
            <div className="py-16 text-center text-sm text-zinc-400">
              「{query}」に一致する記事が見つかりませんでした
            </div>
          )}

          {!loading &&
            results.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
        </div>
      </div>
    </div>
  );
}
