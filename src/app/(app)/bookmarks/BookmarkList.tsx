"use client";

import { useState } from "react";
import { Bookmark, ExternalLink } from "lucide-react";

type BookmarkItem = {
  bookmarkId: string;
  createdAt: Date;
  id: string;
  aiTitleJa: string | null;
  aiSummaryJa: string | null;
  originalUrl: string;
  originalTitle: string;
  publishedAt: Date;
  category: string | null;
};

function formatDate(date: Date | string) {
  const d = new Date(date);
  return d.toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BookmarkCard({
  item,
  onRemove,
}: {
  item: BookmarkItem;
  onRemove: (articleId: string) => void;
}) {
  const [removing, setRemoving] = useState(false);

  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (removing) return;
    setRemoving(true);
    try {
      await fetch(`/api/articles/${item.id}/bookmark`, {
        method: "DELETE",
        credentials: "include",
      });
      onRemove(item.id);
    } catch {
      setRemoving(false);
    }
  };

  return (
    <article className="relative rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <a
            href={item.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-1"
          >
            <h2 className="text-[15px] font-semibold leading-snug text-zinc-900 group-hover:underline dark:text-zinc-50">
              {item.aiTitleJa ?? item.originalTitle}
            </h2>
            <ExternalLink
              size={12}
              className="mt-1 shrink-0 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </a>
          {item.aiSummaryJa && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400 line-clamp-2">
              {item.aiSummaryJa}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-400">
            <span>{formatDate(item.publishedAt)}</span>
            {item.category && (
              <>
                <span>·</span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {item.category}
                </span>
              </>
            )}
          </div>
        </div>

        <button
          onClick={handleRemove}
          disabled={removing}
          aria-label="ブックマーク解除"
          className="shrink-0 rounded-lg p-1.5 text-blue-500 transition-colors hover:bg-zinc-100 hover:text-zinc-500 dark:hover:bg-zinc-800 disabled:opacity-40"
        >
          <Bookmark size={18} fill="currentColor" />
        </button>
      </div>
    </article>
  );
}

export default function BookmarkList({
  initialItems,
}: {
  initialItems: BookmarkItem[];
}) {
  const [items, setItems] = useState(initialItems);

  const handleRemove = (articleId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== articleId));
  };

  if (items.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-zinc-400">
        ブックマークがありません
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <BookmarkCard key={item.bookmarkId} item={item} onRemove={handleRemove} />
      ))}
    </div>
  );
}
