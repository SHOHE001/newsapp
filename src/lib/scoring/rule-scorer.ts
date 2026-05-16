import type { RawArticle } from "@/lib/rss/fetch";

export interface ScoredArticle extends RawArticle {
  isNoise: boolean;
  score: number;
  category: string;
  keywords: string[];
}

const SOURCE_BASE_SCORE: Record<string, number> = {
  "anthropic-news": 85,
  "openai-blog": 85,
  "deepmind-blog": 85,
  "google-research-blog": 80,
  "arxiv-cs-ai": 75,
  "arxiv-cs-cl": 75,
  "arxiv-cs-lg": 75,
  "mit-tech-review": 70,
  "publickey": 70,
  "ars-technica": 65,
  "hacker-news": 65,
  "the-verge": 60,
  "zenn-trending": 60,
  "qiita-trending": 55,
  "itmedia-news": 55,
  "hatena-it": 50,
};

const DEFAULT_BASE_SCORE = 50;

const SOURCE_CATEGORY: Record<string, string> = {
  "anthropic-news": "ai",
  "openai-blog": "ai",
  "deepmind-blog": "ai",
  "google-research-blog": "ai",
  "arxiv-cs-ai": "ai",
  "arxiv-cs-cl": "ai",
  "arxiv-cs-lg": "ai",
  "mit-tech-review": "foreign-tech",
  "publickey": "jp-it",
  "ars-technica": "foreign-tech",
  "hacker-news": "foreign-tech",
  "the-verge": "foreign-tech",
  "zenn-trending": "jp-it",
  "qiita-trending": "jp-it",
  "itmedia-news": "jp-it",
  "hatena-it": "jp-it",
};

const DEFAULT_CATEGORY = "jp-it";

const HIGH_VALUE_KEYWORDS: Record<string, string[]> = {
  ai: [
    "AI",
    "LLM",
    "GPT",
    "ChatGPT",
    "Claude",
    "Gemini",
    "Llama",
    "Mistral",
    "Anthropic",
    "OpenAI",
    "DeepMind",
    "エージェント",
    "agent",
    "基盤モデル",
    "生成AI",
    "RAG",
    "ファインチューニング",
    "fine-tuning",
    "transformer",
    "embedding",
    "Stable Diffusion",
    "Midjourney",
    "推論",
    "学習",
    "MCP",
  ],
  cloud: [
    "AWS",
    "Azure",
    "GCP",
    "Vercel",
    "Cloudflare",
    "Kubernetes",
    "Docker",
    "serverless",
    "サーバレス",
    "サーバーレス",
    "Edge",
    "CDN",
  ],
  framework: [
    "Next.js",
    "React",
    "Vue",
    "Svelte",
    "TypeScript",
    "Rust",
    "Go言語",
    "Python",
    "WebAssembly",
    "WASM",
    "Bun",
    "Deno",
    "Node.js",
  ],
  security: [
    "脆弱性",
    "ゼロデイ",
    "0-day",
    "CVE",
    "セキュリティ",
    "ハッキング",
    "ランサムウェア",
    "vulnerability",
  ],
};

const KEYWORD_BOOST_PER_HIT = 5;
const MAX_SCORE = 100;
const MAX_KEYWORDS = 5;

function pickKeywords(haystack: string, haystackLower: string): string[] {
  const hits: string[] = [];
  const seen = new Set<string>();
  for (const group of Object.values(HIGH_VALUE_KEYWORDS)) {
    for (const kw of group) {
      const lower = kw.toLowerCase();
      const matched =
        lower === kw ? haystackLower.includes(lower) : haystack.includes(kw);
      if (matched && !seen.has(kw)) {
        seen.add(kw);
        hits.push(kw);
      }
    }
  }
  return hits;
}

export function scoreOneArticle(article: RawArticle): {
  isNoise: boolean;
  score: number;
  category: string;
  keywords: string[];
} {
  const sourceId = article.sourceId;
  const baseScore = SOURCE_BASE_SCORE[sourceId] ?? DEFAULT_BASE_SCORE;
  const category = SOURCE_CATEGORY[sourceId] ?? DEFAULT_CATEGORY;

  const haystack = `${article.originalTitle} ${article.bodyText.slice(0, 500)}`;
  const haystackLower = haystack.toLowerCase();
  const matchedKeywords = pickKeywords(haystack, haystackLower);
  const boost = matchedKeywords.length * KEYWORD_BOOST_PER_HIT;
  const score = Math.min(MAX_SCORE, baseScore + boost);

  return {
    isNoise: false,
    score,
    category,
    keywords: matchedKeywords.slice(0, MAX_KEYWORDS),
  };
}

export function scoreAndCategorize(articles: RawArticle[]): ScoredArticle[] {
  return articles.map((a) => ({ ...a, ...scoreOneArticle(a) }));
}

export function selectTopForSummary(
  articles: ScoredArticle[],
  n: number,
): ScoredArticle[] {
  return [...articles].sort((a, b) => b.score - a.score).slice(0, n);
}
