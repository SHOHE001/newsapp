export type RssCategory = "jp-it" | "ai";

export interface RssSource {
  id: string;
  name: string;
  url: string;
  category: RssCategory;
}

export const RSS_SOURCES: RssSource[] = [
  // 日本IT
  {
    id: "hatena-it",
    name: "はてブIT",
    url: "https://b.hatena.ne.jp/hotentry/it.rss",
    category: "jp-it",
  },
  {
    id: "publickey",
    name: "Publickey",
    url: "https://www.publickey1.jp/atom.xml",
    category: "jp-it",
  },
  {
    id: "itmedia-news",
    name: "ITmedia NEWS",
    url: "https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml",
    category: "jp-it",
  },
  {
    id: "zenn-trending",
    name: "Zenn Trending",
    url: "https://zenn.dev/feed",
    category: "jp-it",
  },
  {
    id: "qiita-trending",
    name: "Qiita Trending",
    url: "https://qiita.com/popular-items/feed",
    category: "jp-it",
  },
  // AI ベンダー一次情報 (英語のまま並ぶ。タップで /api/articles/[id]/translate で翻訳)
  {
    id: "anthropic-news",
    name: "Anthropic News",
    url: "https://www.anthropic.com/news/rss.xml",
    category: "ai",
  },
  {
    id: "openai-blog",
    name: "OpenAI Blog",
    url: "https://openai.com/blog/rss.xml",
    category: "ai",
  },
  {
    id: "deepmind-blog",
    name: "DeepMind Blog",
    url: "https://deepmind.google/blog/rss.xml",
    category: "ai",
  },
  {
    id: "google-research-blog",
    name: "Google Research Blog",
    url: "https://research.google/blog/rss/",
    category: "ai",
  },
];
