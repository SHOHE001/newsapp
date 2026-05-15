"use client";

import { useState } from "react";
import { Languages } from "lucide-react";

export default function TranslateButton({
  articleId,
  initialTranslation,
}: {
  articleId: string;
  initialTranslation: string | null;
}) {
  const [translation, setTranslation] = useState<string | null>(
    initialTranslation
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!!initialTranslation);

  const handleTranslate = async () => {
    if (translation) {
      setExpanded((prev) => !prev);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/articles/${articleId}/translate`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { translatedBody: string } = await res.json();
      setTranslation(data.translatedBody);
      setExpanded(true);
    } catch {
      setError("翻訳に失敗しました。再試行してください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4">
      <button
        onClick={handleTranslate}
        disabled={loading}
        className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[14px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <Languages size={16} />
        {loading
          ? "翻訳中…"
          : translation
          ? expanded
            ? "翻訳を隠す"
            : "翻訳を表示"
          : "本文を日本語で読む"}
      </button>

      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}

      {expanded && translation && (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-blue-500 mb-2">
            日本語訳
          </p>
          <div className="text-[14px] leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
            {translation}
          </div>
        </div>
      )}
    </div>
  );
}
