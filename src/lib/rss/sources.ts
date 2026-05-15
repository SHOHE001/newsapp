export type RssCategory = "jp-it" | "foreign-tech" | "ai";

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
  // 海外テック
  {
    id: "hacker-news",
    name: "Hacker News",
    url: "https://hnrss.org/frontpage",
    category: "foreign-tech",
  },
  {
    id: "the-verge",
    name: "The Verge",
    url: "https://www.theverge.com/rss/index.xml",
    category: "foreign-tech",
  },
  {
    id: "ars-technica",
    name: "Ars Technica",
    url: "https://feeds.arstechnica.com/arstechnica/index",
    category: "foreign-tech",
  },
  {
    id: "mit-tech-review",
    name: "MIT Tech Review",
    url: "https://www.technologyreview.com/feed/",
    category: "foreign-tech",
  },
  // AI特化
  {
    id: "arxiv-cs-ai",
    name: "arXiv cs.AI",
    url: "http://export.arxiv.org/rss/cs.AI",
    category: "ai",
  },
  {
    id: "arxiv-cs-cl",
    name: "arXiv cs.CL",
    url: "http://export.arxiv.org/rss/cs.CL",
    category: "ai",
  },
  {
    id: "arxiv-cs-lg",
    name: "arXiv cs.LG",
    url: "http://export.arxiv.org/rss/cs.LG",
    category: "ai",
  },
  {
    id: "google-research-blog",
    name: "Google Research Blog",
    url: "https://research.google/blog/rss/",
    category: "ai",
  },
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
];
