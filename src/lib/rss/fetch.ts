import Parser from "rss-parser";
import { RSS_SOURCES, type RssSource } from "./sources";

export interface RawArticle {
  sourceId: string;
  originalUrl: string;
  originalTitle: string;
  publishedAt: Date;
  bodyText: string;
}

const ARXIV_BODY_TEXT_MAX_LENGTH = 4000;
const FETCH_TIMEOUT_MS = 10000;

function isArxivSource(sourceId: string): boolean {
  return sourceId.startsWith("arxiv-");
}

function extractBodyText(item: Parser.Item, sourceId: string): string {
  const raw = item.content ?? item.contentSnippet ?? item.summary ?? "";
  if (isArxivSource(sourceId)) {
    return raw.slice(0, ARXIV_BODY_TEXT_MAX_LENGTH);
  }
  return raw;
}

function parsePublishedAt(item: Parser.Item): Date {
  if (item.isoDate) {
    const d = new Date(item.isoDate);
    if (!isNaN(d.getTime())) return d;
  }
  if (item.pubDate) {
    const d = new Date(item.pubDate);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

export async function fetchFeed(source: RssSource): Promise<RawArticle[]> {
  const parser = new Parser({ timeout: FETCH_TIMEOUT_MS });
  try {
    const feed = await parser.parseURL(source.url);
    return feed.items.map((item) => ({
      sourceId: source.id,
      originalUrl: item.link ?? item.guid ?? "",
      originalTitle: item.title ?? "",
      publishedAt: parsePublishedAt(item),
      bodyText: extractBodyText(item, source.id),
    }));
  } catch (err) {
    console.warn(`[rss] Failed to fetch feed: ${source.id} (${source.url})`, err);
    return [];
  }
}

export async function fetchAllFeeds(
  sources: RssSource[] = RSS_SOURCES
): Promise<RawArticle[]> {
  const results = await Promise.allSettled(sources.map((s) => fetchFeed(s)));
  return results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );
}
