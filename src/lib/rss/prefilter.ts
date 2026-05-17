import type { RawArticle } from "./fetch";

const NOISE_KEYWORDS_JA = [
  "芸能",
  "スキャンダル",
  "ジャニーズ",
  "アイドル",
  "声優",
  "歌手",
  "俳優",
  "女優",
  "タレント",
  "ドラマ",
  "映画化",
  "アニメ化",
  "マンガ家",
  "結婚",
  "離婚",
  "破局",
  "復縁",
  "不倫",
  "占い",
  "ダイエット",
  "美容",
  "コスメ",
  "ファッション",
  "グルメ",
  "レシピ",
  "プロ野球",
  "Jリーグ",
  "競馬",
  "競輪",
  "競艇",
  "パチンコ",
  "宝くじ",
];

// AI ベンダー一次情報はノイズフィルタを通さない (英語ノイズではないため)
const BYPASS_SOURCE_IDS = new Set([
  "google-research-blog",
  "anthropic-news",
  "openai-blog",
  "deepmind-blog",
]);

function shouldBypass(sourceId: string): boolean {
  return BYPASS_SOURCE_IDS.has(sourceId);
}

export function isNoiseByRule(article: RawArticle): boolean {
  if (shouldBypass(article.sourceId)) return false;
  const title = article.originalTitle;
  if (!title) return false;
  return NOISE_KEYWORDS_JA.some((kw) => title.includes(kw));
}

export function prefilter(articles: RawArticle[]): RawArticle[] {
  return articles.filter((a) => !isNoiseByRule(a));
}
