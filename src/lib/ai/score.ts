import { type RawArticle } from "@/lib/rss/fetch";
import { generateJSON } from "@/lib/ai/providers";
import { batchProcess } from "@/lib/ai/batch";

export interface ScoredArticle extends RawArticle {
  isNoise: boolean;
  score: number;
  category: string;
  keywords: string[];
}

interface ScoreResult {
  id: number;
  is_noise: boolean;
  score: number;
  category: string;
  keywords: string[];
}

async function scoreBatch(articles: RawArticle[], offset: number): Promise<ScoredArticle[]> {
  const items = articles.map((a, i) => ({
    id: offset + i,
    title: a.originalTitle,
    body: a.bodyText.slice(0, 200),
  }));

  const prompt = `以下の記事リストを評価してください。各記事について is_noise（ノイズかどうか）、score（0-100の重要度スコア）、category（カテゴリ）、keywords（キーワード配列）を返してください。

記事リスト:
${JSON.stringify(items, null, 2)}

以下のJSON配列形式で返してください:
[{"id": <number>, "is_noise": <boolean>, "score": <number 0-100>, "category": <string>, "keywords": [<string>, ...]}, ...]`;

  const results = await generateJSON<ScoreResult[]>(prompt);

  return articles.map((article, i) => {
    const r = results.find((x) => x.id === offset + i);
    if (!r) {
      return {
        ...article,
        isNoise: true,
        score: 0,
        category: "unknown",
        keywords: [],
      };
    }
    return {
      ...article,
      isNoise: r.is_noise,
      score: r.is_noise ? 0 : r.score,
      category: r.category,
      keywords: r.keywords,
    };
  });
}

export async function scoreAndFilter(articles: RawArticle[]): Promise<ScoredArticle[]> {
  const batchSize = 30;

  // Build index map for offset calculation
  const batches = await batchProcess(
    articles,
    async (batch) => {
      const typedBatch = batch as RawArticle[];
      // Find the offset by locating first item in the original array
      const firstItem = typedBatch[0];
      const offset = firstItem ? articles.indexOf(firstItem) : 0;
      return scoreBatch(typedBatch, offset);
    },
    batchSize
  );

  // Each element of batches is a ScoredArticle[] from scoreBatch
  return (batches as ScoredArticle[][]).flat();
}
