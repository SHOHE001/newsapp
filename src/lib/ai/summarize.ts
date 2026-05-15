import { type ScoredArticle } from "@/lib/ai/score";
import { generateJSON } from "@/lib/ai/providers";
import { batchProcess } from "@/lib/ai/batch";

export interface SummarizedArticle extends ScoredArticle {
  aiTitleJa: string;
  aiSummaryJa: string;
}

interface SummaryResult {
  id: number;
  ai_title_ja: string;
  ai_summary_ja: string;
}

async function summarizeBatch(articles: ScoredArticle[], offset: number): Promise<SummarizedArticle[]> {
  const targets = articles.filter((a) => !a.isNoise);

  if (targets.length === 0) {
    return articles.map((a) => ({ ...a, aiTitleJa: "", aiSummaryJa: "" }));
  }

  const items = targets.map((a, i) => ({
    id: offset + i,
    title: a.originalTitle,
    body: a.bodyText.slice(0, 500),
  }));

  const prompt = `以下の英語記事リストを日本語に要約してください。各記事について ai_title_ja（日本語タイトル）と ai_summary_ja（3〜4文の日本語要約）を返してください。

記事リスト:
${JSON.stringify(items, null, 2)}

以下のJSON配列形式で返してください:
[{"id": <number>, "ai_title_ja": <string>, "ai_summary_ja": <string>}, ...]`;

  const results = await generateJSON<SummaryResult[]>(prompt);

  // Build a lookup by original article index within targets
  const resultMap = new Map<number, SummaryResult>();
  for (const r of results) {
    resultMap.set(r.id, r);
  }

  let targetIndex = 0;
  return articles.map((article) => {
    if (article.isNoise) {
      return { ...article, aiTitleJa: "", aiSummaryJa: "" };
    }
    const r = resultMap.get(offset + targetIndex);
    targetIndex++;
    if (!r) {
      return { ...article, aiTitleJa: "", aiSummaryJa: "" };
    }
    return {
      ...article,
      aiTitleJa: r.ai_title_ja,
      aiSummaryJa: r.ai_summary_ja,
    };
  });
}

export async function summarize(articles: ScoredArticle[]): Promise<SummarizedArticle[]> {
  const batchSize = 10;

  const batches = await batchProcess(
    articles,
    async (batch) => {
      const typedBatch = batch as ScoredArticle[];
      const firstItem = typedBatch[0];
      const offset = firstItem ? articles.indexOf(firstItem) : 0;
      return summarizeBatch(typedBatch, offset);
    },
    batchSize
  );

  return (batches as SummarizedArticle[][]).flat();
}
