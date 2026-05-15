import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  date,
} from "drizzle-orm/pg-core";

export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  url: text("url").notNull().unique(),
  category: text("category").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  priority: integer("priority").notNull().default(0),
});

export const articles = pgTable("articles", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => sources.id),
  originalUrl: text("original_url").notNull().unique(),
  originalTitle: text("original_title").notNull(),
  publishedAt: timestamp("published_at").notNull(),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  bodyText: text("body_text").notNull(),
  aiTitleJa: text("ai_title_ja"),
  aiSummaryJa: text("ai_summary_ja"),
  score: integer("score"),
  category: text("category"),
  isNoise: boolean("is_noise"),
  keywords: text("keywords").array(),
  bodyTranslatedJa: text("body_translated_ja"),
});

export const reads = pgTable("reads", {
  id: uuid("id").primaryKey().defaultRandom(),
  articleId: uuid("article_id")
    .notNull()
    .references(() => articles.id),
  readAt: timestamp("read_at").notNull().defaultNow(),
});

export const bookmarks = pgTable("bookmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  articleId: uuid("article_id")
    .notNull()
    .references(() => articles.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const digests = pgTable("digests", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: date("date").notNull().unique(),
  markdown: text("markdown").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  endpoint: text("endpoint").notNull().unique(),
  keysP256dh: text("keys_p256dh").notNull(),
  keysAuth: text("keys_auth").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
