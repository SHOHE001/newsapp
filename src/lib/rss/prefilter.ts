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

const NOISE_KEYWORDS_EN = [
  "celebrity",
  "celebrities",
  "gossip",
  "scandal",
  "divorce",
  "tabloid",
  "horoscope",
  "diet plan",
  "weight loss",
];

const BYPASS_SOURCE_PREFIXES = ["arxiv-"];
const BYPASS_SOURCE_IDS = new Set([
  "google-research-blog",
  "anthropic-news",
  "openai-blog",
  "deepmind-blog",
]);

function shouldBypass(sourceId: string): boolean {
  if (BYPASS_SOURCE_IDS.has(sourceId)) return true;
  return BYPASS_SOURCE_PREFIXES.some((p) => sourceId.startsWith(p));
}

export function isNoiseByRule(article: RawArticle): boolean {
  if (shouldBypass(article.sourceId)) return false;
  const title = article.originalTitle;
  if (!title) return false;
  if (NOISE_KEYWORDS_JA.some((kw) => title.includes(kw))) return true;
  const titleLower = title.toLowerCase();
  if (NOISE_KEYWORDS_EN.some((kw) => titleLower.includes(kw))) return true;
  return false;
}

export function prefilter(articles: RawArticle[]): RawArticle[] {
  return articles.filter((a) => !isNoiseByRule(a));
}
