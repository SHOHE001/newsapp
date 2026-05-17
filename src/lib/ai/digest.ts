import type { ScoredArticle } from "@/lib/scoring/rule-scorer";
import { generateText } from "@/lib/ai/providers";

const TOP_ARTICLES_LIMIT = 20;
const MIN_SCORE = 50;

export interface DigestArticle extends ScoredArticle {
  aiTitleJa: string;
  aiSummaryJa: string;
}

export async function generateDailyDigest(articles: DigestArticle[]): Promise<string> {
  const filtered = articles
    .filter((a) => !a.isNoise && a.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_ARTICLES_LIMIT);

  if (filtered.length === 0) {
    return "# 今日のニュースダイジェスト\n\n本日は注目すべき記事がありませんでした。";
  }

  const articleList = filtered.map((a, i) => {
    const title = a.aiTitleJa || a.originalTitle;
    const summary = a.aiSummaryJa || a.bodyText.slice(0, 200);
    return `${i + 1}. **${title}** (スコア: ${a.score}, カテゴリ: ${a.category})\n   ${summary}`;
  }).join("\n\n");

  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const prompt = `以下は${today}の主要ニュース記事リストです。これをもとに、日本語でMarkdown形式の「今日のまとめ」を作成してください。

形式:
- 冒頭に「今日のポイント」として3〜5行の概要
- 続けて「ハイライト」として特に重要な3記事を見出し付きで紹介

記事リスト:
${articleList}

Markdownのみを返してください。`;

  return generateText(prompt);
}
