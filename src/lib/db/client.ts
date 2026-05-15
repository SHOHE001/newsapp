import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

type DrizzleDb = ReturnType<typeof drizzle>;

function createDb(): DrizzleDb {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const sql = neon(url);
  return drizzle(sql);
}

// Lazy singleton — evaluated only when first accessed at runtime
let _db: DrizzleDb | null = null;

function getDb(): DrizzleDb {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}

export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop: string | symbol) {
    const instance = getDb();
    const val = (instance as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof val === "function") {
      return val.bind(instance);
    }
    return val;
  },
});
