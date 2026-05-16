"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

function renderMarkdownLite(markdown: string): React.ReactNode[] {
  // 見出し記号を外し、空行で段落を分割。**bold** は <strong> 化。
  const cleaned = markdown.replace(/^#+\s+/gm, "").trim();
  const blocks = cleaned.split(/\n{2,}/);
  return blocks.map((block, idx) => {
    const lines = block.split("\n");
    return (
      <p key={idx} className={idx > 0 ? "mt-2" : ""}>
        {lines.map((line, i) => {
          const parts = line.split(/\*\*(.+?)\*\*/g);
          return (
            <span key={i}>
              {parts.map((p, j) =>
                j % 2 === 1 ? (
                  <strong key={j} className="font-semibold">
                    {p}
                  </strong>
                ) : (
                  <span key={j}>{p}</span>
                ),
              )}
              {i < lines.length - 1 && <br />}
            </span>
          );
        })}
      </p>
    );
  });
}

export function DigestCard({ date, markdown }: { date: string; markdown: string }) {
  const [expanded, setExpanded] = useState(false);
  const cleaned = markdown.replace(/^#+\s+/gm, "");
  const snippet = cleaned.slice(0, 200);
  const hasMore = cleaned.length > snippet.length;

  return (
    <section className="mx-auto max-w-lg px-3 pt-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="block w-full rounded-xl border border-blue-100 bg-blue-50 p-3 text-left transition-colors hover:bg-blue-100/70 dark:border-blue-900 dark:bg-blue-950/40 dark:hover:bg-blue-900/40"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-500">
          {date} のダイジェスト
        </p>
        <div className="mt-1 text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300">
          {expanded ? (
            renderMarkdownLite(markdown)
          ) : (
            <p className="line-clamp-3">
              {snippet}
              {hasMore && "…"}
            </p>
          )}
        </div>
        {hasMore && (
          <div className="mt-2 flex items-center justify-end gap-1 text-[11px] font-medium text-blue-500">
            {expanded ? (
              <>
                閉じる <ChevronUp size={12} />
              </>
            ) : (
              <>
                続きを読む <ChevronDown size={12} />
              </>
            )}
          </div>
        )}
      </button>
    </section>
  );
}
